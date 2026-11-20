import * as THREE from 'three';

export interface RampCollider {
  position: THREE.Vector3;
  width: number;
  length: number;
  height: number;
}

export class HighwayTrack {
  public scene: THREE.Scene;
  public trackGroup: THREE.Group = new THREE.Group();
  public splineCurve: THREE.CatmullRomCurve3;
  public ramps: RampCollider[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Define Scenic Winding Highway 3D Spline Path
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(25, 1.5, 90),
      new THREE.Vector3(-40, 5.0, 190),
      new THREE.Vector3(-95, 2.0, 290), // S-curve turn
      new THREE.Vector3(-60, 8.5, 400), // Elevated mountain pass
      new THREE.Vector3(20, 12.0, 510), // Crest with Jump Ramp
      new THREE.Vector3(90, 4.0, 620),  // High-speed downhill curve
      new THREE.Vector3(70, 1.0, 740),
      new THREE.Vector3(-20, 0.5, 850),
      new THREE.Vector3(-70, 3.0, 960),
      new THREE.Vector3(-30, 0.0, 1080),
      new THREE.Vector3(0, 0.0, 1200)   // Straightaway finish
    ];

    this.splineCurve = new THREE.CatmullRomCurve3(points);
    this.splineCurve.curveType = 'catmullrom';
    this.splineCurve.tension = 0.5;

    this.buildTrack();
    this.buildEnvironment();
    this.buildJumpRamps();
    this.scene.add(this.trackGroup);
  }

  private buildTrack() {
    const numSteps = 450;
    const roadWidth = 14; // 3 full lanes + shoulders
    const points = this.splineCurve.getPoints(numSteps);

    // Track Road Mesh Geometry
    const roadGeometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Road Materials (PBR Wet Asphalt)
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x181a20,
      roughness: 0.85,
      metalness: 0.15
    });

    for (let i = 0; i <= numSteps; i++) {
      const t = i / numSteps;
      const point = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const normal = new THREE.Vector3(0, 1, 0);
      const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

      // Left and right road vertices
      const leftPoint = point.clone().add(binormal.clone().multiplyScalar(roadWidth / 2));
      const rightPoint = point.clone().add(binormal.clone().multiplyScalar(-roadWidth / 2));

      vertices.push(leftPoint.x, leftPoint.y, leftPoint.z);
      vertices.push(rightPoint.x, rightPoint.y, rightPoint.z);

      uvs.push(0, t * 80);
      uvs.push(1, t * 80);

      if (i < numSteps) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeometry.setIndex(indices);
    roadGeometry.computeVertexNormals();

    const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
    roadMesh.receiveShadow = true;
    this.trackGroup.add(roadMesh);

    // Guardrails & Barriers along track edges
    this.buildGuardrails(numSteps, roadWidth);
  }

  private buildGuardrails(numSteps: number, roadWidth: number) {
    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0x8899aa,
      metalness: 0.85,
      roughness: 0.3
    });

    for (let side = -1; side <= 1; side += 2) {
      const railCurvePoints: THREE.Vector3[] = [];
      for (let i = 0; i <= numSteps; i += 2) {
        const t = i / numSteps;
        const point = this.splineCurve.getPoint(t);
        const tangent = this.splineCurve.getTangent(t);
        const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
        const edgePoint = point.clone().add(binormal.multiplyScalar(side * (roadWidth / 2 + 0.3)));
        edgePoint.y += 0.55; // Rail height
        railCurvePoints.push(edgePoint);
      }

      const railCurve = new THREE.CatmullRomCurve3(railCurvePoints);
      const railGeometry = new THREE.TubeGeometry(railCurve, numSteps / 2, 0.12, 8, false);
      const railMesh = new THREE.Mesh(railGeometry, railMaterial);
      railMesh.castShadow = true;
      this.trackGroup.add(railMesh);
    }
  }

  private buildJumpRamps() {
    // Strategic Jump Ramp at the crest (Z ~ 510)
    const rampPoint = this.splineCurve.getPoint(0.42);
    const tangent = this.splineCurve.getTangent(0.42);

    const rampGroup = new THREE.Group();
    rampGroup.position.copy(rampPoint);
    rampGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

    // Ramp Wedge
    const rampWidth = 6.5;
    const rampLength = 9.0;
    const rampHeight = 1.8;

    const rampShape = new THREE.Shape();
    rampShape.moveTo(-rampWidth / 2, 0);
    rampShape.lineTo(rampWidth / 2, 0);
    rampShape.lineTo(rampWidth / 2, rampLength);
    rampShape.lineTo(-rampWidth / 2, rampLength);
    rampShape.closePath();

    // Extruded wedge
    const rampGeo = new THREE.BoxGeometry(rampWidth, rampHeight, rampLength);
    rampGeo.rotateX(Math.PI / 14); // Incline
    const rampMat = new THREE.MeshStandardMaterial({
      color: 0xffb800, // Vibrant warning yellow
      roughness: 0.4,
      metalness: 0.5
    });

    const rampMesh = new THREE.Mesh(rampGeo, rampMat);
    rampMesh.position.set(0, rampHeight * 0.45, 0);
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    rampGroup.add(rampMesh);

    // Flashing Arrow Marker on ramp
    const chevronGeo = new THREE.BoxGeometry(rampWidth * 0.8, 0.1, 0.4);
    const chevronMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    const chevron = new THREE.Mesh(chevronGeo, chevronMat);
    chevron.position.set(0, rampHeight * 0.85, 2.5);
    rampGroup.add(chevron);

    this.trackGroup.add(rampGroup);

    this.ramps.push({
      position: rampPoint,
      width: rampWidth,
      length: rampLength,
      height: rampHeight
    });
  }

  private buildEnvironment() {
    // 1. Rolling Autumn Terrain Ground Plane
    const groundGeo = new THREE.PlaneGeometry(800, 1600, 32, 32);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x221810, // Autumn earth
      roughness: 0.95,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(0, -1.0, 600);
    ground.receiveShadow = true;
    this.trackGroup.add(ground);

    // 2. Autumn Maple & Birch Trees along Highway
    const treeTrunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 3.5, 8);
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x3d271d, roughness: 0.9 });

    // Instanced Autumn Foliage Colors: Golden Yellow, Burnt Orange, Ruby Crimson
    const autumnColors = [0xff7700, 0xdd4400, 0xffaa00, 0xcc2200, 0xee9900];
    const foliageGeos = [
      new THREE.SphereGeometry(1.8, 8, 8),
      new THREE.DodecahedronGeometry(2.0)
    ];

    for (let i = 0; i < 160; i++) {
      const t = Math.random();
      const curvePoint = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      // Place trees 12 to 38 meters away from road center
      const side = Math.random() > 0.5 ? 1 : -1;
      const distance = 11 + Math.random() * 26;
      const treePos = curvePoint.clone().add(binormal.multiplyScalar(side * distance));
      treePos.y -= 0.5;

      const treeGroup = new THREE.Group();
      treeGroup.position.copy(treePos);

      // Trunk
      const trunk = new THREE.Mesh(treeTrunkGeo, treeTrunkMat);
      trunk.position.y = 1.75;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      // Canopy
      const color = autumnColors[Math.floor(Math.random() * autumnColors.length)];
      const foliageMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
      const foliage = new THREE.Mesh(foliageGeos[Math.floor(Math.random() * foliageGeos.length)], foliageMat);
      foliage.position.y = 3.8 + Math.random() * 0.8;
      const scale = 0.8 + Math.random() * 0.6;
      foliage.scale.set(scale, scale * 1.2, scale);
      foliage.castShadow = true;
      treeGroup.add(foliage);

      this.trackGroup.add(treeGroup);
    }
  }

  // Elevation Query for Physics Engine
  public getElevationAt(x: number, z: number): number {
    // Find closest segment on spline
    // Fast estimation: clamp between 0 and 1200
    const clampedZ = Math.max(0, Math.min(1200, z));
    const t = clampedZ / 1200;
    const splinePoint = this.splineCurve.getPoint(t);

    // Check if on Jump Ramp
    for (const ramp of this.ramps) {
      const dist = ramp.position.distanceTo(new THREE.Vector3(x, ramp.position.y, z));
      if (dist < ramp.length * 0.6 && Math.abs(x - ramp.position.x) < ramp.width / 2) {
        return ramp.position.y + ramp.height;
      }
    }

    return splinePoint.y;
  }
}
