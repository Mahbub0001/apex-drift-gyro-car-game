import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TrafficCarState } from '../../types';

interface TrafficEntity {
  id: string;
  type: 'sedan' | 'suv' | 'truck' | 'van' | 'taxi';
  mesh: THREE.Group;
  tailMat: THREE.MeshBasicMaterial | null;
  t: number;             // Position along spline [0, 1]
  baseSpeed: number;     // Speed along spline
  speed: number;
  laneOffset: number;    // Offset from center line (-5.6 to +5.6)
  color: number;
  width: number;
  length: number;
  height: number;
  hasTriggeredNearMiss: boolean;
  lateralImpulse: number;
  brakeFlashTimer: number;
  lastCollisionTime: number;
}

export class TrafficManager {
  public scene: THREE.Scene;
  public splineCurve: THREE.CatmullRomCurve3;
  public trafficList: TrafficEntity[] = [];
  public trafficStates: TrafficCarState[] = [];

  private trafficColors = [
    0x0a192f, // Midnight Metallic Navy
    0x800f2f, // Deep Wine / Cherry Red
    0xced4da, // Silver Metallic
    0x212529, // Obsidian Black
    0xffffff, // Alpine White
    0x495057  // Graphite Grey
  ];

  private templates: Map<string, THREE.Group> = new Map();
  private gltfLoader = new GLTFLoader();
  private upVec = new THREE.Vector3(0, 1, 0);
  private reusableBinormal = new THREE.Vector3();
  private reusableWorldPos = new THREE.Vector3();
  private reusableEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  constructor(scene: THREE.Scene, splineCurve: THREE.CatmullRomCurve3) {
    this.scene = scene;
    this.splineCurve = splineCurve;

    this.preloadModels().then(() => {
      this.applyTemplatesToTraffic();
    });

    this.spawnInitialTraffic();
  }

  private async preloadModels(): Promise<void> {
    const models: { type: string; url: string }[] = [
      { type: 'sedan', url: '/models/sedan.glb' },
      { type: 'taxi', url: '/models/taxi.glb' },
      { type: 'van', url: '/models/delivery.glb' },
      { type: 'truck', url: '/models/truck.glb' }
    ];

    const promises = models.map(
      (m) =>
        new Promise<void>((resolve) => {
          this.gltfLoader.load(
            m.url,
            (gltf) => {
              const root = gltf.scene;
              root.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                  child.castShadow = true;
                  child.receiveShadow = true;
                  const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                  if (mat && mat.isMeshStandardMaterial) {
                    mat.roughness = Math.min(mat.roughness, 0.42);
                    mat.metalness = Math.max(mat.metalness, 0.25);
                  }
                }
              });
              this.templates.set(m.type, root);
              resolve();
            },
            undefined,
            (err) => {
              console.warn(`[TrafficManager] Error loading ${m.url}:`, err);
              resolve();
            }
          );
        })
    );

    await Promise.all(promises);
  }

  private buildCarFromTemplate(
    type: string,
    color: number
  ): { mesh: THREE.Group; tailMat: THREE.MeshBasicMaterial; width: number; length: number; height: number } {
    const group = new THREE.Group();
    let template = this.templates.get(type);

    if (!template) {
      if (type === 'suv') template = this.templates.get('truck') || this.templates.get('sedan');
      else template = this.templates.get('sedan');
    }

    let width = 2.0;
    let length = 4.6;
    let height = 1.45;

    if (type === 'van') {
      width = 2.4;
      length = 5.4;
      height = 2.45;
    } else if (type === 'truck' || type === 'suv') {
      width = 2.3;
      length = 4.9;
      height = 1.85;
    } else if (type === 'taxi') {
      width = 2.2;
      length = 4.6;
      height = 2.1;
    }

    if (template) {
      const cloned = template.clone(true);
      cloned.scale.set(1.65, 1.65, 1.65);

      if (type !== 'taxi') {
        cloned.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && child.name.toLowerCase().includes('body')) {
            const mesh = child as THREE.Mesh;
            const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
            mat.color.setHex(color);
            mesh.material = mat;
          }
        });
      }

      group.add(cloned);
    } else {
      const placeholderGeo = new THREE.BoxGeometry(width, height * 0.6, length);
      const placeholderMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.7 });
      const box = new THREE.Mesh(placeholderGeo, placeholderMat);
      box.position.y = height * 0.3;
      group.add(box);
    }

    // Glowing Headlights & Taillights
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff8e7 });
    const headGeo = new THREE.SphereGeometry(0.11, 8, 8);
    const headL = new THREE.Mesh(headGeo, headMat);
    headL.position.set(-width * 0.36, height * 0.36, length * 0.46);
    const headR = headL.clone();
    headR.position.x = width * 0.36;
    group.add(headL, headR);

    const tailMat = new THREE.MeshBasicMaterial({ color: 0xaa001c });
    const tailGeo = new THREE.BoxGeometry(0.32, 0.1, 0.05);
    const tailL = new THREE.Mesh(tailGeo, tailMat);
    tailL.position.set(-width * 0.36, height * 0.4, -length * 0.46);
    const tailR = tailL.clone();
    tailR.position.x = width * 0.36;
    group.add(tailL, tailR);

    return { mesh: group, tailMat, width, length, height };
  }

  private applyTemplatesToTraffic() {
    this.trafficList.forEach((car) => {
      while (car.mesh.children.length > 0) {
        car.mesh.remove(car.mesh.children[0]);
      }

      const { mesh, tailMat, width, length, height } = this.buildCarFromTemplate(car.type, car.color);
      while (mesh.children.length > 0) {
        car.mesh.add(mesh.children[0]);
      }
      car.tailMat = tailMat;
      car.width = width;
      car.length = length;
      car.height = height;
    });
  }

  private orientMeshAlongTangent(mesh: THREE.Group, tangent: THREE.Vector3) {
    const yaw = Math.atan2(tangent.x, tangent.z);
    const pitch = -Math.asin(THREE.MathUtils.clamp(tangent.y, -0.98, 0.98));
    this.reusableEuler.set(pitch, yaw, 0, 'YXZ');
    mesh.quaternion.setFromEuler(this.reusableEuler);
  }

  private spawnInitialTraffic() {
    const lanes = [-5.6, -1.9, 1.9, 5.6];
    const types: ('sedan' | 'taxi' | 'van' | 'truck')[] = [
      'sedan', 'taxi', 'van', 'truck', 'sedan', 'taxi', 'van', 'truck', 'sedan', 'taxi'
    ];

    const numTraffic = 16;

    for (let i = 0; i < numTraffic; i++) {
      const type = types[i % types.length];
      const color = this.trafficColors[i % this.trafficColors.length];
      const { mesh, tailMat, width, length, height } = this.buildCarFromTemplate(type, color);

      const t = 0.03 + (i / numTraffic) * 0.92;
      const lane = lanes[i % lanes.length];
      const baseSpeed = 0.0012 + (i % 3) * 0.0004;

      const curvePoint = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      this.reusableBinormal.crossVectors(tangent, this.upVec).normalize();

      const worldPos = curvePoint.clone().addScaledVector(this.reusableBinormal, lane);
      worldPos.y = curvePoint.y + 0.22;
      mesh.position.copy(worldPos);
      this.orientMeshAlongTangent(mesh, tangent);

      this.scene.add(mesh);

      this.trafficList.push({
        id: `traffic-${i}`,
        type,
        mesh,
        tailMat,
        t,
        baseSpeed,
        speed: baseSpeed,
        laneOffset: lane,
        color,
        width,
        length,
        height,
        hasTriggeredNearMiss: false,
        lateralImpulse: 0,
        brakeFlashTimer: 0,
        lastCollisionTime: 0
      });
    }
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    playerSpeedKmh: number,
    onCollision: (normalX: number, normalZ: number, impactSpeedKmh: number, hitPos: THREE.Vector3) => void,
    onNearMiss: () => void
  ): TrafficCarState[] {
    const states: TrafficCarState[] = [];
    const now = performance.now();

    for (let i = 0; i < this.trafficList.length; i++) {
      const car = this.trafficList[i];
      car.speed = THREE.MathUtils.lerp(car.speed, car.baseSpeed, Math.min(1, delta * 1.4));
      car.lateralImpulse = THREE.MathUtils.lerp(car.lateralImpulse, 0, Math.min(1, delta * 2.5));
      if (car.brakeFlashTimer > 0) {
        car.brakeFlashTimer = Math.max(0, car.brakeFlashTimer - delta);
        if (car.tailMat) car.tailMat.color.setHex(0xff1a2d);
      } else if (car.tailMat) {
        car.tailMat.color.setHex(0x880015);
      }

      car.t = (car.t + car.speed * delta) % 1.0;
      if (car.t < 0) car.t += 1.0;

      const curvePoint = this.splineCurve.getPoint(car.t);
      const tangent = this.splineCurve.getTangent(car.t);
      this.reusableBinormal.crossVectors(tangent, this.upVec).normalize();

      const effectiveLane = THREE.MathUtils.clamp(car.laneOffset + car.lateralImpulse, -6.4, 6.4);
      this.reusableWorldPos.copy(curvePoint).addScaledVector(this.reusableBinormal, effectiveLane);
      this.reusableWorldPos.y = curvePoint.y + 0.22;
      car.mesh.position.copy(this.reusableWorldPos);
      this.orientMeshAlongTangent(car.mesh, tangent);

      // True Oriented Bounding Box (OBB) check in car's local (tangent, binormal) frame!
      const dx = playerPos.x - this.reusableWorldPos.x;
      const dy = Math.abs(playerPos.y - this.reusableWorldPos.y);
      const dz = playerPos.z - this.reusableWorldPos.z;

      const distSq = dx * dx + dz * dz;
      const halfW = (car.width + 1.8) * 0.5;
      const halfL = (car.length + 4.1) * 0.5;

      // Project offset onto traffic car's local forward & side axes (flat XZ plane)
      const tLen = Math.hypot(tangent.x, tangent.z) || 1;
      const fwdX = tangent.x / tLen;
      const fwdZ = tangent.z / tLen;
      const sideX = this.reusableBinormal.x;
      const sideZ = this.reusableBinormal.z;

      const localFwd = dx * fwdX + dz * fwdZ;
      const localSide = dx * sideX + dz * sideZ;

      if (Math.abs(localSide) < halfW && Math.abs(localFwd) < halfL && dy < 2.2) {
        if (!car.lastCollisionTime || now - car.lastCollisionTime > 850) {
          car.lastCollisionTime = now;

          // Compute accurate push-out normal in world XZ
          const len = Math.sqrt(distSq) || 1;
          const normalX = dx / len;
          const normalZ = dz / len;

          // Realistic momentum reaction (small bounded bump if rear-ended, braking recovery otherwise — never rocket-launching!)
          if (localFwd < -0.5) {
            car.speed = Math.min(car.baseSpeed * 1.45, car.speed + 0.0005);
          } else {
            car.speed = car.baseSpeed * 0.45;
          }
          car.brakeFlashTimer = 1.4;
          car.lateralImpulse += localSide >= 0 ? -1.8 : 1.8;

          onCollision(normalX, normalZ, playerSpeedKmh, this.reusableWorldPos);
        }
      } else if (distSq < 18.0 && !car.hasTriggeredNearMiss && playerSpeedKmh > 75 && dy < 2.5) {
        car.hasTriggeredNearMiss = true;
        onNearMiss();
      }

      if (distSq > 324) {
        car.hasTriggeredNearMiss = false;
      }

      states.push({
        id: car.id,
        type: car.type,
        position: [this.reusableWorldPos.x, this.reusableWorldPos.y, this.reusableWorldPos.z],
        rotation: [car.mesh.rotation.x, car.mesh.rotation.y, car.mesh.rotation.z],
        speed: Math.round(car.speed * 2500 * 3.6),
        lane: car.laneOffset,
        color: `#${car.color.toString(16).padStart(6, '0')}`
      });
    }

    this.trafficStates = states;
    return states;
  }

  public dispose() {
    this.trafficList.forEach((car) => {
      this.scene.remove(car.mesh);
      car.mesh.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });
    });
    this.trafficList = [];
  }
}
