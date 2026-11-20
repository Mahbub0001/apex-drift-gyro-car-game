import * as THREE from 'three';
import { TrafficCarState } from '../../types';

interface TrafficEntity {
  id: string;
  type: 'sedan' | 'suv' | 'truck';
  mesh: THREE.Group;
  t: number;             // Position along spline [0, 1]
  baseSpeed: number;     // Speed along spline
  speed: number;
  laneOffset: number;    // Offset from center line (-3.8, 0, +3.8)
  color: number;
  width: number;
  length: number;
  height: number;
  hasTriggeredNearMiss: boolean;
  lateralImpulse: number; // For collision physics reaction
}

export class TrafficManager {
  public scene: THREE.Scene;
  public splineCurve: THREE.CatmullRomCurve3;
  public trafficList: TrafficEntity[] = [];
  public trafficStates: TrafficCarState[] = [];

  private trafficColors = [
    0xc1121f, // Metallic Red
    0x0077b6, // Deep Sapphire Blue
    0xf8f9fa, // Pearl White
    0x212529, // Obsidian Black
    0x6c757d, // Slate Grey
    0xffb703  // Taxi / Courier Yellow
  ];

  constructor(scene: THREE.Scene, splineCurve: THREE.CatmullRomCurve3) {
    this.scene = scene;
    this.splineCurve = splineCurve;
    this.spawnInitialTraffic();
  }

  // Builds a high-detail realistic 3D civilian car
  private createCivilianCarMesh(
    type: 'sedan' | 'suv' | 'truck',
    color: number
  ): { mesh: THREE.Group; width: number; length: number; height: number } {
    const group = new THREE.Group();

    let width = 1.9;
    let length = 4.4;
    let height = 1.4;

    if (type === 'suv') {
      width = 2.1;
      length = 4.7;
      height = 1.72;
    } else if (type === 'truck') {
      width = 2.5;
      length = 7.4;
      height = 2.8;
    }

    // PBR Automotive Paints
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.22,
      metalness: 0.8
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      metalness: 0.95,
      roughness: 0.1
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a1016,
      metalness: 0.2,
      roughness: 0.05,
      transmission: 0.85,
      transparent: true
    });

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x161618, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.9, roughness: 0.2 });

    // Build Wheels with 3D rims
    const addWheels = (wheelPositions: [number, number, number][], radius = 0.35, wheelWidth = 0.26) => {
      wheelPositions.forEach(([x, y, z]) => {
        const wheelGroup = new THREE.Group();
        wheelGroup.position.set(x, y, z);

        // Rubber Tire
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, wheelWidth, 20), tireMat);
        tire.rotateZ(Math.PI / 2);
        tire.castShadow = true;
        wheelGroup.add(tire);

        // 5-Spoke Alloy Rim
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, wheelWidth * 1.05, 16), rimMat);
        rim.rotateZ(Math.PI / 2);
        wheelGroup.add(rim);

        group.add(wheelGroup);
      });
    };

    if (type === 'truck') {
      // 1. Semi-Truck Cab
      const cab = new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.75, 2.4), bodyMat);
      cab.position.set(0, height * 0.48, length * 0.3);
      cab.castShadow = true;
      group.add(cab);

      // Windshield
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, height * 0.32, 0.1), glassMat);
      windshield.position.set(0, height * 0.65, length * 0.3 + 1.21);
      windshield.rotation.x = -0.15;
      group.add(windshield);

      // Roof Wind Deflector
      const deflector = new THREE.Mesh(new THREE.BoxGeometry(width * 0.85, 0.45, 1.4), bodyMat);
      deflector.position.set(0, height * 0.95, length * 0.3 - 0.2);
      deflector.rotation.x = -0.25;
      group.add(deflector);

      // Chrome Smokestacks
      const stackGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 12);
      const stackL = new THREE.Mesh(stackGeo, chromeMat);
      stackL.position.set(-width * 0.48, height * 0.75, length * 0.3 - 1.25);
      const stackR = stackL.clone();
      stackR.position.x = width * 0.48;
      group.add(stackL, stackR);

      // 2. Corrugated Cargo Container Trailer
      const containerMat = new THREE.MeshStandardMaterial({ color: 0xdde2e6, roughness: 0.5, metalness: 0.4 });
      const container = new THREE.Mesh(new THREE.BoxGeometry(width * 0.98, height * 0.95, length * 0.65), containerMat);
      container.position.set(0, height * 0.55, -length * 0.15);
      container.castShadow = true;
      group.add(container);

      // Truck Wheels (3 Axles = 6 wheel positions)
      addWheels([
        [-width / 2, 0.42, length * 0.3 + 0.5],
        [width / 2, 0.42, length * 0.3 + 0.5],
        [-width / 2, 0.42, -length * 0.25],
        [width / 2, 0.42, -length * 0.25],
        [-width / 2, 0.42, -length * 0.42],
        [width / 2, 0.42, -length * 0.42]
      ], 0.42, 0.32);
    } else {
      // 1. Lower Aerodynamic Monocoque Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.45, length), bodyMat);
      body.position.y = height * 0.32;
      body.castShadow = true;
      group.add(body);

      // 2. Curved Cabin Greenhouse
      const cabinLength = type === 'suv' ? length * 0.68 : length * 0.55;
      const cabinHeight = height * 0.46;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.86, cabinHeight, cabinLength), glassMat);
      cabin.position.set(0, height * 0.68, type === 'suv' ? -0.1 : -0.2);
      cabin.castShadow = true;
      group.add(cabin);

      // Roof Panel
      const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 0.84, 0.04, cabinLength * 0.9), bodyMat);
      roof.position.set(0, height * 0.91, cabin.position.z);
      group.add(roof);

      // SUV Roof Rails
      if (type === 'suv') {
        const railGeo = new THREE.BoxGeometry(0.04, 0.08, cabinLength * 0.85);
        const railL = new THREE.Mesh(railGeo, chromeMat);
        railL.position.set(-width * 0.38, height * 0.95, cabin.position.z);
        const railR = railL.clone();
        railR.position.x = width * 0.38;
        group.add(railL, railR);
      }

      // Wheels
      addWheels([
        [-width / 2, 0.34, length * 0.32],
        [width / 2, 0.34, length * 0.32],
        [-width / 2, 0.34, -length * 0.32],
        [width / 2, 0.34, -length * 0.32]
      ], 0.34, 0.25);
    }

    // Modern LED Headlights (White Xenon)
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.06), headMat);
    headL.position.set(-width * 0.36, height * 0.38, length / 2);
    const headR = headL.clone();
    headR.position.x = width * 0.36;
    group.add(headL, headR);

    // Continuous LED Taillight Bar (Bright Crimson)
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0022 });
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 0.08, 0.06), tailMat);
    tailBar.position.set(0, height * 0.4, -length / 2);
    group.add(tailBar);

    return { mesh: group, width, length, height };
  }

  private spawnInitialTraffic() {
    const lanes = [-3.8, 0, 3.8]; // Highway lanes
    const types: ('sedan' | 'suv' | 'truck')[] = ['sedan', 'suv', 'truck', 'sedan', 'suv', 'sedan'];

    for (let i = 0; i < 16; i++) {
      const type = types[i % types.length];
      const color = this.trafficColors[i % this.trafficColors.length];
      const { mesh, width, length, height } = this.createCivilianCarMesh(type, color);

      // Stagger along track from 100m to 1180m
      const t = 0.07 + (i / 16) * 0.85;
      const lane = lanes[i % lanes.length];
      const baseSpeed = 0.0075 + (i % 3) * 0.002;

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
        lateralImpulse: 0
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
      // Restore base speed gradually if bumped
      car.speed = THREE.MathUtils.lerp(car.speed, car.baseSpeed, delta * 2);
      car.lateralImpulse = THREE.MathUtils.lerp(car.lateralImpulse, 0, delta * 3);

      car.t = (car.t + car.speed * delta) % 1.0;

      const curvePoint = this.splineCurve.getPoint(car.t);
      const tangent = this.splineCurve.getTangent(car.t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      // World position with lateral lane offset + collision bounce
      const effectiveLane = THREE.MathUtils.clamp(car.laneOffset + car.lateralImpulse, -5.2, 5.2);
      const worldPos = curvePoint.clone().add(binormal.multiplyScalar(effectiveLane));
      worldPos.y = curvePoint.y + 0.32;
      car.mesh.position.copy(worldPos);

      // Align with track curve
      car.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

      // Physical Collision Detection (Oriented AABB check)
      const dist = worldPos.distanceTo(playerPos);
      const halfW = (car.width + 1.85) / 2;
      const halfL = (car.length + 4.3) / 2;

      const deltaX = Math.abs(worldPos.x - playerPos.x);
      const deltaZ = Math.abs(worldPos.z - playerPos.z);

      if (deltaX < halfW && deltaZ < halfL) {
        // SOLID IMPACT DETECTED!
        const normalX = (playerPos.x - worldPos.x) / (halfW || 1);
        const normalZ = (playerPos.z - worldPos.z) / (halfL || 1);

        // Knock the civilian car forward and sideways!
        car.speed += 0.015; // Push traffic car forward
        car.lateralImpulse += normalX < 0 ? 1.5 : -1.5;

        // Trigger player collision reaction
        onCollision(normalX, normalZ, playerSpeedKmh, worldPos);
      } else if (dist < 3.8 && !car.hasTriggeredNearMiss && playerSpeedKmh > 70) {
        // Near Miss Slipstream Bonus!
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
        speed: Math.round(car.speed * 1250 * 3.6),
        lane: car.laneOffset,
        color: `#${car.color.toString(16).padStart(6, '0')}`
      });
    });

    this.trafficStates = states;
    return states;
  }
}
