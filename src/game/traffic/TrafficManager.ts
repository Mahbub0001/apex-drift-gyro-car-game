import * as THREE from 'three';
import { TrafficCarState } from '../../types';

interface TrafficEntity {
  id: string;
  type: 'sedan' | 'suv' | 'truck';
  mesh: THREE.Group;
  t: number;             // Position along spline [0, 1]
  speed: number;         // In spline t units per second
  laneOffset: number;    // Offset from center line (-4.5, 0, +4.5)
  color: number;
  width: number;
  length: number;
  hasTriggeredNearMiss: boolean;
}

export class TrafficManager {
  public scene: THREE.Scene;
  public splineCurve: THREE.CatmullRomCurve3;
  public trafficList: TrafficEntity[] = [];
  public trafficStates: TrafficCarState[] = [];

  private trafficColors = [0xdd3333, 0x2255cc, 0xffffff, 0x333333, 0x888888, 0xcc8800];

  constructor(scene: THREE.Scene, splineCurve: THREE.CatmullRomCurve3) {
    this.scene = scene;
    this.splineCurve = splineCurve;
    this.spawnInitialTraffic();
  }

  private createCivilianCarMesh(type: 'sedan' | 'suv' | 'truck', color: number): { mesh: THREE.Group; width: number; length: number } {
    const group = new THREE.Group();

    let width = 1.8;
    let length = 4.2;
    let height = 1.35;

    if (type === 'suv') {
      width = 2.0;
      length = 4.6;
      height = 1.65;
    } else if (type === 'truck') {
      width = 2.4;
      length = 6.8;
      height = 2.6;
    }

    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.25,
      metalness: 0.7
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.1,
      metalness: 0.9
    });

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });

    if (type === 'truck') {
      // Cab
      const cab = new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.7, 2.2), bodyMat);
      cab.position.set(0, height * 0.45, length * 0.3);
      cab.castShadow = true;
      group.add(cab);

      // Cargo Container
      const cargo = new THREE.Mesh(new THREE.BoxGeometry(width * 0.98, height, length * 0.65), new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.6 }));
      cargo.position.set(0, height * 0.55, -length * 0.15);
      cargo.castShadow = true;
      group.add(cargo);
    } else {
      // Lower Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.45, length), bodyMat);
      body.position.y = height * 0.3;
      body.castShadow = true;
      group.add(body);

      // Cabin
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.85, height * 0.45, length * 0.55), glassMat);
      cabin.position.set(0, height * 0.65, -0.2);
      cabin.castShadow = true;
      group.add(cabin);
    }

    // Wheels
    const wheelPositions = [
      [-width / 2, 0.3, length * 0.3],
      [width / 2, 0.3, length * 0.3],
      [-width / 2, 0.3, -length * 0.3],
      [width / 2, 0.3, -length * 0.3]
    ];

    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.24, 16), wheelMat);
      wheel.rotateZ(Math.PI / 2);
      wheel.position.set(x, y, z);
      group.add(wheel);
    });

    // Headlights (Warm Yellow)
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff5cc });
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.05), headMat);
    headL.position.set(-width * 0.35, height * 0.35, length / 2);
    const headR = headL.clone();
    headR.position.x = width * 0.35;
    group.add(headL, headR);

    // Taillights (Red)
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xdd1111 });
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.05), tailMat);
    tailL.position.set(-width * 0.35, height * 0.35, -length / 2);
    const tailR = tailL.clone();
    tailR.position.x = width * 0.35;
    group.add(tailL, tailR);

    return { mesh: group, width, length };
  }

  private spawnInitialTraffic() {
    const lanes = [-4.2, 0, 4.2]; // 3 highway lanes
    const types: ('sedan' | 'suv' | 'truck')[] = ['sedan', 'suv', 'truck', 'sedan', 'sedan'];

    for (let i = 0; i < 16; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const color = this.trafficColors[Math.floor(Math.random() * this.trafficColors.length)];
      const { mesh, width, length } = this.createCivilianCarMesh(type, color);

      // Stagger along track from 100m to 1100m
      const t = 0.08 + (i / 16) * 0.82 + (Math.random() * 0.03 - 0.015);
      const lane = lanes[Math.floor(Math.random() * lanes.length)];
      const speed = 0.008 + Math.random() * 0.006; // Cruising speed in spline t

      this.scene.add(mesh);

      this.trafficList.push({
        id: `traffic-${i}`,
        type,
        mesh,
        t,
        speed,
        laneOffset: lane,
        color,
        width,
        length,
        hasTriggeredNearMiss: false
      });
    }
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    onCollision: (damage: number) => void,
    onNearMiss: () => void
  ): TrafficCarState[] {
    const states: TrafficCarState[] = [];

    this.trafficList.forEach((car) => {
      // Advance car along spline
      car.t = (car.t + car.speed * delta) % 1.0;

      const curvePoint = this.splineCurve.getPoint(car.t);
      const tangent = this.splineCurve.getTangent(car.t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      // Apply lane offset
      const worldPos = curvePoint.clone().add(binormal.multiplyScalar(car.laneOffset));
      car.mesh.position.copy(worldPos);

      // Align with curve tangent
      car.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

      // Check Collision with Player
      const dist = worldPos.distanceTo(playerPos);

      // Hitbox check
      const collisionThreshold = (car.width + 1.8) / 2;
      const lengthThreshold = (car.length + 4.2) / 2;

      const deltaX = Math.abs(worldPos.x - playerPos.x);
      const deltaZ = Math.abs(worldPos.z - playerPos.z);

      if (deltaX < collisionThreshold && deltaZ < lengthThreshold) {
        // DIRECT HIT OR SCRAPE
        onCollision(25);
      } else if (dist < 3.8 && !car.hasTriggeredNearMiss) {
        // NEAR MISS BONUS!
        car.hasTriggeredNearMiss = true;
        onNearMiss();
      }

      if (dist > 15) {
        car.hasTriggeredNearMiss = false;
      }

      states.push({
        id: car.id,
        type: car.type,
        position: [worldPos.x, worldPos.y, worldPos.z],
        rotation: [0, 0, 0],
        speed: Math.round(car.speed * 1200 * 3.6),
        lane: car.laneOffset,
        color: `#${car.color.toString(16).padStart(6, '0')}`
      });
    });

    this.trafficStates = states;
    return states;
  }
}
