import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { createSportsCar, CarMeshes } from '../models/CarModel';
import { VehiclePhysics } from '../physics/VehicleController';
import { HighwayTrack } from '../environment/Track';
import { TrafficManager } from '../traffic/TrafficManager';
import {
  ControllerInput,
  VehicleTelemetry,
  TrafficCarState,
  RemotePlayerState,
  SuperCarConfig,
  SUPER_CARS,
  GameSettings,
  DEFAULT_GAME_SETTINGS,
  TransmissionMode,
  GhostFrame
} from '../../types';
import { loadSavedGhost, saveBestGhost } from '../../utils/records';

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

// Clean procedural sunny Alpine sky dome so reflections use env.hdr while horizon stays sharp & scenic!
function createSkyDome(): THREE.Mesh {
  const skyGeo = new THREE.SphereGeometry(1850, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x1f6feb) },
      midColor: { value: new THREE.Color(0x7cc4fa) },
      horizonColor: { value: new THREE.Color(0xdbeeff) },
      groundColor: { value: new THREE.Color(0x9ab89c) },
      sunDir: { value: new THREE.Vector3(0.45, 0.55, 0.4).normalize() }
    },
    vertexShader: `
      varying vec3 vLocalPosition;
      void main() {
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 groundColor;
      uniform vec3 sunDir;
      varying vec3 vLocalPosition;

      void main() {
        vec3 dir = normalize(vLocalPosition);
        float h = dir.y;
        vec3 col;
        if (h >= 0.0) {
          float lowMix = smoothstep(0.0, 0.22, h);
          float highMix = smoothstep(0.18, 0.85, h);
          col = mix(horizonColor, midColor, lowMix);
          col = mix(col, topColor, highMix);
        } else {
          col = mix(horizonColor, groundColor, smoothstep(0.0, -0.25, h));
        }

        // Crisp sun disc + warm glow halo
        float sunDot = max(dot(dir, sunDir), 0.0);
        col += vec3(1.0, 0.92, 0.72) * pow(sunDot, 28.0) * 0.45;
        col += vec3(1.0, 0.98, 0.9) * smoothstep(0.997, 0.9993, sunDot) * 1.4;

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  const dome = new THREE.Mesh(skyGeo, skyMat);
  dome.frustumCulled = false;
  return dome;
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

  // Audio callbacks
  public onCrashCallback?: (severity: number) => void;
  public onDriftBankCallback?: (score: number) => void;
  public onGearShiftCallback?: (isUpshift: boolean) => void;

  // Remote Multiplayer Opponents
  private opponentCars: Map<string, OpponentCarEntity> = new Map();
  public multiplayerSpawnPos: THREE.Vector3 | null = null;

  private canvas: HTMLCanvasElement;
  public cameraMode: 'chase' | 'hood' = 'chase';
  private cameraTarget: THREE.Vector3 = new THREE.Vector3();
  private baseFov: number = 60;
  private skyDome: THREE.Mesh;
  private envTexture: THREE.Texture | null = null;
  private isDisposed: boolean = false;

  // Edge triggers & collision cooldowns
  private prevCameraSwitch: boolean = false;
  private prevReset: boolean = false;
  private lastCameraSeq: number = 0;
  private lastResetSeq: number = 0;
  private lastShiftUpSeq: number = 0;
  private lastShiftDownSeq: number = 0;
  private lastBarrierCrashSoundTime: number = 0;

  // NFS-Style Damped Elastic Impact Camera
  private crashImpulseDir: THREE.Vector3 = new THREE.Vector3();
  private crashImpulseTimer: number = 0;
  private crashImpulseIntensity: number = 0;

  // Rear Dual Exhaust Nitro Flames
  private nitroFlameL: THREE.Mesh | null = null;
  private nitroFlameR: THREE.Mesh | null = null;
  private nitroCoreL: THREE.Mesh | null = null;
  private nitroCoreR: THREE.Mesh | null = null;

  // Rear Round Braking Taillights
  private taillightL: THREE.Mesh | null = null;
  private taillightR: THREE.Mesh | null = null;
  private taillightMat: THREE.MeshStandardMaterial | null = null;

  // Dynamic Tire Skid Mark Trails
  private skidMarkMeshes: THREE.Mesh[] = [];
  private skidPoolIndex: number = 0;
  private maxSkids: number = 160;
  private lastSkidPos: THREE.Vector3 = new THREE.Vector3();

  // Radiator Steam / Damage Smoke System
  private damageSmokePuffs: THREE.Mesh[] = [];
  private smokeGeo!: THREE.SphereGeometry;
  private smokeMat!: THREE.MeshStandardMaterial;

  // Drift Tire Smoke & Collision Sparks Pools (zero hot-loop allocations)
  private driftSmokePool: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number }[] = [];
  private driftSmokeGeo!: THREE.SphereGeometry;
  private driftSmokeMat!: THREE.MeshStandardMaterial;
  private driftSmokeCooldown: number = 0;

  private sparkPool: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number }[] = [];
  private sparkGeo!: THREE.BoxGeometry;
  private sparkMat!: THREE.MeshBasicMaterial;

  // Holographic Best-Lap Ghost / Pace Car & Dynamic Tunnel Beam
  private ghostMeshes: CarMeshes | null = null;
  private savedGhostFrames: GhostFrame[] | null = null;
  private ghostRecordingFrames: GhostFrame[] = [];
  private ghostSampleTimer: number = 0;
  private ghostPaceT: number = 0.004;
  private isMultiplayerActive: boolean = false;
  private tunnelHeadlight: THREE.PointLight | null = null;
  private smoothJumpTilt: number = 0;

  public isLetterboxed: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    carConfig: SuperCarConfig = SUPER_CARS[0],
    initialSettings: GameSettings = DEFAULT_GAME_SETTINGS
  ) {
    this.canvas = canvas;
    this.currentCarConfig = carConfig;
    this.cameraMode = initialSettings.defaultCamera || 'chase';

    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    // 1. Scene & Renderer Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9ed0fc);
    this.scene.fog = new THREE.Fog(0xdbeeff, 320, 1750);

    this.camera = new THREE.PerspectiveCamera(this.baseFov, width / height, 0.2, 2200);
    this.camera.position.set(0, 3, -8);
    this.camera.up.set(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Sky Dome follows camera smoothly
    this.skyDome = createSkyDome();
    this.scene.add(this.skyDome);

    // 2. Load HDR Environment Map strictly for crisp metallic PBR vehicle reflections!
    new RGBELoader().load(
      '/textures/env.hdr',
      (texture) => {
        if (this.isDisposed) {
          texture.dispose();
          return;
        }
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.envTexture = texture;
        this.scene.environment = texture;
      },
      undefined,
      (err) => console.warn('[Engine] HDR warning:', err)
    );

    // 3. Track Environment (InstancedMesh optimized)
    this.track = new HighwayTrack(this.scene);

    // 4. Dynamic Civilian Traffic AI
    this.trafficManager = new TrafficManager(this.scene, this.track.splineCurve);

    // 5. Local Player Car with complete carConfig & transmissionMode wiring
    this.vehiclePhysics = new VehiclePhysics(
      new THREE.Vector3(0, 0.64, 10),
      carConfig,
      initialSettings.transmissionMode || 'auto'
    );

    this.carMeshes = createSportsCar(carConfig, (loadedMeshes) => {
      if (this.isDisposed) return;
      this.carMeshes = loadedMeshes;
      this.setupNitroFlames();
      this.setupTaillights();
    });
    this.scene.add(this.carMeshes.root);
    this.setupNitroFlames();
    this.setupTaillights();
    this.setupDamageSmoke();
    this.setupDriftSmokeAndSparks();
    this.setupGhostCar(carConfig);
    this.setupTunnelHeadlight();
    this.setupSkidMarkPool();

    this.applyGraphicsSettings(initialSettings);
  }

  public setTransmissionMode(mode: TransmissionMode) {
    this.vehiclePhysics.setTransmissionMode(mode);
  }

  public setMultiplayerActive(active: boolean) {
    this.isMultiplayerActive = active;
    if (this.ghostMeshes) {
      this.ghostMeshes.root.visible = !active;
    }
  }

  public applyGraphicsSettings(settings: GameSettings) {
    const isMobileScreen =
      typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) <= 768;

    let maxDpr = 2;
    let enableShadows = true;

    if (settings.graphicsQuality === 'medium') {
      maxDpr = 1.0;
      enableShadows = false;
    } else if (settings.graphicsQuality === 'high') {
      maxDpr = isMobileScreen ? 1.25 : 1.5;
      enableShadows = true;
    } else {
      maxDpr = isMobileScreen ? 1.5 : 2.0;
      enableShadows = true;
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    this.renderer.shadowMap.enabled = enableShadows;
    if (this.track?.dirLight) {
      this.track.dirLight.castShadow = enableShadows;
    }
  }

  public cycleCamera(): 'chase' | 'hood' {
    this.cameraMode = this.cameraMode === 'chase' ? 'hood' : 'chase';
    return this.cameraMode;
  }

  public resetCar() {
    const targetSpawn = this.multiplayerSpawnPos ? this.multiplayerSpawnPos.clone() : new THREE.Vector3(0, 0.64, 10);
    this.vehiclePhysics.resetPosition(targetSpawn);
    this.lastSkidPos.copy(this.vehiclePhysics.position);
  }

  public shiftGearUp() {
    if (this.vehiclePhysics.shiftUp()) {
      this.onGearShiftCallback?.(true);
    }
  }

  public shiftGearDown() {
    if (this.vehiclePhysics.shiftDown()) {
      this.onGearShiftCallback?.(false);
    }
  }

  // Dual Rear Exhaust Nitro Jet Flames (Positioned at Ferrari triple-exhaust rear at -Z!)
  private setupNitroFlames() {
    if (this.nitroFlameL) this.carMeshes.root.remove(this.nitroFlameL);
    if (this.nitroFlameR) this.carMeshes.root.remove(this.nitroFlameR);
    if (this.nitroCoreL) this.carMeshes.root.remove(this.nitroCoreL);
    if (this.nitroCoreR) this.carMeshes.root.remove(this.nitroCoreR);

    const flameGeo = new THREE.ConeGeometry(0.11, 0.72, 12);
    flameGeo.rotateX(-Math.PI / 2); // Tip points backward (-Z) behind exhaust!

    const coreGeo = new THREE.ConeGeometry(0.055, 0.42, 10);
    coreGeo.rotateX(-Math.PI / 2);

    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xe879f9,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.nitroFlameL = new THREE.Mesh(flameGeo, flameMat);
    this.nitroFlameL.position.set(-0.14, 0.28, -2.32);
    this.nitroFlameL.visible = false;

    this.nitroFlameR = new THREE.Mesh(flameGeo, flameMat);
    this.nitroFlameR.position.set(0.14, 0.28, -2.32);
    this.nitroFlameR.visible = false;

    this.nitroCoreL = new THREE.Mesh(coreGeo, coreMat);
    this.nitroCoreL.position.set(-0.14, 0.28, -2.22);
    this.nitroCoreL.visible = false;

    this.nitroCoreR = new THREE.Mesh(coreGeo, coreMat);
    this.nitroCoreR.position.set(0.14, 0.28, -2.22);
    this.nitroCoreR.visible = false;

    this.carMeshes.root.add(this.nitroFlameL, this.nitroFlameR, this.nitroCoreL, this.nitroCoreR);
  }

  // Interactive Braking Taillights (Positioned on Rear Lamps at -Z!)
  private setupTaillights() {
    if (this.taillightL && this.taillightR) {
      this.carMeshes.root.remove(this.taillightL, this.taillightR);
    }

    const tailGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.04, 16);
    tailGeo.rotateX(Math.PI / 2);

    this.taillightMat = new THREE.MeshStandardMaterial({
      color: 0x880015,
      emissive: 0x440008,
      emissiveIntensity: 0.4,
      roughness: 0.2
    });

    this.taillightL = new THREE.Mesh(tailGeo, this.taillightMat);
    this.taillightL.position.set(-0.62, 0.72, -1.96);

    this.taillightR = new THREE.Mesh(tailGeo, this.taillightMat);
    this.taillightR.position.set(0.62, 0.72, -1.96);

    this.carMeshes.root.add(this.taillightL, this.taillightR);
  }

  // Dynamic Tire Skid Mark Trails
  private setupSkidMarkPool() {
    const skidGeo = new THREE.PlaneGeometry(0.32, 1.45);
    skidGeo.rotateX(-Math.PI / 2);

    const skidMat = new THREE.MeshBasicMaterial({
      color: 0x0e0f14,
      transparent: true,
      opacity: 0.52,
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

    for (const side of [-0.78, 0.78]) {
      const mark = this.skidMarkMeshes[this.skidPoolIndex];
      this.skidPoolIndex = (this.skidPoolIndex + 1) % this.maxSkids;

      // Vehicle height when grounded is roadSurfaceY + 0.42 -> place tire marks +0.025m cleanly above asphalt
      mark.position.set(pos.x + rightX * side, pos.y - 0.39, pos.z + rightZ * side);
      mark.rotation.y = heading;
      mark.visible = true;
    }
  }

  private setupDamageSmoke() {
    this.smokeMat = new THREE.MeshStandardMaterial({
      color: 0xdde2e6,
      transparent: true,
      opacity: 0.45,
      roughness: 0.9
    });
    this.smokeGeo = new THREE.SphereGeometry(0.25, 8, 8);

    for (let i = 0; i < 5; i++) {
      const puff = new THREE.Mesh(this.smokeGeo, this.smokeMat);
      puff.visible = false;
      this.scene.add(puff);
      this.damageSmokePuffs.push(puff);
    }
  }

  private setupDriftSmokeAndSparks() {
    this.driftSmokeGeo = new THREE.SphereGeometry(0.28, 7, 7);
    this.driftSmokeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.36,
      roughness: 1.0,
      depthWrite: false
    });

    for (let i = 0; i < 18; i++) {
      const mesh = new THREE.Mesh(this.driftSmokeGeo, this.driftSmokeMat.clone());
      mesh.visible = false;
      this.scene.add(mesh);
      this.driftSmokePool.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 0.65 });
    }

    this.sparkGeo = new THREE.BoxGeometry(0.06, 0.06, 0.28);
    this.sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, this.sparkMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.sparkPool.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 0.45 });
    }
  }

  private setupGhostCar(carConfig: SuperCarConfig) {
    const saved = loadSavedGhost();
    this.savedGhostFrames = saved?.frames || null;

    this.ghostMeshes = createSportsCar(carConfig, undefined, { isGhost: true });
    const label = saved ? `BEST LAP • ${(saved.lapMs / 1000).toFixed(1)}s` : 'APEX PACE RIVAL';
    const plate = createPlayerNameplate(label, '#00e5ff');
    plate.scale.set(2.8, 0.7, 1.0);
    this.ghostMeshes.root.add(plate);
    this.ghostMeshes.root.position.set(-2.5, 0.64, 14);
    this.scene.add(this.ghostMeshes.root);
  }

  private setupTunnelHeadlight() {
    this.tunnelHeadlight = new THREE.PointLight(0xe0f7ff, 0, 52, 1.4);
    this.tunnelHeadlight.position.set(0, 1.2, 6.0);
    this.carMeshes.root.add(this.tunnelHeadlight);
  }

  private spawnDriftSmoke(pos: THREE.Vector3, heading: number) {
    const rightX = Math.cos(heading);
    const rightZ = -Math.sin(heading);
    const backX = -Math.sin(heading);
    const backZ = -Math.cos(heading);

    for (const side of [-0.78, 0.78]) {
      const slot = this.driftSmokePool.find((p) => p.life <= 0);
      if (!slot) break;
      slot.life = slot.maxLife;
      slot.mesh.position.set(
        pos.x + rightX * side + backX * 1.45,
        pos.y - 0.12,
        pos.z + rightZ * side + backZ * 1.45
      );
      slot.mesh.scale.setScalar(0.55);
      slot.vel.set((Math.random() - 0.5) * 1.8, 1.1 + Math.random() * 0.8, (Math.random() - 0.5) * 1.8);
      (slot.mesh.material as THREE.MeshStandardMaterial).opacity = 0.36;
      slot.mesh.visible = true;
    }
  }

  private spawnCollisionSparks(worldPos: THREE.Vector3, intensity: number = 1.0) {
    const count = Math.min(12, Math.max(4, Math.round(intensity * 10)));
    let spawned = 0;
    for (let i = 0; i < this.sparkPool.length && spawned < count; i++) {
      const sp = this.sparkPool[i];
      if (sp.life > 0) continue;
      sp.life = 0.28 + Math.random() * 0.18;
      sp.maxLife = sp.life;
      sp.mesh.position.set(worldPos.x, worldPos.y + 0.35, worldPos.z);
      sp.vel.set(
        (Math.random() - 0.5) * 14 * Math.max(0.5, intensity),
        3.5 + Math.random() * 6.5,
        (Math.random() - 0.5) * 14 * Math.max(0.5, intensity)
      );
      sp.mesh.visible = true;
      spawned++;
    }
  }

  private updateParticles(delta: number) {
    for (let i = 0; i < this.driftSmokePool.length; i++) {
      const p = this.driftSmokePool[i];
      if (p.life <= 0) continue;
      p.life -= delta;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.mesh.position.addScaledVector(p.vel, delta);
      const t = 1.0 - p.life / p.maxLife;
      p.mesh.scale.setScalar(0.55 + t * 2.1);
      (p.mesh.material as THREE.MeshStandardMaterial).opacity = (1.0 - t) * 0.34;
    }

    for (let i = 0; i < this.sparkPool.length; i++) {
      const sp = this.sparkPool[i];
      if (sp.life <= 0) continue;
      sp.life -= delta;
      if (sp.life <= 0) {
        sp.mesh.visible = false;
        continue;
      }
      sp.vel.y -= 18.0 * delta;
      sp.mesh.position.addScaledVector(sp.vel, delta);
      sp.mesh.lookAt(
        sp.mesh.position.x + sp.vel.x,
        sp.mesh.position.y + sp.vel.y,
        sp.mesh.position.z + sp.vel.z
      );
    }
  }

  private updateGhostCar(delta: number, telemetry: VehicleTelemetry, isCountdownLocked: boolean) {
    if (!this.ghostMeshes) return;
    if (this.isMultiplayerActive) {
      this.ghostMeshes.root.visible = false;
      return;
    }

    this.ghostMeshes.root.visible = true;

    if (isCountdownLocked) {
      if (this.savedGhostFrames && this.savedGhostFrames.length > 0) {
        const f = this.savedGhostFrames[0];
        this.ghostMeshes.root.position.set(f.x, f.y, f.z);
        this.ghostMeshes.root.rotation.set(f.pitch, f.yaw, f.roll, 'YXZ');
      } else {
        const pt = this.track.splineCurve.getPoint(0.004);
        const tang = this.track.splineCurve.getTangent(0.004);
        const binorm = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0, 1, 0)).normalize();
        const pos = pt.clone().addScaledVector(binorm, -2.6);
        this.ghostMeshes.root.position.set(pos.x, pos.y + 0.64, pos.z);
        this.ghostMeshes.root.rotation.set(0, Math.atan2(tang.x, tang.z), 0, 'YXZ');
      }
      return;
    }

    // Record player's active lap trajectory every 100ms (capped cleanly at 2500 samples)
    if (
      (telemetry.lapTimeMs || 0) < 250 &&
      this.ghostRecordingFrames.length > 10 &&
      this.ghostRecordingFrames[this.ghostRecordingFrames.length - 1].timeMs > 2000
    ) {
      this.ghostRecordingFrames = [];
    }
    this.ghostSampleTimer += delta;
    if (this.ghostSampleTimer >= 0.1 && this.ghostRecordingFrames.length < 2500) {
      this.ghostSampleTimer = 0;
      this.ghostRecordingFrames.push({
        timeMs: telemetry.lapTimeMs || 0,
        x: Number(this.vehiclePhysics.position.x.toFixed(2)),
        y: Number(this.vehiclePhysics.position.y.toFixed(2)),
        z: Number(this.vehiclePhysics.position.z.toFixed(2)),
        yaw: Number(this.vehiclePhysics.rotation.y.toFixed(3)),
        pitch: Number(this.vehiclePhysics.rotation.x.toFixed(3)),
        roll: Number(this.vehiclePhysics.rotation.z.toFixed(3))
      });
    }

    if (this.vehiclePhysics.didCompleteLap) {
      if (this.vehiclePhysics.didSetBestLap || !this.savedGhostFrames) {
        this.savedGhostFrames = [...this.ghostRecordingFrames];
        saveBestGhost(
          this.vehiclePhysics.lastCompletedLapMs,
          this.currentCarConfig.id,
          this.savedGhostFrames
        );
      }
      this.ghostRecordingFrames = [];
    }

    if (this.savedGhostFrames && this.savedGhostFrames.length > 2) {
      const targetTime = telemetry.lapTimeMs || 0;
      const frames = this.savedGhostFrames;
      // Binary search current frame bracket
      let lo = 0;
      let hi = frames.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (frames[mid].timeMs <= targetTime) lo = mid;
        else hi = mid;
      }
      const a = frames[lo];
      const b = frames[hi];
      const span = Math.max(1, b.timeMs - a.timeMs);
      const alpha = THREE.MathUtils.clamp((targetTime - a.timeMs) / span, 0, 1);

      this.ghostMeshes.root.position.set(
        THREE.MathUtils.lerp(a.x, b.x, alpha),
        THREE.MathUtils.lerp(a.y, b.y, alpha),
        THREE.MathUtils.lerp(a.z, b.z, alpha)
      );
      this.ghostMeshes.root.rotation.set(
        THREE.MathUtils.lerp(a.pitch, b.pitch, alpha),
        THREE.MathUtils.lerp(a.yaw, b.yaw, alpha),
        THREE.MathUtils.lerp(a.roll, b.roll, alpha),
        'YXZ'
      );
    } else {
      // Built-in AI Pace Car (~195 km/h circuit pace) when player hasn't recorded a full lap yet
      this.ghostPaceT = (this.ghostPaceT + 0.0042 * delta) % 1.0;
      const pt = this.track.splineCurve.getPoint(this.ghostPaceT);
      const tang = this.track.splineCurve.getTangent(this.ghostPaceT);
      const binorm = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0, 1, 0)).normalize();
      const pos = pt.clone().addScaledVector(binorm, -2.6);
      this.ghostMeshes.root.position.set(pos.x, pos.y + 0.64, pos.z);
      this.ghostMeshes.root.rotation.set(
        -Math.asin(THREE.MathUtils.clamp(tang.y, -0.4, 0.4)),
        Math.atan2(tang.x, tang.z),
        0,
        'YXZ'
      );
    }
  }

  public setCar(carConfig: SuperCarConfig) {
    this.currentCarConfig = carConfig;
    this.vehiclePhysics.applyCarConfig(carConfig);

    if (this.tunnelHeadlight) {
      this.carMeshes.root.remove(this.tunnelHeadlight);
    }
    this.scene.remove(this.carMeshes.root);
    this.carMeshes = createSportsCar(carConfig, (loadedMeshes) => {
      if (this.isDisposed) return;
      this.carMeshes = loadedMeshes;
      this.setupNitroFlames();
      this.setupTaillights();
      if (this.tunnelHeadlight) this.carMeshes.root.add(this.tunnelHeadlight);
    });
    this.scene.add(this.carMeshes.root);
    this.setupNitroFlames();
    this.setupTaillights();
    if (this.tunnelHeadlight) this.carMeshes.root.add(this.tunnelHeadlight);
  }

  public syncOpponents(opponents: RemotePlayerState[]) {
    const activeIds = new Set(opponents.map((o) => o.id));

    this.opponentCars.forEach((entity, id) => {
      if (!activeIds.has(id)) {
        this.scene.remove(entity.meshes.root);
        entity.meshes.root.traverse((obj) => {
          if ((obj as THREE.Sprite).isSprite) {
            const sp = obj as THREE.Sprite;
            sp.material.map?.dispose();
            sp.material.dispose();
          }
        });
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

        meshes.root.position.set(...remotePlayer.position);
        meshes.root.quaternion.set(...remotePlayer.rotation);
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

  public triggerNfsImpact(normalX: number, normalZ: number, intensity: number = 1.0) {
    const dir = new THREE.Vector3(normalX, 0, normalZ);
    if (dir.lengthSq() > 0.0001) {
      dir.normalize();
    } else {
      dir.set(0, 0, 1);
    }
    this.crashImpulseDir.copy(dir);
    this.crashImpulseIntensity = THREE.MathUtils.clamp(intensity * 0.22, 0.1, 0.32);
    this.crashImpulseTimer = 0.28;
  }

  public update(
    delta: number,
    input: ControllerInput,
    isCountdownLocked: boolean = false
  ): VehicleTelemetry {
    // 1. Edge-Triggered Camera Switch ('C' or Mobile seq) — NEVER flickers or drops on UDP!
    let camTriggered = input.cameraSwitch && !this.prevCameraSwitch;
    this.prevCameraSwitch = input.cameraSwitch;
    if (typeof input.cameraSeq === 'number') {
      if (input.cameraSeq < this.lastCameraSeq) this.lastCameraSeq = input.cameraSeq;
      if (input.cameraSeq > this.lastCameraSeq) {
        this.lastCameraSeq = input.cameraSeq;
        camTriggered = true;
      }
    }
    if (camTriggered) {
      this.cycleCamera();
    }

    // 2. Edge-Triggered Manual Reset ('R' or Mobile seq)
    let shouldReset = input.reset && !this.prevReset;
    this.prevReset = input.reset;
    if (typeof input.resetSeq === 'number') {
      if (input.resetSeq < this.lastResetSeq) this.lastResetSeq = input.resetSeq;
      if (input.resetSeq > this.lastResetSeq) {
        this.lastResetSeq = input.resetSeq;
        shouldReset = true;
      }
    }

    // 2b. Edge-Triggered WebRTC Manual Gear Shift Sequences (handles reconnects & UDP packet loss cleanly)
    if (typeof input.shiftUpSeq === 'number') {
      if (input.shiftUpSeq < this.lastShiftUpSeq) this.lastShiftUpSeq = input.shiftUpSeq;
      if (input.shiftUpSeq > this.lastShiftUpSeq) {
        this.lastShiftUpSeq = input.shiftUpSeq;
        this.shiftGearUp();
      }
    }
    if (typeof input.shiftDownSeq === 'number') {
      if (input.shiftDownSeq < this.lastShiftDownSeq) this.lastShiftDownSeq = input.shiftDownSeq;
      if (input.shiftDownSeq > this.lastShiftDownSeq) {
        this.lastShiftDownSeq = input.shiftDownSeq;
        this.shiftGearDown();
      }
    }

    // 3. Stunt Ramp Lip Launch (Strict OBB deck trigger at ramp kicker lip)
    if (!isCountdownLocked && !this.vehiclePhysics.isAirborne && this.vehiclePhysics.speedKmh > 52) {
      for (const ramp of this.track.ramps) {
        const dx = this.vehiclePhysics.position.x - ramp.position.x;
        const dz = this.vehiclePhysics.position.z - ramp.position.z;
        const localSide = dx * ramp.binormal.x + dz * ramp.binormal.z;
        const localFwd = dx * ramp.tangent.x + dz * ramp.tangent.z;

        if (
          Math.abs(localSide) < ramp.width * 0.56 &&
          localFwd > ramp.length * 0.14 &&
          localFwd < ramp.length * 0.58
        ) {
          const upwardImpulse = Math.min(20, 12.0 + (this.vehiclePhysics.speedKmh / 200) * 8);
          this.vehiclePhysics.launchRamp(upwardImpulse);
          break;
        }
      }
    }

    // 4. Advance Vehicle Physics (with Asphalt 9 cinematic slow-mo time dilation during ramp jumps!)
    const simDelta = this.vehiclePhysics.isJumping ? delta * 0.72 : delta;
    const telemetry = this.vehiclePhysics.update(
      simDelta,
      { ...input, reset: shouldReset },
      (x, z) => this.track.getElevationAt(x, z),
      (x, z) => this.track.getClosestSplinePoint(x, z),
      isCountdownLocked
    );
    telemetry.cameraMode = this.cameraMode;

    if (this.vehiclePhysics.didAutoShiftUp) {
      this.onGearShiftCallback?.(true);
    } else if (this.vehiclePhysics.didAutoShiftDown) {
      this.onGearShiftCallback?.(false);
    }

    // Play celebratory drift bank chime when player nails a clean drift combo
    if (this.vehiclePhysics.didJustBankDrift) {
      this.onDriftBankCallback?.(this.vehiclePhysics.lastBankedDrift);
    }

    // Touchdown suspension compression & dust/spark burst after big airtime
    if (telemetry.didJustLand) {
      const strength = this.vehiclePhysics.lastLandingStrength;
      this.triggerNfsImpact(0, 1, 0.55 + strength * 0.45);
      this.onCrashCallback?.(0.24 + strength * 0.2);
      this.spawnDriftSmoke(this.vehiclePhysics.position, this.vehiclePhysics.rotation.y);
      this.spawnCollisionSparks(this.vehiclePhysics.position, strength * 0.6);
    }

    // 5. Guardrail Scrape Audio, Sparks & Visual Shake with 380ms Cooldown (Zero 60Hz Audio Glitch!)
    if (this.vehiclePhysics.hadBarrierCollision && this.vehiclePhysics.speedKmh > 12) {
      const now = performance.now();
      if (now - this.lastBarrierCrashSoundTime > 380) {
        this.lastBarrierCrashSoundTime = now;
        this.triggerNfsImpact(-Math.sign(input.steer || 1), 0, 0.4);
        this.onCrashCallback?.(0.35);
        this.spawnCollisionSparks(this.vehiclePhysics.position, 0.75);
      }
    }

    // 6. Sun Shadow Follow & Environmental Animations
    if (this.track) {
      this.track.update(delta);
      if (this.track.dirLight && this.renderer.shadowMap.enabled) {
        this.track.dirLight.position.set(
          this.vehiclePhysics.position.x + 80,
          this.vehiclePhysics.position.y + 120,
          this.vehiclePhysics.position.z + 60
        );
        this.track.dirLight.target.position.copy(this.vehiclePhysics.position);
        this.track.dirLight.target.updateMatrixWorld();
      }
    }

    // 7. Dynamic Civilian Traffic AI (Exact OBB Collisions + Sparks!)
    this.trafficStates = this.trafficManager.update(
      simDelta,
      this.vehiclePhysics.position,
      this.vehiclePhysics.speedKmh,
      (normalX, normalZ, impactSpeedKmh, hitPos) => {
        this.vehiclePhysics.applyObstacleCollision(normalX, normalZ, impactSpeedKmh);
        this.triggerNfsImpact(normalX, normalZ, impactSpeedKmh / 120);
        this.onCrashCallback?.(impactSpeedKmh / 95);
        this.spawnCollisionSparks(hitPos, Math.max(0.6, impactSpeedKmh / 110));
      },
      () => {
        this.nearMissActive = true;
        this.nearMissTimer = 1.25;
        this.vehiclePhysics.nitroFuel = Math.min(100, this.vehiclePhysics.nitroFuel + 30);
      }
    );

    if (this.nearMissTimer > 0) {
      this.nearMissTimer -= delta;
      if (this.nearMissTimer <= 0) {
        this.nearMissActive = false;
      }
    }

    // 8. Remote Multiplayer Opponents Interpolation + Anti-Overlap Car Separation
    this.opponentCars.forEach((opp, oppId) => {
      opp.meshes.root.position.lerp(opp.targetPos, Math.min(1, delta * 15));
      opp.meshes.root.quaternion.slerp(opp.targetQuat, Math.min(1, delta * 15));

      const spin = ((opp.currentSpeed * delta) / 0.35) * opp.meshes.wheelSpinSign;
      opp.meshes.wheels.forEach((w) => {
        w.rotation.x += spin;
      });

      // Keep multiplayer cars cleanly separated side-by-side (never overlap at the same road spot)
      const dx = this.vehiclePhysics.position.x - opp.meshes.root.position.x;
      const dz = this.vehiclePhysics.position.z - opp.meshes.root.position.z;
      const absX = Math.abs(dx);
      const absZ = Math.abs(dz);
      if (absX < 2.4 && absZ < 4.4) {
        const tieSign = oppId < 'm' ? 1 : -1;
        const pushSign = absX > 0.05 ? Math.sign(dx) : tieSign;
        const pushMag = (2.45 - absX) * 0.45;
        const closest = this.track.getClosestSplinePoint(
          this.vehiclePhysics.position.x,
          this.vehiclePhysics.position.z
        );
        const candX = this.vehiclePhysics.position.x + pushSign * pushMag;
        if (Math.hypot(candX - closest.point.x, this.vehiclePhysics.position.z - closest.point.z) < 8.6) {
          this.vehiclePhysics.position.x = candX;
        }
      }
    });

    // 9. Sync 3D Player Car Mesh, Wheels, VFX, Tunnel Lights, Ghost & Smoke
    const { root, wheels, frontWheels, wheelSpinSign } = this.carMeshes;
    root.position.copy(this.vehiclePhysics.position);
    root.quaternion.copy(this.vehiclePhysics.quaternion);
    this.carMeshes.applyDamageVisuals(telemetry.health);

    if (this.tunnelHeadlight) {
      const tProg = telemetry.trackProgress || 0;
      const inTunnel = tProg >= 0.515 && tProg <= 0.615;
      this.tunnelHeadlight.intensity = THREE.MathUtils.lerp(
        this.tunnelHeadlight.intensity,
        inTunnel ? 16.0 : 0,
        Math.min(1, delta * 6)
      );
    }

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
          hoodWorldPos.x + Math.sin(idx * 2 + now) * 0.2,
          hoodWorldPos.y + phase * 1.2,
          hoodWorldPos.z + Math.cos(idx * 2 + now) * 0.2
        );
        puff.scale.setScalar(0.5 + phase * 1.2);
        this.smokeMat.opacity = Math.max(0, (1.0 - phase / 1.5) * (telemetry.health < 40 ? 0.7 : 0.35));
        this.smokeMat.color.setHex(telemetry.health < 40 ? 0x222225 : 0xdde2e6);
      });
    } else {
      this.damageSmokePuffs.forEach((puff) => {
        puff.visible = false;
      });
    }

    const forwardSpeed = this.vehiclePhysics.velocity.z;
    const wheelSpinRate = ((forwardSpeed * simDelta) / 0.35) * wheelSpinSign;
    wheels.forEach((wheel) => {
      wheel.rotation.x += wheelSpinRate;
    });
    frontWheels.forEach((wheel) => {
      wheel.rotation.y = -input.steer * 0.42;
    });

    // Dual Exhaust Nitro Jet Flame VFX (at Rear Pipes!)
    const isNitroFiring = !isCountdownLocked && input.nitro && telemetry.nitroFuel > 0 && input.throttle > 0.1;
    if (this.nitroFlameL && this.nitroFlameR && this.nitroCoreL && this.nitroCoreR) {
      this.nitroFlameL.visible = isNitroFiring;
      this.nitroFlameR.visible = isNitroFiring;
      this.nitroCoreL.visible = isNitroFiring;
      this.nitroCoreR.visible = isNitroFiring;

      if (isNitroFiring) {
        const flameLen = 0.85 + Math.random() * 0.65;
        this.nitroFlameL.scale.set(1, 1, flameLen);
        this.nitroFlameR.scale.set(1, 1, flameLen);
        this.nitroCoreL.scale.set(1, 1, flameLen * 0.85);
        this.nitroCoreR.scale.set(1, 1, flameLen * 0.85);
      }
    }

    // Curb rumble detection
    const closestTrackPt = this.track.getClosestSplinePoint(
      this.vehiclePhysics.position.x,
      this.vehiclePhysics.position.z
    );
    telemetry.isOnCurb = closestTrackPt.dist >= 8.0 && closestTrackPt.dist <= 9.6 && telemetry.speedKmh > 20;

    // Interactive Rear Taillights
    const isBraking = input.brake > 0.05 || input.handbrake || isCountdownLocked;
    if (this.taillightMat) {
      if (isBraking) {
        this.taillightMat.color.setHex(0xff1122);
        this.taillightMat.emissive.setHex(0xff0022);
        this.taillightMat.emissiveIntensity = 3.5;
      } else {
        this.taillightMat.color.setHex(0x880015);
        this.taillightMat.emissive.setHex(0x440008);
        this.taillightMat.emissiveIntensity = 0.4;
      }
    }

    // Tire Skid Marks + Drift Tire Smoke
    const isSkidding =
      !isCountdownLocked &&
      (telemetry.isDrifting || input.handbrake || (input.brake > 0.35 && telemetry.speedKmh > 40)) &&
      !telemetry.isAirborne;
    if (isSkidding) {
      const movedDist = this.vehiclePhysics.position.distanceTo(this.lastSkidPos);
      if (movedDist > 1.15) {
        this.addSkidMark(this.vehiclePhysics.position, this.vehiclePhysics.rotation.y);
        this.lastSkidPos.copy(this.vehiclePhysics.position);
      }

      this.driftSmokeCooldown -= delta;
      if (this.driftSmokeCooldown <= 0 && telemetry.speedKmh > 25) {
        this.driftSmokeCooldown = 0.055;
        this.spawnDriftSmoke(this.vehiclePhysics.position, this.vehiclePhysics.rotation.y);
      }
    }

    this.updateParticles(delta);
    this.updateGhostCar(simDelta, telemetry, isCountdownLocked);

    // 10. Dynamic Camera & Sky Follow
    this.updateCamera(delta, telemetry, input);
    this.skyDome.position.copy(this.camera.position);

    // 11. Render Frame
    this.renderer.render(this.scene, this.camera);

    return telemetry;
  }

  private updateCamera(delta: number, telemetry: VehicleTelemetry, input: ControllerInput) {
    const carPos = this.vehiclePhysics.position;
    const heading = this.vehiclePhysics.rotation.y - this.vehiclePhysics.driftYawAngle * 0.55;

    const forwardX = Math.sin(heading);
    const forwardZ = Math.cos(heading);

    const speedRatio = Math.min(1, telemetry.speedKmh / 280);
    const targetFov = telemetry.isJumping
      ? 78
      : this.baseFov + speedRatio * 15 + (input.nitro && telemetry.nitroFuel > 0 ? 7 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, delta * 6);
    this.camera.updateProjectionMatrix();

    if (telemetry.isJumping) {
      this.isLetterboxed = true;
      this.smoothJumpTilt = THREE.MathUtils.lerp(this.smoothJumpTilt, 0.24, Math.min(1, delta * 7));
      this.camera.up.set(Math.sin(this.smoothJumpTilt), Math.cos(this.smoothJumpTilt), 0).normalize();
      const sideAngle = heading + 0.58;
      const jumpCamPos = new THREE.Vector3(
        carPos.x + Math.sin(sideAngle) * 5.8,
        carPos.y + 0.7,
        carPos.z + Math.cos(sideAngle) * 5.8
      );
      this.camera.position.lerp(jumpCamPos, Math.min(1, delta * 8));
      this.cameraTarget.copy(carPos).add(new THREE.Vector3(0, 0.5, 0));
      this.camera.lookAt(this.cameraTarget);
      return;
    }

    this.smoothJumpTilt = THREE.MathUtils.lerp(this.smoothJumpTilt, 0, Math.min(1, delta * 12));
    this.camera.up.set(Math.sin(this.smoothJumpTilt), Math.cos(this.smoothJumpTilt), 0).normalize();
    this.isLetterboxed = false;

    if (this.cameraMode === 'hood') {
      const carHeading = this.vehiclePhysics.rotation.y;
      const carFwdX = Math.sin(carHeading);
      const carFwdZ = Math.cos(carHeading);
      const hoodPos = new THREE.Vector3(
        carPos.x + carFwdX * 1.1,
        carPos.y + 1.05,
        carPos.z + carFwdZ * 1.1
      );
      this.camera.position.copy(hoodPos);

      const lookTarget = new THREE.Vector3(
        carPos.x + carFwdX * 35,
        carPos.y + 0.95,
        carPos.z + carFwdZ * 35
      );
      this.camera.lookAt(lookTarget);
    } else {
      const driftOffset = telemetry.isDrifting ? -input.steer * 0.85 : 0;
      const rightX = forwardZ;
      const rightZ = -forwardX;

      const camDistance = input.nitro && telemetry.nitroFuel > 0 ? 7.1 : 6.4;
      const idealCamPos = new THREE.Vector3(
        carPos.x - forwardX * camDistance + rightX * driftOffset,
        carPos.y + 2.15,
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

    if (this.crashImpulseTimer > 0) {
      this.crashImpulseTimer -= delta;
      const progress = 1.0 - this.crashImpulseTimer / 0.28;
      const spring = Math.sin(progress * Math.PI * 3.5) * (1.0 - progress) * this.crashImpulseIntensity;
      this.camera.position.x += this.crashImpulseDir.x * spring;
      this.camera.position.z += this.crashImpulseDir.z * spring;
      this.camera.fov -= spring * 4.2;
      this.camera.updateProjectionMatrix();
    }
  }

  public handleResize() {
    const container = this.canvas.parentElement;
    const width = container?.clientWidth || this.canvas.clientWidth || window.innerWidth;
    const height = container?.clientHeight || this.canvas.clientHeight || window.innerHeight;
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  public dispose() {
    this.isDisposed = true;

    this.damageSmokePuffs.forEach((puff) => this.scene.remove(puff));
    this.smokeGeo?.dispose();
    this.smokeMat?.dispose();

    this.driftSmokePool.forEach((p) => {
      this.scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    });
    this.driftSmokePool = [];
    this.driftSmokeGeo?.dispose();
    this.driftSmokeMat?.dispose();

    this.sparkPool.forEach((sp) => this.scene.remove(sp.mesh));
    this.sparkPool = [];
    this.sparkGeo?.dispose();
    this.sparkMat?.dispose();

    if (this.ghostMeshes) {
      this.scene.remove(this.ghostMeshes.root);
      this.ghostMeshes.root.traverse((obj) => {
        if ((obj as THREE.Sprite).isSprite) {
          const sp = obj as THREE.Sprite;
          sp.material.map?.dispose();
          sp.material.dispose();
        }
      });
      this.ghostMeshes = null;
    }

    if (this.skidMarkMeshes.length > 0) {
      this.skidMarkMeshes[0].geometry.dispose();
      (this.skidMarkMeshes[0].material as THREE.Material).dispose();
      this.skidMarkMeshes.forEach((m) => this.scene.remove(m));
      this.skidMarkMeshes = [];
    }

    this.opponentCars.forEach((entity) => {
      this.scene.remove(entity.meshes.root);
      entity.meshes.root.traverse((obj) => {
        if ((obj as THREE.Sprite).isSprite) {
          const sp = obj as THREE.Sprite;
          sp.material.map?.dispose();
          sp.material.dispose();
        }
      });
    });
    this.opponentCars.clear();

    this.trafficManager.dispose();
    this.track.dispose();

    this.scene.remove(this.skyDome);
    this.skyDome.geometry.dispose();
    (this.skyDome.material as THREE.Material).dispose();

    this.envTexture?.dispose();
    this.renderer.dispose();
  }
}
