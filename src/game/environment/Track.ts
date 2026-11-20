import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

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

    // 1. Define Winding British Countryside Highway Spline (Smooth and Winding)
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(15, 0.5, 80),
      new THREE.Vector3(-25, 2.0, 180),
      new THREE.Vector3(-60, 4.5, 300), // Sweeping left turn
      new THREE.Vector3(-30, 8.0, 420), // Hill climb
      new THREE.Vector3(15, 12.0, 520), // Crest with Asphalt 9 Jump Ramp
      new THREE.Vector3(65, 6.0, 640),  // Downhill curve
      new THREE.Vector3(45, 2.0, 760),
      new THREE.Vector3(-15, 1.0, 880), // S-curve through autumn trees
      new THREE.Vector3(-45, 2.5, 1000),
      new THREE.Vector3(-10, 0.5, 1120),
      new THREE.Vector3(0, 0.0, 1250)   // Final sprint
    ];

    this.splineCurve = new THREE.CatmullRomCurve3(points);
    this.splineCurve.curveType = 'catmullrom';
    this.splineCurve.tension = 0.5;

    this.setupAtmosphere();
    this.buildTerrain();
    this.buildRoad();
    this.buildStoneWalls();
    this.buildAutumnTrees();
    this.buildJumpRamps();

    this.scene.add(this.trackGroup);
  }

  // 1. Realistic Sky & Lighting (Forza Horizon Autumn Day)
  private setupAtmosphere() {
    // Sky Dome
    const sky = new Sky();
    sky.scale.setScalar(450000);
    this.trackGroup.add(sky);

    const sun = new THREE.Vector3();
    const uniforms = sky.material.uniforms;
    uniforms['turbidity'].value = 8;
    uniforms['rayleigh'].value = 1.8;
    uniforms['mieCoefficient'].value = 0.005;
    uniforms['mieDirectionalG'].value = 0.8;

    // Golden afternoon autumn sun angle
    const elevation = 32;
    const azimuth = 180;
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    sun.setFromSphericalCoords(1, phi, theta);
    uniforms['sunPosition'].value.copy(sun);

    // Warm Sun Directional Light
    const dirLight = new THREE.DirectionalLight(0xfffaed, 3.8);
    dirLight.position.set(100, 150, 120);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 450;
    const d = 60;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // Sky & Ground Ambient Light
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x4a6b28, 1.2);
    this.scene.add(hemiLight);
  }

  // 2. Rolling British Green & Golden Autumn Hills
  private buildTerrain() {
    const terrainGeo = new THREE.PlaneGeometry(1200, 1600, 64, 64);
    terrainGeo.rotateX(-Math.PI / 2);

    // Add gentle rolling hills
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      // Keep flat near road (x between -20 and 20), rise into hills on flanks
      const distFromCenter = Math.abs(vx);
      if (distFromCenter > 22) {
        const hill = Math.sin(vx * 0.015) * Math.cos(vz * 0.01) * 12 + (distFromCenter - 22) * 0.12;
        pos.setY(i, hill);
      }
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x3d5c22, // Rich English countryside grass
      roughness: 0.9,
      metalness: 0.05
    });

    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.position.set(0, -0.4, 620);
    terrain.receiveShadow = true;
    this.trackGroup.add(terrain);
  }

  // 3. Smooth Two-Lane Country Road with Road Markings
  private buildRoad() {
    const numSteps = 500;
    const roadWidth = 12.0;

    const roadGeo = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Road Texture Canvas (Asphalt with white edges and yellow center dashes)
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Asphalt Base
    ctx.fillStyle = '#23252a';
    ctx.fillRect(0, 0, 512, 1024);

    // Outer Solid White Road Lines
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(24, 0, 10, 1024);
    ctx.fillRect(478, 0, 10, 1024);

    // Center Dashed Double Yellow Line
    ctx.fillStyle = '#f5b000';
    for (let y = 0; y < 1024; y += 64) {
      ctx.fillRect(250, y, 6, 36);
      ctx.fillRect(260, y, 6, 36);
    }

    const roadTexture = new THREE.CanvasTexture(canvas);
    roadTexture.wrapS = THREE.RepeatWrapping;
    roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(1, 45);

    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.8,
      metalness: 0.15
    });

    for (let i = 0; i <= numSteps; i++) {
      const t = i / numSteps;
      const point = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const left = point.clone().add(binormal.clone().multiplyScalar(roadWidth / 2));
      const right = point.clone().add(binormal.clone().multiplyScalar(-roadWidth / 2));

      vertices.push(left.x, left.y + 0.05, left.z);
      vertices.push(right.x, right.y + 0.05, right.z);

      uvs.push(0, t * 45);
      uvs.push(1, t * 45);

      if (i < numSteps) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    this.trackGroup.add(roadMesh);
  }

  // 4. British Countryside Dry-Stone Walls & Red/White Curbs
  private buildStoneWalls() {
    const numSteps = 250;
    const roadWidth = 12.0;

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x6e685f,
      roughness: 0.95,
      metalness: 0.1
    });

    for (let side of [-1, 1]) {
      const wallPoints: THREE.Vector3[] = [];
      for (let i = 0; i <= numSteps; i++) {
        const t = i / numSteps;
        const pt = this.splineCurve.getPoint(t);
        const tangent = this.splineCurve.getTangent(t);
        const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
        const wallPos = pt.clone().add(binormal.multiplyScalar(side * (roadWidth / 2 + 1.2)));
        wallPos.y += 0.45;
        wallPoints.push(wallPos);
      }

      const wallCurve = new THREE.CatmullRomCurve3(wallPoints);
      const wallGeo = new THREE.TubeGeometry(wallCurve, numSteps, 0.45, 6, false);
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      this.trackGroup.add(wallMesh);
    }
  }

  // 5. Authentic Autumn Trees (Multi-tier Maple, Birch, Oak in Gold, Amber & Crimson)
  private buildAutumnTrees() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x422d1d, roughness: 0.9 });
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 4.0, 8);

    // Autumn Canopy Colors from Forza Horizon 4
    const autumnColors = [
      0xd62828, // Crimson Maple Red
      0xf77f00, // Vibrant Amber Orange
      0xfcbf49, // Golden Birch Yellow
      0xe76f51, // Burnt Sienna
      0x406a26  // Lingering Autumn Green
    ];

    for (let i = 0; i < 220; i++) {
      const t = Math.random();
      const pt = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const side = Math.random() > 0.5 ? 1 : -1;
      const distance = 9.0 + Math.random() * 32.0;
      const treePos = pt.clone().add(binormal.multiplyScalar(side * distance));

      const tree = new THREE.Group();
      tree.position.set(treePos.x, treePos.y, treePos.z);

      // Trunk
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2.0;
      trunk.castShadow = true;
      tree.add(trunk);

      // Layered Organic Foliage
      const color = autumnColors[Math.floor(Math.random() * autumnColors.length)];
      const foliageMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.75,
        metalness: 0.05
      });

      // 3 overlapping spheres for natural volume
      const scaleBase = 1.2 + Math.random() * 0.8;
      const canopy1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8 * scaleBase), foliageMat);
      canopy1.position.set(0, 4.2 * scaleBase, 0);
      canopy1.castShadow = true;

      const canopy2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 * scaleBase), foliageMat);
      canopy2.position.set(0.4, 5.5 * scaleBase, 0.2);
      canopy2.castShadow = true;

      const canopy3 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5 * scaleBase), foliageMat);
      canopy3.position.set(-0.3, 4.8 * scaleBase, -0.4);
      canopy3.castShadow = true;

      tree.add(canopy1, canopy2, canopy3);
      this.trackGroup.add(tree);
    }
  }

  // 6. Asphalt 9 Stunt Jump Ramp
  private buildJumpRamps() {
    const rampPoint = this.splineCurve.getPoint(0.42);
    const tangent = this.splineCurve.getTangent(0.42);

    const rampGroup = new THREE.Group();
    rampGroup.position.copy(rampPoint);
    rampGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

    const rampWidth = 6.0;
    const rampLength = 8.5;
    const rampHeight = 1.9;

    const rampGeo = new THREE.BoxGeometry(rampWidth, rampHeight, rampLength);
    rampGeo.rotateX(Math.PI / 14); // Incline
    const rampMat = new THREE.MeshStandardMaterial({
      color: 0xf5b000,
      roughness: 0.35,
      metalness: 0.6
    });

    const rampMesh = new THREE.Mesh(rampGeo, rampMat);
    rampMesh.position.set(0, rampHeight * 0.45, 0);
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    rampGroup.add(rampMesh);

    // Glowing Cyan Boost Arrows
    const chevronGeo = new THREE.BoxGeometry(rampWidth * 0.8, 0.1, 0.4);
    const chevronMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    const chevron = new THREE.Mesh(chevronGeo, chevronMat);
    chevron.position.set(0, rampHeight * 0.82, 2.2);
    rampGroup.add(chevron);

    this.trackGroup.add(rampGroup);

    this.ramps.push({
      position: rampPoint,
      width: rampWidth,
      length: rampLength,
      height: rampHeight
    });
  }

  public getElevationAt(x: number, z: number): number {
    const clampedZ = Math.max(0, Math.min(1250, z));
    const t = clampedZ / 1250;
    const splinePoint = this.splineCurve.getPoint(t);

    for (const ramp of this.ramps) {
      const dist = ramp.position.distanceTo(new THREE.Vector3(x, ramp.position.y, z));
      if (dist < ramp.length * 0.6 && Math.abs(x - ramp.position.x) < ramp.width / 2) {
        return ramp.position.y + ramp.height;
      }
    }

    return splinePoint.y;
  }
}
