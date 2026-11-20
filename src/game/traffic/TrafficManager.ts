import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TrafficCarState } from '../../types';

interface TrafficEntity {
  id: string;
  type: 'sedan' | 'suv' | 'truck' | 'van' | 'taxi';
  mesh: THREE.Group;
  t: number;             // Position along spline [0, 1]
  baseSpeed: number;     // Speed along spline
  speed: number;
  laneOffset: number;    // Offset from center line (-2.8, +2.8)
  color: number;
  width: number;
  length: number;
  height: number;
  hasTriggeredNearMiss: boolean;
  lateralImpulse: number;
  lastCollisionTime: number;
}

export class TrafficManager {
  public scene: THREE.Scene;
  public splineCurve: THREE.CatmullRomCurve3;
  public trafficList: TrafficEntity[] = [];
  public trafficStates: TrafficCarState[] = [];

  // Authentic realistic automotive colors
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

  constructor(scene: THREE.Scene, splineCurve: THREE.CatmullRomCurve3) {
    this.scene = scene;
    this.splineCurve = splineCurve;

    // Load authentic 3D civilian vehicle models
    this.preloadModels().then(() => {
      this.applyTemplatesToTraffic();
    });

    this.spawnInitialTraffic();
  }

  // Preloads the 4 civilian glTF 2.0 models from public/models/
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
                    mat.roughness = Math.min(mat.roughness, 0.4);
                    mat.metalness = Math.max(mat.metalness, 0.3);
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

  // Clones a loaded GLTF template and scales it to true life-size automotive proportions
  private buildCarFromTemplate(type: string, color: number): { mesh: THREE.Group; width: number; length: number; height: number } {
    const group = new THREE.Group();
    let template = this.templates.get(type);

    if (!template) {
      // Fallback mapping if a specific model isn't finished loading yet
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
      // Life-size scaling factor: 1.65 matches standard automotive track dimensions
      cloned.scale.set(1.65, 1.65, 1.65);

      // Apply body paint tint to body mesh if applicable
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
      // Sleek placeholder while glb is buffering (rarely needed)
      const placeholderGeo = new THREE.BoxGeometry(width, height * 0.6, length);
      const placeholderMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.7 });
      const box = new THREE.Mesh(placeholderGeo, placeholderMat);
      box.position.y = height * 0.3;
      group.add(box);
    }

    // Add glowing Xenon LED Headlights
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const headGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const headL = new THREE.Mesh(headGeo, headMat);
    headL.position.set(-width * 0.38, height * 0.38, length * 0.48);
    const headR = headL.clone();
    headR.position.x = width * 0.38;
    group.add(headL, headR);

    // Add bright red LED Taillights
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff002b });
    const tailGeo = new THREE.BoxGeometry(0.35, 0.1, 0.05);
    const tailL = new THREE.Mesh(tailGeo, tailMat);
    tailL.position.set(-width * 0.38, height * 0.42, -length * 0.48);
    const tailR = tailL.clone();
    tailR.position.x = width * 0.38;
    group.add(tailL, tailR);

    return { mesh: group, width, length, height };
  }

  // Once GLTFs finish loading, swap into any existing spawned traffic
  private applyTemplatesToTraffic() {
    this.trafficList.forEach((car) => {
      // Clear out the temporary placeholder meshes
      while (car.mesh.children.length > 0) {
        car.mesh.remove(car.mesh.children[0]);
      }

      const { mesh, width, length, height } = this.buildCarFromTemplate(car.type, car.color);
      // Transfer children into car.mesh
      while (mesh.children.length > 0) {
        car.mesh.add(mesh.children[0]);
      }
      car.width = width;
      car.length = length;
      car.height = height;
    });
  }

  // Spawns a sparse, realistic highway traffic fleet (only 6 well-spaced cars)
  private spawnInitialTraffic() {
    const lanes = [-2.8, 2.8]; // 2 Clean highway lanes (left & right of yellow center line)
    const types: ('sedan' | 'taxi' | 'van' | 'truck')[] = ['sedan', 'taxi', 'van', 'truck', 'sedan', 'taxi'];

    // Only 6 cars spread across the entire 3.8 KM highway circuit!
    const numTraffic = 6;

    for (let i = 0; i < numTraffic; i++) {
      const type = types[i % types.length];
      const color = this.trafficColors[i % this.trafficColors.length];
      const { mesh, width, length, height } = this.buildCarFromTemplate(type, color);

      // Evenly staggered along the circuit: first civilian car directly ahead at t = 0.022 (~85m)
      const t = 0.022 + (i / numTraffic) * 0.9;
      const lane = lanes[i % lanes.length];
      const baseSpeed = 0.0032 + (i % 2) * 0.0008; // Cruising highway speed ~70-90 km/h

      // Immediately set initial track position and tangent orientation
      const curvePoint = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
      const worldPos = curvePoint.clone().add(binormal.multiplyScalar(lane));
      worldPos.y = curvePoint.y + 0.22;
      mesh.position.copy(worldPos);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

      this.scene.add(mesh);

      this.trafficList.push({
        id: `traffic-${i}`,
        type,
        mesh,
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

    this.trafficList.forEach((car) => {
      // Smooth return to base speed if bumped
      car.speed = THREE.MathUtils.lerp(car.speed, car.baseSpeed, delta * 1.5);
      car.lateralImpulse = THREE.MathUtils.lerp(car.lateralImpulse, 0, delta * 2.5);

      // Seamless closed circuit looping
      car.t = (car.t + car.speed * delta) % 1.0;
      if (car.t < 0) car.t += 1.0;

      const curvePoint = this.splineCurve.getPoint(car.t);
      const tangent = this.splineCurve.getTangent(car.t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      // World position with lane offset + deflection
      const effectiveLane = THREE.MathUtils.clamp(car.laneOffset + car.lateralImpulse, -5.0, 5.0);
      const worldPos = curvePoint.clone().add(binormal.multiplyScalar(effectiveLane));
      worldPos.y = curvePoint.y + 0.22;
      car.mesh.position.copy(worldPos);

      // Align cleanly along track tangent direction (+Z forward)
      car.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

      // Oriented Hitbox Collision Check
      const dist = worldPos.distanceTo(playerPos);
      const halfW = (car.width + 1.85) / 2;
      const halfL = (car.length + 4.3) / 2;

      const deltaX = Math.abs(worldPos.x - playerPos.x);
      const deltaZ = Math.abs(worldPos.z - playerPos.z);

      if (deltaX < halfW && deltaZ < halfL && Math.abs(worldPos.y - playerPos.y) < 2.0) {
        // SOLID IMPACT DETECTED!
        const now = performance.now();
        if (!car.lastCollisionTime || now - car.lastCollisionTime > 900) {
          car.lastCollisionTime = now;
          const normalX = (playerPos.x - worldPos.x) / (halfW || 1);
          const normalZ = (playerPos.z - worldPos.z) / (halfL || 1);

          // Knock the civilian car forward and sideways smoothly
          car.speed += 0.008;
          car.lateralImpulse += normalX < 0 ? 1.6 : -1.6;

          onCollision(normalX, normalZ, playerSpeedKmh, worldPos);
        }
      } else if (dist < 4.2 && !car.hasTriggeredNearMiss && playerSpeedKmh > 75) {
        // High-Speed Slipstream Near Miss Bonus!
        car.hasTriggeredNearMiss = true;
        onNearMiss();
      }

      if (dist > 18) {
        car.hasTriggeredNearMiss = false;
      }

      states.push({
        id: car.id,
        type: car.type,
        position: [worldPos.x, worldPos.y, worldPos.z],
        rotation: [car.mesh.rotation.x, car.mesh.rotation.y, car.mesh.rotation.z],
        speed: Math.round(car.speed * 2500 * 3.6),
        lane: car.laneOffset,
        color: `#${car.color.toString(16).padStart(6, '0')}`
      });
    });

    this.trafficStates = states;
    return states;
  }
}
