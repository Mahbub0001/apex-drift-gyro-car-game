import * as THREE from 'three';
import { TrafficCarState } from '../../types';

interface TrafficEntity {
  id: string;
  type: 'sedan' | 'suv' | 'van';
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

  constructor(scene: THREE.Scene, splineCurve: THREE.CatmullRomCurve3) {
    this.scene = scene;
    this.splineCurve = splineCurve;
    this.spawnInitialTraffic();
  }

  // Builds sculpted, realistic 3D civilian highway vehicles
  private createCivilianCarMesh(
    type: 'sedan' | 'suv' | 'van',
    color: number
  ): { mesh: THREE.Group; width: number; length: number; height: number } {
    const group = new THREE.Group();

    let width = 1.95;
    let length = 4.5;
    let height = 1.38;

    if (type === 'suv') {
      width = 2.15;
      length = 4.75;
      height = 1.68;
    } else if (type === 'van') {
      width = 2.25;
      length = 5.6;
      height = 2.25;
    }

    // High quality PBR materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.18,
      metalness: 0.82
    });

    const blackPlasticMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1d,
      roughness: 0.85
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf0f0f0,
      metalness: 0.95,
      roughness: 0.12
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x070b12,
      metalness: 0.2,
      roughness: 0.05,
      transmission: 0.88,
      transparent: true,
      opacity: 0.82
    });

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.92 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.88, roughness: 0.25 });

    // Helper: Build detailed 3D alloy wheels with brake calipers
    const addWheels = (positions: [number, number, number][], radius = 0.35, wheelWidth = 0.26) => {
      positions.forEach(([x, y, z]) => {
        const wheelGroup = new THREE.Group();
        wheelGroup.position.set(x, y, z);

        // Tire
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, wheelWidth, 20), tireMat);
        tire.rotateZ(Math.PI / 2);
        tire.castShadow = true;
        wheelGroup.add(tire);

        // Alloy Rim
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, wheelWidth * 1.05, 16), rimMat);
        rim.rotateZ(Math.PI / 2);
        wheelGroup.add(rim);

        group.add(wheelGroup);
      });
    };

    if (type === 'van') {
      // ---------------------------------------------
      // High-Roof Highway Commercial Van
      // ---------------------------------------------
      // Lower Chassis & Cab
      const body = new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.88, length), bodyMat);
      body.position.y = height * 0.52;
      body.castShadow = true;
      group.add(body);

      // Sloped Hood
      const hood = new THREE.Mesh(new THREE.BoxGeometry(width * 0.96, height * 0.25, 1.2), bodyMat);
      hood.position.set(0, height * 0.38, length * 0.42);
      hood.rotation.x = 0.18;
      group.add(hood);

      // Front Windshield
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, height * 0.36, 0.1), glassMat);
      windshield.position.set(0, height * 0.68, length * 0.28);
      windshield.rotation.x = -0.32;
      group.add(windshield);

      // Front Honeycomb Grille
      const grille = new THREE.Mesh(new THREE.BoxGeometry(width * 0.75, height * 0.22, 0.1), blackPlasticMat);
      grille.position.set(0, height * 0.32, length * 0.5 + 0.02);
      group.add(grille);

      // Wheels
      addWheels([
        [-width / 2, 0.38, length * 0.32],
        [width / 2, 0.38, length * 0.32],
        [-width / 2, 0.38, -length * 0.32],
        [width / 2, 0.38, -length * 0.32]
      ], 0.38, 0.28);
    } else {
      // ---------------------------------------------
      // Modern Sports Sedan or Compact Luxury SUV
      // ---------------------------------------------
      // 1. Lower Body with Sculpted Taper
      const body = new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.45, length), bodyMat);
      body.position.y = height * 0.32;
      body.castShadow = true;
      group.add(body);

      // Sloped Front Hood Wedge
      const hood = new THREE.Mesh(new THREE.BoxGeometry(width * 0.95, height * 0.22, length * 0.32), bodyMat);
      hood.position.set(0, height * 0.35, length * 0.28);
      hood.rotation.x = 0.12;
      hood.castShadow = true;
      group.add(hood);

      // 2. Aerodynamic Passenger Cabin Greenhouse
      const cabinLen = type === 'suv' ? length * 0.66 : length * 0.55;
      const cabinH = height * 0.46;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.85, cabinH, cabinLen), glassMat);
      cabin.position.set(0, height * 0.68, type === 'suv' ? -0.05 : -0.15);
      cabin.castShadow = true;
      group.add(cabin);

      // Raked Roof Panel
      const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 0.04, cabinLen * 0.88), bodyMat);
      roof.position.set(0, height * 0.91, cabin.position.z);
      group.add(roof);

      // Front Radiator Grille
      const grille = new THREE.Mesh(new THREE.BoxGeometry(width * 0.68, height * 0.2, 0.08), blackPlasticMat);
      grille.position.set(0, height * 0.28, length / 2 + 0.01);
      group.add(grille);

      // Chrome Grille Trim
      const grilleTrim = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.04, 0.09), chromeMat);
      grilleTrim.position.set(0, height * 0.38, length / 2 + 0.01);
      group.add(grilleTrim);

      // Side Mirrors on both doors
      const mirrorGeo = new THREE.BoxGeometry(0.18, 0.1, 0.12);
      const mirrorL = new THREE.Mesh(mirrorGeo, bodyMat);
      mirrorL.position.set(-width * 0.52, height * 0.58, length * 0.15);
      const mirrorR = mirrorL.clone();
      mirrorR.position.x = width * 0.52;
      group.add(mirrorL, mirrorR);

      // Dual Chrome Exhaust Pipes at Rear
      const exhaustGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.15, 12);
      const exL = new THREE.Mesh(exhaustGeo, chromeMat);
      exL.rotateX(Math.PI / 2);
      exL.position.set(-0.55, height * 0.18, -length / 2 - 0.06);
      const exR = exL.clone();
      exR.position.x = 0.55;
      group.add(exL, exR);

      // Wheels
      addWheels([
        [-width / 2, 0.35, length * 0.31],
        [width / 2, 0.35, length * 0.31],
        [-width / 2, 0.35, -length * 0.31],
        [width / 2, 0.35, -length * 0.31]
      ], 0.35, 0.26);
    }

    // Modern Xenon LED Projector Headlights
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.09, 0.06), headMat);
    headL.position.set(-width * 0.36, height * 0.36, length / 2);
    const headR = headL.clone();
    headR.position.x = width * 0.36;
    group.add(headL, headR);

    // Continuous Full-Width LED Taillight Bar (Bright Crimson)
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff002b });
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 0.07, 0.06), tailMat);
    tailBar.position.set(0, height * 0.4, -length / 2);
    group.add(tailBar);

    return { mesh: group, width, length, height };
  }

  // Spawns a sparse, realistic highway traffic fleet (only 6 well-spaced cars)
  private spawnInitialTraffic() {
    const lanes = [-2.8, 2.8]; // 2 Clean highway lanes (left & right of yellow center line)
    const types: ('sedan' | 'suv' | 'van')[] = ['sedan', 'suv', 'sedan', 'van', 'sedan', 'suv'];

    // Only 6 cars spread across the entire 1500-meter highway!
    const numTraffic = 6;

    for (let i = 0; i < numTraffic; i++) {
      const type = types[i % types.length];
      const color = this.trafficColors[i % this.trafficColors.length];
      const { mesh, width, length, height } = this.createCivilianCarMesh(type, color);

      // Evenly staggered along the highway from 200m to 1400m
      const t = 0.14 + (i / numTraffic) * 0.78;
      const lane = lanes[i % lanes.length];
      const baseSpeed = 0.006 + (i % 2) * 0.0016; // Cruising highway speed

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

      car.t = (car.t + car.speed * delta) % 1.0;

      const curvePoint = this.splineCurve.getPoint(car.t);
      const tangent = this.splineCurve.getTangent(car.t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      // World position with lane offset + deflection
      const effectiveLane = THREE.MathUtils.clamp(car.laneOffset + car.lateralImpulse, -5.0, 5.0);
      const worldPos = curvePoint.clone().add(binormal.multiplyScalar(effectiveLane));
      worldPos.y = curvePoint.y + 0.32;
      car.mesh.position.copy(worldPos);

      // Align with track curve
      car.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

      // Oriented Hitbox Collision Check
      const dist = worldPos.distanceTo(playerPos);
      const halfW = (car.width + 1.85) / 2;
      const halfL = (car.length + 4.3) / 2;

      const deltaX = Math.abs(worldPos.x - playerPos.x);
      const deltaZ = Math.abs(worldPos.z - playerPos.z);

      if (deltaX < halfW && deltaZ < halfL) {
        // SOLID IMPACT DETECTED!
        const now = performance.now();
        if (!car.lastCollisionTime || now - car.lastCollisionTime > 900) {
          car.lastCollisionTime = now;
          const normalX = (playerPos.x - worldPos.x) / (halfW || 1);
          const normalZ = (playerPos.z - worldPos.z) / (halfL || 1);

          // Knock the civilian car forward and sideways smoothly
          car.speed += 0.012;
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
        speed: Math.round(car.speed * 1250 * 3.6),
        lane: car.laneOffset,
        color: `#${car.color.toString(16).padStart(6, '0')}`
      });
    });

    this.trafficStates = states;
    return states;
  }
}
