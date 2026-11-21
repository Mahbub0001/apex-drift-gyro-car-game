import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { createSportsCar, CarMeshes } from '../models/CarModel';
import { VehiclePhysics } from '../physics/VehicleController';
import { HighwayTrack } from '../environment/Track';
import { TrafficManager } from '../traffic/TrafficManager';
import { ControllerInput, VehicleTelemetry, TrafficCarState, RemotePlayerState, SuperCarConfig, SUPER_CARS } from '../../types';

interface OpponentCarEntity {
  id: string;
  meshes: CarMeshes;
  targetPos: THREE.Vector3;
  targetQuat: THREE.Quaternion;
  currentSpeed: number;
}

function createPlayerNameplate(username: string, color: string = '#00f2fe'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(8, 12, 20, 0.88)';
  if (ctx.roundRect) {
    ctx.roundRect(8, 8, 240, 48, 12);
  } else {
    ctx.rect(8, 8, 240, 48);
  }
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(username, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3.2, 0.8, 1.0);
  sprite.position.y = 2.1;
  return sprite;
}

export class GameEngine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public vehiclePhysics: VehiclePhysics;
  public carMeshes: CarMeshes;
  public track: HighwayTrack;
  public trafficManager: TrafficManager;
  public currentCarConfig: SuperCarConfig;

  public trafficStates: TrafficCarState[] = [];
  public nearMissActive: boolean = false;
  private nearMissTimer: number = 0;

  // Collision callback to trigger audio
  public onCrashCallback?: (severity: number) => void;

  // Remote Multiplayer Opponents
  private opponentCars: Map<string, OpponentCarEntity> = new Map();

  private canvas: HTMLCanvasElement;
  private cameraMode: 'chase' | 'hood' | 'cinematic' = 'chase';
  private cameraTarget: THREE.Vector3 = new THREE.Vector3();
  private baseFov: number = 60;

  // NFS-Style Damped Elastic Impact Camera
  private crashImpulseDir: THREE.Vector3 = new THREE.Vector3();
  private crashImpulseTimer: number = 0;
  private crashImpulseIntensity: number = 0;

  // Nitro Flames
  private nitroFlameL: THREE.Mesh | null = null;
  private nitroFlameR: THREE.Mesh | null = null;

  // Interactive Braking Taillights
  private taillightL: THREE.Mesh | null = null;
  private taillightR: THREE.Mesh | null = null;
  private taillightMat: THREE.MeshStandardMaterial | null = null;

  // Dynamic Tire Skid Marks System
  private skidMarkMeshes: THREE.Mesh[] = [];
  private skidPoolIndex: number = 0;
  private maxSkids: number = 160;
  private lastSkidPos: THREE.Vector3 = new THREE.Vector3();

  // Radiator Steam / Damage Smoke System
  private damageSmokePuffs: THREE.Mesh[] = [];
  private dirSunLight: THREE.DirectionalLight | null = null;

  public isLetterboxed: boolean = false;

  constructor(canvas: HTMLCanvasElement, carConfig: SuperCarConfig = SUPER_CARS[0]) {
    this.canvas = canvas;
    this.currentCarConfig = carConfig;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    // 1. Scene & Renderer Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8bc0f8);
    this.scene.fog = new THREE.Fog(0xc2ddf5, 250, 1600); // Natural crisp atmospheric horizon

    this.camera = new THREE.PerspectiveCamera(this.baseFov, width / height, 0.2, 2000);
    this.camera.position.set(0, 3, -8);
    this.camera.up.set(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15; // Crisp vibrant lighting
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Load HDR Environment Map
    new RGBELoader().load(
      '/textures/env.hdr',
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.environment = texture;
        this.scene.background = texture; // Real photorealistic 360-degree HDR sky!
      },
      undefined,
      (err) => console.warn('[Engine] HDR warning:', err)
    );

    // 3. Track Environment
    this.track = new HighwayTrack(this.scene);

    // 4. Dynamic Civilian Traffic AI
    this.trafficManager = new TrafficManager(this.scene, this.track.splineCurve);

    // 5. Local Player Car
    this.vehiclePhysics = new VehiclePhysics(new THREE.Vector3(0, 0.64, 10));
    this.vehiclePhysics.maxSpeedKmh = carConfig.topSpeedKmh;
    this.vehiclePhysics.accelerationRate = carConfig.accelerationRate;

    this.carMeshes = createSportsCar(carConfig, (loadedMeshes) => {
      this.carMeshes = loadedMeshes;
      this.setupNitroFlames();
      this.setupTaillights();
    });
    this.scene.add(this.carMeshes.root);
    this.setupNitroFlames();
    this.setupTaillights();
    this.setupDamageSmoke();
    this.setupSkidMarkPool();
  }

  // Dual Exhaust Nitro Jet Flames
  private setupNitroFlames() {
    if (this.nitroFlameL && this.nitroFlameR) {
      this.carMeshes.root.remove(this.nitroFlameL, this.nitroFlameR);
    }

    const flameGeo = new THREE.ConeGeometry(0.08, 0.55, 12);
    flameGeo.rotateX(Math.PI / 2);

    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });

    this.nitroFlameL = new THREE.Mesh(flameGeo, flameMat);
    this.nitroFlameL.position.set(-0.35, 0.28, 2.25);
    this.nitroFlameL.visible = false;

    this.nitroFlameR = new THREE.Mesh(flameGeo, flameMat);
    this.nitroFlameR.position.set(0.35, 0.28, 2.25);
    this.nitroFlameR.visible = false;

    this.carMeshes.root.add(this.nitroFlameL, this.nitroFlameR);
  }

  // Interactive Braking Taillights
  private setupTaillights() {
    if (this.taillightL && this.taillightR) {
      this.carMeshes.root.remove(this.taillightL, this.taillightR);
    }

    const tailGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16);
    tailGeo.rotateX(Math.PI / 2);

    this.taillightMat = new THREE.MeshStandardMaterial({
      color: 0x66000e,
      emissive: 0x330005,
      emissiveIntensity: 0.35,
      roughness: 0.2
    });

    this.taillightL = new THREE.Mesh(tailGeo, this.taillightMat);
    this.taillightL.position.set(-0.52, 0.58, 2.05);

    this.taillightR = new THREE.Mesh(tailGeo, this.taillightMat);
    this.taillightR.position.set(0.52, 0.58, 2.05);

    this.carMeshes.root.add(this.taillightL, this.taillightR);
  }

  // Dynamic Tire Skid Mark Trails
  private setupSkidMarkPool() {
    const skidGeo = new THREE.PlaneGeometry(0.32, 1.4);
    skidGeo.rotateX(-Math.PI / 2);

    const skidMat = new THREE.MeshBasicMaterial({
      color: 0x111115,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });

    for (let i = 0; i < this.maxSkids; i++) {
      const mesh = new THREE.Mesh(skidGeo, skidMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.skidMarkMeshes.push(mesh);
    }
  }

  private addSkidMark(pos: THREE.Vector3, heading: number) {
    if (this.skidMarkMeshes.length === 0) return;

    const rightX = Math.cos(heading);
    const rightZ = -Math.sin(heading);

    for (const side of [-0.82, 0.82]) {
      const mark = this.skidMarkMeshes[this.skidPoolIndex];
      this.skidPoolIndex = (this.skidPoolIndex + 1) % this.maxSkids;

      mark.position.set(
        pos.x + rightX * side,
        pos.y - 0.38,
        pos.z + rightZ * side
      );
      mark.rotation.y = heading;
      mark.visible = true;
    }
  }

  // Radiator Steam / Damage Smoke System
  private setupDamageSmoke() {
    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0xdde2e6,
      transparent: true,
      opacity: 0.45,
      roughness: 0.9
    });

    for (let i = 0; i < 5; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), smokeMat);
      puff.visible = false;
      this.scene.add(puff);
      this.damageSmokePuffs.push(puff);
    }
  }

  public setCar(carConfig: SuperCarConfig) {
    this.currentCarConfig = carConfig;
    this.vehiclePhysics.maxSpeedKmh = carConfig.topSpeedKmh;
    this.vehiclePhysics.accelerationRate = carConfig.accelerationRate;

    this.scene.remove(this.carMeshes.root);
    this.carMeshes = createSportsCar(carConfig, (loadedMeshes) => {
      this.carMeshes = loadedMeshes;
      this.setupNitroFlames();
      this.setupTaillights();
    });
    this.scene.add(this.carMeshes.root);
    this.setupNitroFlames();
    this.setupTaillights();
  }

  public syncOpponents(opponents: RemotePlayerState[]) {
    const activeIds = new Set(opponents.map((o) => o.id));

    this.opponentCars.forEach((entity, id) => {
      if (!activeIds.has(id)) {
        this.scene.remove(entity.meshes.root);
        this.opponentCars.delete(id);
      }
    });

    opponents.forEach((remotePlayer) => {
      let entity = this.opponentCars.get(remotePlayer.id);

      if (!entity) {
        const carConfig = SUPER_CARS.find((c) => c.id === remotePlayer.carId) || SUPER_CARS[0];
        const hexColor = parseInt(remotePlayer.color.replace('#', '0x'), 16) || carConfig.bodyColorHex;
        const opponentConfig = { ...carConfig, bodyColorHex: hexColor };
        const meshes = createSportsCar(opponentConfig);

        const nameplate = createPlayerNameplate(remotePlayer.username, remotePlayer.color);
        meshes.root.add(nameplate);

        this.scene.add(meshes.root);

        entity = {
          id: remotePlayer.id,
          meshes,
          targetPos: new THREE.Vector3(...remotePlayer.position),
          targetQuat: new THREE.Quaternion(...remotePlayer.rotation),
          currentSpeed: remotePlayer.speedKmh
        };
        this.opponentCars.set(remotePlayer.id, entity);
      }

      entity.targetPos.set(...remotePlayer.position);
      entity.targetQuat.set(...remotePlayer.rotation);
      entity.currentSpeed = remotePlayer.speedKmh;
    });
  }

  // Natural Need For Speed Damped Directional Impact (Smooth spring, not random vibration)
  public triggerNfsImpact(normalX: number, normalZ: number, intensity: number = 1.0) {
    this.crashImpulseDir.set(normalX, 0, normalZ).normalize();
    this.crashImpulseIntensity = THREE.MathUtils.clamp(intensity * 0.22, 0.1, 0.32);
    this.crashImpulseTimer = 0.28;
  }

  public update(delta: number, input: ControllerInput): VehicleTelemetry {
    // 1. Toggle Camera View ('C' key)
    if (input.cameraSwitch) {
      this.cameraMode = this.cameraMode === 'chase' ? 'hood' : 'chase';
    }

    // 2. Jump Ramp Launch
    for (const ramp of this.track.ramps) {
      const dist = this.vehiclePhysics.position.distanceTo(ramp.position);
      if (dist < 5.0 && this.vehiclePhysics.speedKmh > 50 && !this.vehiclePhysics.isAirborne) {
        const upwardImpulse = Math.min(20, 11 + (this.vehiclePhysics.speedKmh / 200) * 8);
        this.vehiclePhysics.launchRamp(upwardImpulse);
      }
    }

    // 3. Update Vehicle Physics with Highway Elevation & Closest Track Bounds
    const telemetry = this.vehiclePhysics.update(
      delta,
      input,
      (x, z) => this.track.getElevationAt(x, z),
      (x, z) => this.track.getClosestSplinePoint(x, z)
    );

    // Guardrail scrape collision
    if (this.vehiclePhysics.hadBarrierCollision) {
      this.triggerNfsImpact(-Math.sign(input.steer || 1), 0, 0.45);
      this.onCrashCallback?.(0.4);
    }

    // Dynamic directional light following player car for continuous shadow casting
    if (this.track && this.track.dirLight) {
      if (typeof (this.track as any).update === 'function') {
        this.track.update(delta);
      }
      this.track.dirLight.position.set(
        this.vehiclePhysics.position.x + 80,
        this.vehiclePhysics.position.y + 120,
        this.vehiclePhysics.position.z + 60
      );
      this.track.dirLight.target.position.copy(this.vehiclePhysics.position);
      this.track.dirLight.target.updateMatrixWorld();
    }

    // 4. Update Dynamic Civilian Traffic AI with Solid Physical Impact
    this.trafficStates = this.trafficManager.update(
      delta,
      this.vehiclePhysics.position,
      this.vehiclePhysics.speedKmh,
      (normalX, normalZ, impactSpeedKmh) => {
        // Physical collision impact
        this.vehiclePhysics.applyObstacleCollision(normalX, normalZ, impactSpeedKmh);
        this.triggerNfsImpact(normalX, normalZ, impactSpeedKmh / 120);
        this.onCrashCallback?.(impactSpeedKmh / 95);
      },
      () => {
        this.nearMissActive = true;
        this.nearMissTimer = 1.2;
        this.vehiclePhysics.nitroFuel = Math.min(100, this.vehiclePhysics.nitroFuel + 30);
      }
    );

    if (this.nearMissTimer > 0) {
      this.nearMissTimer -= delta;
      if (this.nearMissTimer <= 0) {
        this.nearMissActive = false;
      }
    }

    // 5. Interpolate Remote Opponent Cars
    this.opponentCars.forEach((opp) => {
      opp.meshes.root.position.lerp(opp.targetPos, Math.min(1, delta * 15));
      opp.meshes.root.quaternion.slerp(opp.targetQuat, Math.min(1, delta * 15));

      const spin = (opp.currentSpeed * delta) / 0.35;
      opp.meshes.wheels.forEach((w) => {
        w.rotation.x += spin;
      });
    });

    // 6. Sync Local 3D Car Mesh with Physics & Realtime Damage
    const { root, wheels, frontWheels } = this.carMeshes;
    root.position.copy(this.vehiclePhysics.position);
    root.quaternion.copy(this.vehiclePhysics.quaternion);

    // Apply Realtime Visible Damage to Car Mesh
    this.carMeshes.applyDamageVisuals(telemetry.health);

    // Radiator Steam / Engine Damage Smoke
    if (telemetry.health < 80) {
      const now = performance.now() * 0.003;
      const hoodWorldPos = this.vehiclePhysics.position.clone().add(
        new THREE.Vector3(
          Math.sin(this.vehiclePhysics.rotation.y) * 1.6,
          0.6,
          Math.cos(this.vehiclePhysics.rotation.y) * 1.6
        )
      );

      this.damageSmokePuffs.forEach((puff, idx) => {
        puff.visible = true;
        const phase = (now + idx * 0.4) % 1.5;
        puff.position.set(
          hoodWorldPos.x + (Math.sin(idx * 2 + now) * 0.2),
          hoodWorldPos.y + phase * 1.2,
          hoodWorldPos.z + (Math.cos(idx * 2 + now) * 0.2)
        );
        const scale = 0.5 + phase * 1.2;
        puff.scale.setScalar(scale);

        // Darker smoke if critical health
        const mat = puff.material as THREE.MeshStandardMaterial;
        mat.opacity = Math.max(0, (1.0 - phase / 1.5) * (telemetry.health < 40 ? 0.7 : 0.35));
        mat.color.setHex(telemetry.health < 40 ? 0x222225 : 0xdde2e6);
      });
    } else {
      this.damageSmokePuffs.forEach((puff) => {
        puff.visible = false;
      });
    }

    // Wheel Animation
    const forwardSpeed = this.vehiclePhysics.velocity.z;
    const wheelSpinRate = (forwardSpeed * delta) / 0.35;

    wheels.forEach((wheel) => {
      wheel.rotation.x += wheelSpinRate;
    });

    frontWheels.forEach((wheel) => {
      wheel.rotation.y = -input.steer * 0.42;
    });

    // 7. Nitro Jet Flame VFX
    const isNitroFiring = input.nitro && telemetry.nitroFuel > 0 && input.throttle > 0.1;
    if (this.nitroFlameL && this.nitroFlameR) {
      this.nitroFlameL.visible = isNitroFiring;
      this.nitroFlameR.visible = isNitroFiring;
      if (isNitroFiring) {
        const flameScale = 0.8 + Math.random() * 0.5;
        this.nitroFlameL.scale.set(1, flameScale, 1);
        this.nitroFlameR.scale.set(1, flameScale, 1);
      }
    }

    // 8. Curb Detection & Audio Feedback
    const closestTrackPt = this.track.getClosestSplinePoint(this.vehiclePhysics.position.x, this.vehiclePhysics.position.z);
    telemetry.isOnCurb = closestTrackPt.dist >= 8.0 && closestTrackPt.dist <= 9.6 && telemetry.speedKmh > 20;

    // 9. Interactive Braking Taillights
    const isBraking = input.brake > 0.05 || input.handbrake;
    if (this.taillightMat) {
      if (isBraking) {
        this.taillightMat.color.setHex(0xff1122);
        this.taillightMat.emissive.setHex(0xff0022);
        this.taillightMat.emissiveIntensity = 3.2;
      } else {
        this.taillightMat.color.setHex(0x66000e);
        this.taillightMat.emissive.setHex(0x330005);
        this.taillightMat.emissiveIntensity = 0.35;
      }
    }

    // 10. Dynamic Tire Skid Marks System
    const isSkidding = (telemetry.isDrifting || input.handbrake || (input.brake > 0.35 && telemetry.speedKmh > 40)) && !telemetry.isAirborne;
    if (isSkidding) {
      const movedDist = this.vehiclePhysics.position.distanceTo(this.lastSkidPos);
      if (movedDist > 1.2) {
        this.addSkidMark(this.vehiclePhysics.position, this.vehiclePhysics.rotation.y);
        this.lastSkidPos.copy(this.vehiclePhysics.position);
      }
    }

    // 11. Dynamic Camera Choreography (Always Upright!)
    this.updateCamera(delta, telemetry, input);

    // 12. Render Scene
    this.renderer.render(this.scene, this.camera);

    return telemetry;
  }

  private updateCamera(delta: number, telemetry: VehicleTelemetry, input: ControllerInput) {
    const carPos = this.vehiclePhysics.position;
    const heading = this.vehiclePhysics.rotation.y;

    const forwardX = Math.sin(heading);
    const forwardZ = Math.cos(heading);

    // Speed FOV expansion (60 deg -> 78 deg at 300 km/h)
    const speedRatio = Math.min(1, telemetry.speedKmh / 280);
    const targetFov = this.baseFov + (speedRatio * 16) + (input.nitro ? 8 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, delta * 6);
    this.camera.updateProjectionMatrix();

    this.camera.up.set(0, 1, 0);

    if (telemetry.isJumping) {
      this.isLetterboxed = true;

      const sideAngle = heading + 0.6;
      const jumpCamPos = new THREE.Vector3(
        carPos.x + Math.sin(sideAngle) * 5.8,
        carPos.y + 0.6,
        carPos.z + Math.cos(sideAngle) * 5.8
      );

      this.camera.position.lerp(jumpCamPos, Math.min(1, delta * 8));
      this.cameraTarget.copy(carPos).add(new THREE.Vector3(0, 0.5, 0));
      this.camera.lookAt(this.cameraTarget);
      return;
    }

    this.isLetterboxed = false;

    if (this.cameraMode === 'hood') {
      const hoodPos = new THREE.Vector3(
        carPos.x + forwardX * 1.6,
        carPos.y + 1.15,
        carPos.z + forwardZ * 1.6
      );
      this.camera.position.copy(hoodPos);

      const lookTarget = new THREE.Vector3(
        carPos.x + forwardX * 35,
        carPos.y + 1.05,
        carPos.z + forwardZ * 35
      );
      this.camera.lookAt(lookTarget);
    } else {
      const driftOffset = telemetry.isDrifting ? -input.steer * 0.9 : 0;
      const rightX = forwardZ;
      const rightZ = -forwardX;

      const camDistance = input.nitro ? 7.2 : 6.4;
      const idealCamPos = new THREE.Vector3(
        carPos.x - forwardX * camDistance + rightX * driftOffset,
        carPos.y + 2.2,
        carPos.z - forwardZ * camDistance + rightZ * driftOffset
      );

      this.camera.position.lerp(idealCamPos, Math.min(1, delta * 12));

      const targetLookAt = new THREE.Vector3(
        carPos.x + forwardX * 6.0,
        carPos.y + 0.8,
        carPos.z + forwardZ * 6.0
      );

      this.cameraTarget.lerp(targetLookAt, Math.min(1, delta * 15));
      this.camera.lookAt(this.cameraTarget);
    }

    // Apply NFS-Style Natural Damped Elastic Impact (Smooth mechanical jolt, no random vibration)
    if (this.crashImpulseTimer > 0) {
      this.crashImpulseTimer -= delta;
      const progress = 1.0 - (this.crashImpulseTimer / 0.28);
      const spring = Math.sin(progress * Math.PI * 3.5) * (1.0 - progress) * this.crashImpulseIntensity;
      this.camera.position.x += this.crashImpulseDir.x * spring;
      this.camera.position.z += this.crashImpulseDir.z * spring;
      this.camera.fov -= spring * 4.5;
      this.camera.updateProjectionMatrix();
    }
  }

  public handleResize() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public dispose() {
    this.damageSmokePuffs.forEach((puff) => {
      this.scene.remove(puff);
      puff.geometry.dispose();
      (puff.material as THREE.Material).dispose();
    });
    this.renderer.dispose();
  }
}
