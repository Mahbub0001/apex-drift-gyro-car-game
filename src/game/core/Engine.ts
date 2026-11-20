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

  // Collision callback to trigger sound
  public onCrashCallback?: (severity: number) => void;

  // Remote Multiplayer Opponents
  private opponentCars: Map<string, OpponentCarEntity> = new Map();

  private canvas: HTMLCanvasElement;
  private cameraMode: 'chase' | 'hood' | 'cinematic' = 'chase';
  private cameraTarget: THREE.Vector3 = new THREE.Vector3();
  private baseFov: number = 60;

  // Camera Shake
  private cameraShakeTimer: number = 0;
  private cameraShakeIntensity: number = 0;

  // Nitro Flames
  private nitroFlameL: THREE.Mesh | null = null;
  private nitroFlameR: THREE.Mesh | null = null;

  public isLetterboxed: boolean = false;

  constructor(canvas: HTMLCanvasElement, carConfig: SuperCarConfig = SUPER_CARS[0]) {
    this.canvas = canvas;
    this.currentCarConfig = carConfig;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    // 1. Scene & Renderer Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x90c4f8);
    this.scene.fog = new THREE.FogExp2(0xa0d0f5, 0.001);

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
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Load HDR Environment Map
    new RGBELoader().load(
      '/textures/env.hdr',
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.environment = texture;
      },
      undefined,
      (err) => console.warn('[Engine] HDR warning:', err)
    );

    // 3. Track Environment
    this.track = new HighwayTrack(this.scene);

    // 4. Dynamic Civilian Traffic AI
    this.trafficManager = new TrafficManager(this.scene, this.track.splineCurve);

    // 5. Local Player Car
    this.vehiclePhysics = new VehiclePhysics(new THREE.Vector3(0, 0.42, 10));
    this.vehiclePhysics.maxSpeedKmh = carConfig.topSpeedKmh;
    this.vehiclePhysics.accelerationRate = carConfig.accelerationRate;

    this.carMeshes = createSportsCar(carConfig, (loadedMeshes) => {
      this.carMeshes = loadedMeshes;
      this.setupNitroFlames();
    });
    this.scene.add(this.carMeshes.root);
    this.setupNitroFlames();
  }

  // Dual Exhaust Nitro Jet Flames
  private setupNitroFlames() {
    if (this.nitroFlameL && this.nitroFlameR) {
      this.carMeshes.root.remove(this.nitroFlameL, this.nitroFlameR);
    }

    const flameGeo = new THREE.ConeGeometry(0.08, 0.55, 12);
    flameGeo.rotateX(Math.PI / 2); // Point backward

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

  public setCar(carConfig: SuperCarConfig) {
    this.currentCarConfig = carConfig;
    this.vehiclePhysics.maxSpeedKmh = carConfig.topSpeedKmh;
    this.vehiclePhysics.accelerationRate = carConfig.accelerationRate;

    this.scene.remove(this.carMeshes.root);
    this.carMeshes = createSportsCar(carConfig, (loadedMeshes) => {
      this.carMeshes = loadedMeshes;
      this.setupNitroFlames();
    });
    this.scene.add(this.carMeshes.root);
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
        const meshes = createSportsCar(carConfig);
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

  public triggerCameraShake(intensity: number = 0.45, duration: number = 0.35) {
    this.cameraShakeIntensity = intensity;
    this.cameraShakeTimer = duration;
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

    // 3. Update Vehicle Physics with Highway Elevation & Road Bounds
    const telemetry = this.vehiclePhysics.update(
      delta,
      input,
      (x, z) => this.track.getElevationAt(x, z),
      (x, z) => this.track.getClosestSplinePoint(x, z)
    );

    // Guardrail collision reaction
    if (this.vehiclePhysics.hadBarrierCollision) {
      this.triggerCameraShake(0.3, 0.2);
      this.onCrashCallback?.(0.5);
    }

    // 4. Update Dynamic Civilian Traffic AI with Solid Physical Impact
    this.trafficStates = this.trafficManager.update(
      delta,
      this.vehiclePhysics.position,
      this.vehiclePhysics.speedKmh,
      (normalX, normalZ, impactSpeedKmh) => {
        // Physical collision impact
        this.vehiclePhysics.applyObstacleCollision(normalX, normalZ, impactSpeedKmh);
        this.triggerCameraShake(0.65, 0.4);
        this.onCrashCallback?.(impactSpeedKmh / 100);
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

    // 6. Sync Local 3D Car Mesh with Physics
    const { root, wheels, frontWheels } = this.carMeshes;
    root.position.copy(this.vehiclePhysics.position);
    root.quaternion.copy(this.vehiclePhysics.quaternion);

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

    // 8. Asphalt 9-Style Dynamic Camera Choreography
    this.updateCamera(delta, telemetry, input);

    // 9. Render Scene
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
        carPos.x + forwardX * 1.5,
        carPos.y + 0.65,
        carPos.z + forwardZ * 1.5
      );
      this.camera.position.copy(hoodPos);

      const lookTarget = new THREE.Vector3(
        carPos.x + forwardX * 30,
        carPos.y + 0.65,
        carPos.z + forwardZ * 30
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

    // Apply Camera Shake on Impact / Crash
    if (this.cameraShakeTimer > 0) {
      this.cameraShakeTimer -= delta;
      const shakeX = (Math.random() - 0.5) * this.cameraShakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.cameraShakeIntensity;
      this.camera.position.x += shakeX;
      this.camera.position.y += shakeY;
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
    this.renderer.dispose();
  }
}
