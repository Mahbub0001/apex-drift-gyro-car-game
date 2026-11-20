import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { createSportsCar, CarMeshes } from '../models/CarModel';
import { VehiclePhysics } from '../physics/VehicleController';
import { HighwayTrack } from '../environment/Track';
import { TrafficManager } from '../traffic/TrafficManager';
import { ControllerInput, VehicleTelemetry, TrafficCarState, RemotePlayerState } from '../../types';

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

  public trafficStates: TrafficCarState[] = [];
  public nearMissActive: boolean = false;
  private nearMissTimer: number = 0;

  // Remote Multiplayer Cars
  private opponentCars: Map<string, OpponentCarEntity> = new Map();

  private canvas: HTMLCanvasElement;
  private cameraMode: 'chase' | 'hood' | 'cinematic' = 'chase';
  private cameraTarget: THREE.Vector3 = new THREE.Vector3();
  private baseFov: number = 60;

  public isLetterboxed: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    // 1. Scene & Renderer Setup
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x9cc3db, 0.0012); // Natural light atmospheric haze

    this.camera = new THREE.PerspectiveCamera(this.baseFov, width / height, 0.2, 2000);
    this.camera.position.set(0, 3, -8);
    this.camera.up.set(0, 1, 0); // Always enforce upright Y-axis

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Load HDR Environment Map for Realistic Clearcoat Reflections
    new RGBELoader().load(
      '/textures/env.hdr',
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.environment = texture;
      },
      undefined,
      (err) => console.warn('[Engine] HDR texture warning:', err)
    );

    // 3. Build Highway Track & Autumn British Countryside
    this.track = new HighwayTrack(this.scene);

    // 4. Traffic Obstacles AI Manager
    this.trafficManager = new TrafficManager(this.scene, this.track.splineCurve);

    // 5. Local Player Car (Vibrant Candy Red Supra/Ferrari)
    this.vehiclePhysics = new VehiclePhysics(new THREE.Vector3(0, 0.45, 10));
    this.carMeshes = createSportsCar(0xd40000, (loadedMeshes) => {
      this.carMeshes = loadedMeshes;
    });
    this.scene.add(this.carMeshes.root);
  }

  // Update or Spawn Remote Opponents in the 3D world
  public syncOpponents(opponents: RemotePlayerState[]) {
    opponents.forEach((opp) => {
      let carEntity = this.opponentCars.get(opp.id);
      if (!carEntity) {
        const colorHex = parseInt((opp.color || '#a855f7').replace('#', '0x'), 16);
        const meshes = createSportsCar(colorHex);
        this.scene.add(meshes.root);

        carEntity = {
          id: opp.id,
          meshes,
          targetPos: new THREE.Vector3(...opp.position),
          targetQuat: new THREE.Quaternion(...opp.rotation),
          currentSpeed: opp.speedKmh
        };
        this.opponentCars.set(opp.id, carEntity);
      } else {
        carEntity.targetPos.set(...opp.position);
        carEntity.targetQuat.set(...opp.rotation);
        carEntity.currentSpeed = opp.speedKmh;
      }
    });

    const currentIds = new Set(opponents.map((o) => o.id));
    this.opponentCars.forEach((car, id) => {
      if (!currentIds.has(id)) {
        this.scene.remove(car.meshes.root);
        this.opponentCars.delete(id);
      }
    });
  }

  public update(delta: number, input: ControllerInput): VehicleTelemetry {
    // 1. Toggle Camera View ('C' key or button)
    if (input.cameraSwitch) {
      this.cameraMode = this.cameraMode === 'chase' ? 'hood' : 'chase';
    }

    // 2. Check for Jump Ramp Trigger
    for (const ramp of this.track.ramps) {
      const dist = this.vehiclePhysics.position.distanceTo(ramp.position);
      if (dist < 5.0 && this.vehiclePhysics.speedKmh > 50 && !this.vehiclePhysics.isAirborne) {
        const upwardImpulse = Math.min(20, 11 + (this.vehiclePhysics.speedKmh / 200) * 8);
        this.vehiclePhysics.launchRamp(upwardImpulse);
      }
    }

    // 3. Update Vehicle Physics with Highway Elevation
    const roadElevationFunc = (x: number, z: number) => this.track.getElevationAt(x, z);
    const telemetry = this.vehiclePhysics.update(delta, input, roadElevationFunc);

    // 4. Update Dynamic Civilian Traffic AI
    this.trafficStates = this.trafficManager.update(
      delta,
      this.vehiclePhysics.position,
      () => {
        this.vehiclePhysics.velocity.z *= 0.7;
        this.vehiclePhysics.position.x += (Math.random() - 0.5) * 0.8;
      },
      () => {
        this.nearMissActive = true;
        this.nearMissTimer = 1.2;
        this.vehiclePhysics.nitroFuel = Math.min(100, this.vehiclePhysics.nitroFuel + 35);
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
    const { root, wheels, frontWheels, bodyMaterial } = this.carMeshes;
    root.position.copy(this.vehiclePhysics.position);
    root.quaternion.copy(this.vehiclePhysics.quaternion);

    // Animate Wheels (Spin on local axis + Turn front wheels)
    const forwardSpeed = this.vehiclePhysics.velocity.z;
    const wheelSpinRate = (forwardSpeed * delta) / 0.35;

    wheels.forEach((wheel) => {
      wheel.rotation.x += wheelSpinRate;
    });

    frontWheels.forEach((wheel) => {
      wheel.rotation.y = -input.steer * 0.45;
    });

    // Nitro Visual Glow Shift
    if (input.nitro && telemetry.nitroFuel > 0 && input.throttle > 0.1) {
      bodyMaterial.color.setHex(0x9900ff); // Electric Purple Nitro
    } else {
      bodyMaterial.color.setHex(0xd40000); // Candy Red
    }

    // 7. Asphalt 9-Style Dynamic Camera Choreography (Always Upright!)
    this.updateCamera(delta, telemetry, input);

    // 8. Render Scene
    this.renderer.render(this.scene, this.camera);

    return telemetry;
  }

  private updateCamera(delta: number, telemetry: VehicleTelemetry, input: ControllerInput) {
    const carPos = this.vehiclePhysics.position;
    const heading = this.vehiclePhysics.rotation.y;

    // Forward direction vector
    const forwardX = Math.sin(heading);
    const forwardZ = Math.cos(heading);

    // Dynamic FOV based on speed and nitro
    const speedRatio = Math.min(1, telemetry.speedKmh / 280);
    const targetFov = this.baseFov + (speedRatio * 15) + (input.nitro ? 8 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, delta * 6);
    this.camera.updateProjectionMatrix();

    if (telemetry.isJumping) {
      // --- ASPHALT 9 CINEMATIC JUMP CAM ---
      this.isLetterboxed = true;

      // Low 3/4 Side tracking angle looking up at the airborne car
      const sideAngle = heading + 0.6;
      const jumpCamPos = new THREE.Vector3(
        carPos.x + Math.sin(sideAngle) * 5.8,
        carPos.y + 0.6, // Low looking up
        carPos.z + Math.cos(sideAngle) * 5.8
      );

      this.camera.position.lerp(jumpCamPos, Math.min(1, delta * 8));
      this.cameraTarget.copy(carPos).add(new THREE.Vector3(0, 0.5, 0));
      this.camera.lookAt(this.cameraTarget);
      return;
    }

    this.isLetterboxed = false;

    if (this.cameraMode === 'hood') {
      // First-person Hood / Bumper View
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
      // --- CHASE CAM (Forza Horizon Style) ---
      // Camera stays BEHIND the car looking forward
      const driftOffset = telemetry.isDrifting ? -input.steer * 0.9 : 0;
      const rightX = forwardZ;
      const rightZ = -forwardX;

      const idealCamPos = new THREE.Vector3(
        carPos.x - forwardX * 6.5 + rightX * driftOffset,
        carPos.y + 2.2,
        carPos.z - forwardZ * 6.5 + rightZ * driftOffset
      );

      this.camera.position.lerp(idealCamPos, Math.min(1, delta * 12));

      // Look slightly ahead of car hood
      const targetLookAt = new THREE.Vector3(
        carPos.x + forwardX * 6.0,
        carPos.y + 0.8,
        carPos.z + forwardZ * 6.0
      );

      this.cameraTarget.lerp(targetLookAt, Math.min(1, delta * 15));
      this.camera.lookAt(this.cameraTarget);
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
