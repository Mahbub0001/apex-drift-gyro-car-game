import * as THREE from 'three';
import { createSportsCar, CarMeshes } from '../models/CarModel';
import { VehiclePhysics } from '../physics/VehicleController';
import { HighwayTrack } from '../environment/Track';
import { ControllerInput, VehicleTelemetry } from '../../types';

export class GameEngine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public vehiclePhysics: VehiclePhysics;
  public carMeshes: CarMeshes;
  public track: HighwayTrack;

  private canvas: HTMLCanvasElement;
  private cameraMode: 'chase' | 'hood' | 'cinematic' = 'chase';
  private cameraTarget: THREE.Vector3 = new THREE.Vector3();
  private baseFov: number = 62;
  private currentRoll: number = 0;

  // Jump camera parameters
  public isLetterboxed: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    // 1. Scene & Renderer Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0c12);
    this.scene.fog = new THREE.FogExp2(0x0a0c12, 0.0028);

    this.camera = new THREE.PerspectiveCamera(this.baseFov, width / height, 0.2, 1200);
    this.camera.position.set(0, 3, -7);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Build Highway Track & Autumn Environment
    this.track = new HighwayTrack(this.scene);

    // 3. Physics & Car Mesh
    this.vehiclePhysics = new VehiclePhysics(new THREE.Vector3(0, 0.4, 10));
    this.carMeshes = createSportsCar(0x00f2fe);
    this.scene.add(this.carMeshes.root);

    // 4. Lighting Rig
    this.setupLighting();
  }

  private setupLighting() {
    // Ambient Fill
    const ambient = new THREE.HemisphereLight(0xddeeff, 0x1a1a24, 0.9);
    this.scene.add(ambient);

    // Golden Hour Directional Sun
    const sun = new THREE.DirectionalLight(0xffeedd, 3.2);
    sun.position.set(60, 90, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 400;
    const d = 50;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    this.scene.add(sun);

    // Purple Rim Lighting
    const rimLight = new THREE.DirectionalLight(0x8a2be2, 2.0);
    rimLight.position.set(-45, 25, -50);
    this.scene.add(rimLight);
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
        // Launch into air!
        const upwardImpulse = Math.min(22, 12 + (this.vehiclePhysics.speedKmh / 200) * 8);
        this.vehiclePhysics.launchRamp(upwardImpulse);
      }
    }

    // 3. Update Vehicle Physics with Highway Elevation
    const roadElevationFunc = (x: number, z: number) => this.track.getElevationAt(x, z);
    const telemetry = this.vehiclePhysics.update(delta, input, roadElevationFunc);

    // 4. Sync 3D Car Mesh with Physics
    const { root, wheels, bodyMaterial, taillightBar } = this.carMeshes;
    root.position.copy(this.vehiclePhysics.position);
    root.quaternion.copy(this.vehiclePhysics.quaternion);

    // Animate Wheels (Spin + Steer)
    const forwardSpeed = this.vehiclePhysics.velocity.z;
    const wheelSpinRate = (forwardSpeed * delta) / 0.35;

    wheels.forEach((wheel, idx) => {
      wheel.children[0].rotation.x += wheelSpinRate;
      wheel.children[1].rotation.x += wheelSpinRate;

      if (idx === 0 || idx === 1) {
        wheel.rotation.y = -input.steer * 0.45;
      }
    });

    // Nitro Visual Shift
    if (input.nitro && telemetry.nitroFuel > 0 && input.throttle > 0.1) {
      bodyMaterial.color.setHex(0x8a2be2);
    } else {
      bodyMaterial.color.setHex(0x00f2fe);
    }

    // Brake Lights Glow
    const isBraking = input.brake > 0.05;
    (taillightBar.material as THREE.MeshBasicMaterial).color.setHex(isBraking ? 0xff0022 : 0x880011);

    // 5. Asphalt 9-Style Dynamic Camera Choreography
    this.updateCamera(delta, telemetry, input);

    // 6. Render Scene
    this.renderer.render(this.scene, this.camera);

    return telemetry;
  }

  private updateCamera(delta: number, telemetry: VehicleTelemetry, input: ControllerInput) {
    const carPos = this.vehiclePhysics.position;
    const carRot = this.vehiclePhysics.rotation;

    // Dynamic FOV based on speed and nitro
    const speedRatio = Math.min(1, telemetry.speedKmh / 280);
    const targetFov = this.baseFov + (speedRatio * 16) + (input.nitro ? 8 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, delta * 6);
    this.camera.updateProjectionMatrix();

    if (telemetry.isJumping) {
      // --- ASPHALT 9 CINEMATIC JUMP CAM ---
      this.isLetterboxed = true;

      // Low-Angle Dutch Tilt 3/4 side view tracking the car in the air
      const jumpCamOffset = new THREE.Vector3(
        carPos.x + Math.sin(carRot.y + 0.8) * 5.2,
        carPos.y - 0.5,
        carPos.z + Math.cos(carRot.y + 0.8) * 5.2
      );

      this.camera.position.lerp(jumpCamOffset, Math.min(1, delta * 8));
      this.cameraTarget.copy(carPos).add(new THREE.Vector3(0, 0.4, 0));
      this.camera.lookAt(this.cameraTarget);

      // Dutch tilt roll
      this.currentRoll += (0.18 - this.currentRoll) * Math.min(1, delta * 5);
      this.camera.rotation.z = this.currentRoll;
      return;
    }

    // Retract letterbox when on ground
    this.isLetterboxed = false;
    this.currentRoll += (0 - this.currentRoll) * Math.min(1, delta * 10);

    if (this.cameraMode === 'hood') {
      const hoodPos = new THREE.Vector3(
        carPos.x + Math.sin(carRot.y) * 1.4,
        carPos.y + 0.65,
        carPos.z + Math.cos(carRot.y) * 1.4
      );
      this.camera.position.copy(hoodPos);

      const lookAhead = new THREE.Vector3(
        carPos.x + Math.sin(carRot.y) * 25,
        carPos.y + 0.65,
        carPos.z + Math.cos(carRot.y) * 25
      );
      this.camera.lookAt(lookAhead);
    } else {
      // Chase Cam (Default)
      const driftOffset = telemetry.isDrifting ? -input.steer * 0.8 : 0;

      const idealOffset = new THREE.Vector3(
        carPos.x - Math.sin(carRot.y) * 6.2 + Math.cos(carRot.y) * driftOffset,
        carPos.y + 2.4,
        carPos.z - Math.cos(carRot.y) * 6.2 - Math.sin(carRot.y) * driftOffset
      );

      this.camera.position.lerp(idealOffset, Math.min(1, delta * 12));

      const targetLookAt = new THREE.Vector3(
        carPos.x + Math.sin(carRot.y) * 5.0,
        carPos.y + 0.9,
        carPos.z + Math.cos(carRot.y) * 5.0
      );
      this.cameraTarget.lerp(targetLookAt, Math.min(1, delta * 15));
      this.camera.lookAt(this.cameraTarget);
      this.camera.rotation.z = this.currentRoll;
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
