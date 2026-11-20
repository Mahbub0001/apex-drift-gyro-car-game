import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
  public sampledPoints: THREE.Vector3[] = [];
  public ramps: RampCollider[] = [];
  public dirLight!: THREE.DirectionalLight;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Grand Countryside Highway Circuit (Closed Seamless Loop ~3.8 KM)
    const points = [
      // Sector 1: Start/Finish Straightaway (facing +Z)
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 160),
      new THREE.Vector3(0, 0, 320),

      // Sector 2: Sweeping Mountain Foothills Pass (Turn 1-2)
      new THREE.Vector3(60, 2.5, 520),
      new THREE.Vector3(140, 5.0, 740),
      new THREE.Vector3(180, 8.5, 960),

      // Sector 3: Alpine Hillclimb & Stunt Jump Ramp (Turn 3-4)
      new THREE.Vector3(150, 12.0, 1180),
      new THREE.Vector3(70, 7.5, 1400),

      // Sector 4: Forest Hairpin & S-Bends (Turn 5-7)
      new THREE.Vector3(-40, 4.0, 1540),
      new THREE.Vector3(-150, 2.0, 1460),
      new THREE.Vector3(-230, 1.5, 1280),

      // Sector 5: Return Valley Highway (Turn 8-9)
      new THREE.Vector3(-270, 3.5, 1020),
      new THREE.Vector3(-260, 6.0, 740),
      new THREE.Vector3(-210, 4.0, 460),

      // Sector 6: Sweeping Turn 10-12 Reconnecting into Start Grid
      new THREE.Vector3(-140, 2.0, 200),
      new THREE.Vector3(-60, 0.8, 40),
      new THREE.Vector3(-15, 0.2, -60),
      new THREE.Vector3(0, 0.0, -120),
      new THREE.Vector3(0, 0.0, -60)
    ];

    this.splineCurve = new THREE.CatmullRomCurve3(points, true); // CLOSED = TRUE!
    this.splineCurve.curveType = 'catmullrom';
    this.splineCurve.tension = 0.5;

    // Pre-sample spline points for ultrafast O(1) nearest-point lookups
    this.sampledPoints = this.splineCurve.getPoints(600);

    this.setupLighting();
    this.buildTerrain();
    this.buildRoad();
    this.buildArmcoGuardrails();
    this.buildTrackArchitecture();
    this.buildTrees();
    this.buildRoadsideBoulders();
    this.buildJumpRamps();

    this.scene.add(this.trackGroup);
  }

  // Find exact closest track point for robust physics and terrain contouring
  public getClosestSplinePoint(x: number, z: number): {
    point: THREE.Vector3;
    tangent: THREE.Vector3;
    dist: number;
    t: number;
  } {
    let minDistSq = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < this.sampledPoints.length; i++) {
      const p = this.sampledPoints[i];
      const dx = x - p.x;
      const dz = z - p.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        closestIndex = i;
      }
    }

    const t = closestIndex / this.sampledPoints.length;
    return {
      point: this.sampledPoints[closestIndex],
      tangent: this.splineCurve.getTangent(t),
      dist: Math.sqrt(minDistSq),
      t
    };
  }

  // 1. Natural Directional Sunlight & Soft Ambient Fill
  private setupLighting() {
    // Ambient light for soft shadow fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Directional Sunlight with Soft PCF Shadows
    this.dirLight = new THREE.DirectionalLight(0xfffaed, 1.9);
    this.dirLight.position.set(120, 180, 100);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 500;
    const d = 110;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0003;
    this.scene.add(this.dirLight);

    // Hemisphere ground/sky bounce
    const hemiLight = new THREE.HemisphereLight(0x90caf9, 0x335824, 0.6);
    this.scene.add(hemiLight);
  }

  // 2. Rolling British Hills Contouring Seamlessly Along the Grand Circuit
  private buildTerrain() {
    const terrainGeo = new THREE.PlaneGeometry(1600, 2400, 120, 120);
    terrainGeo.rotateX(-Math.PI / 2);
    terrainGeo.translate(-45, 0, 770);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);

      const elev = this.getElevationAt(vx, vz);
      const { dist } = this.getClosestSplinePoint(vx, vz);
      // Depress ground mesh beneath asphalt road ribbon to completely eliminate Z-fighting
      const y = dist < 6.4 ? elev - 0.32 : (dist < 8.4 ? elev - 0.32 * (1 - (dist - 6.4) / 2.0) : elev);
      pos.setY(i, y);
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x3d6124, // Lush British meadow green
      roughness: 0.88,
      metalness: 0.04
    });

    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    this.trackGroup.add(terrain);
  }

  // 4. Smooth Two-Lane Country Road Ribbon (Closed Seamless Circuit)
  private buildRoad() {
    const numSteps = 700;
    const roadWidth = 12.0;

    const roadGeo = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Road Texture Canvas (Asphalt + Red/White Curbs + Double Yellow Dashes + Skid Marks)
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Asphalt Base (Rich dark charcoal asphalt)
    ctx.fillStyle = '#1c1e23';
    ctx.fillRect(0, 0, 512, 1024);

    // Subtle Asphalt Grain Noise
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let i = 0; i < 5000; i++) {
      ctx.fillRect(Math.random() * 512, Math.random() * 1024, 2, 2);
    }

    // Outer Red/White Racing Rumble Strip Curbs
    for (let y = 0; y < 1024; y += 64) {
      ctx.fillStyle = (y / 64) % 2 === 0 ? '#d90429' : '#ffffff';
      ctx.fillRect(0, y, 22, 64);
      ctx.fillRect(490, y, 22, 64);
    }

    // Solid White Edge Lines
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(28, 0, 8, 1024);
    ctx.fillRect(476, 0, 8, 1024);

    // Double Dashed Yellow Center Line
    ctx.fillStyle = '#ffb703';
    for (let y = 0; y < 1024; y += 96) {
      ctx.fillRect(248, y, 6, 56);
      ctx.fillRect(258, y, 6, 56);
    }

    // Dark Rubber Tire Skid Marks on Apex Lines
    ctx.fillStyle = 'rgba(10, 10, 12, 0.35)';
    ctx.beginPath();
    ctx.ellipse(180, 512, 12, 400, 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(332, 512, 12, 400, -0.05, 0, Math.PI * 2);
    ctx.fill();

    const roadTexture = new THREE.CanvasTexture(canvas);
    roadTexture.wrapS = THREE.RepeatWrapping;
    roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(1, 1);
    roadTexture.anisotropy = 8;

    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.65,
      metalness: 0.12,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });

    for (let i = 0; i <= numSteps; i++) {
      const t = i / numSteps;
      const point = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const left = point.clone().add(binormal.clone().multiplyScalar(roadWidth / 2));
      const right = point.clone().add(binormal.clone().multiplyScalar(-roadWidth / 2));

      vertices.push(left.x, left.y + 0.22, left.z);
      vertices.push(right.x, right.y + 0.22, right.z);

      uvs.push(0, t * 140);
      uvs.push(1, t * 140);

      if (i < numSteps) {
        const base = i * 2;
        indices.push(base, base + 2, base + 1);
        indices.push(base + 1, base + 2, base + 3);
      }
    }

    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    this.trackGroup.add(roadMesh);

    // Reflective Cat's-Eye Road Studs along center line every ~15 meters
    const studGeo = new THREE.BoxGeometry(0.12, 0.04, 0.2);
    const studMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    const studGroup = new THREE.Group();

    for (let t = 0; t <= 1.0; t += 0.005) {
      const pt = this.splineCurve.getPoint(t);
      const tang = this.splineCurve.getTangent(t);
      const stud = new THREE.Mesh(studGeo, studMat);
      stud.position.set(pt.x, pt.y + 0.24, pt.z);
      stud.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tang);
      studGroup.add(stud);
    }
    this.trackGroup.add(studGroup);
  }

  // 5. Armco Galvanized Steel Crash Barriers
  private buildArmcoGuardrails() {
    const numSteps = 450;
    const roadWidth = 12.0;

    const railMat = new THREE.MeshStandardMaterial({
      color: 0xa8b0b8,
      metalness: 0.88,
      roughness: 0.3
    });

    const postMat = new THREE.MeshStandardMaterial({
      color: 0x3d352e,
      roughness: 0.95
    });

    const postGeo = new THREE.BoxGeometry(0.18, 0.9, 0.18);

    for (let side of [-1, 1]) {
      const railPoints: THREE.Vector3[] = [];
      const postGroup = new THREE.Group();

      for (let i = 0; i <= numSteps; i++) {
        const t = i / numSteps;
        const pt = this.splineCurve.getPoint(t);
        const tangent = this.splineCurve.getTangent(t);
        const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

        const barrierPos = pt.clone().add(binormal.multiplyScalar(side * (roadWidth / 2 + 0.8)));
        barrierPos.y += 0.55;
        railPoints.push(barrierPos);

        if (i % 3 === 0) {
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(barrierPos.x, barrierPos.y - 0.25, barrierPos.z);
          post.castShadow = true;
          postGroup.add(post);
        }
      }

      const railCurve = new THREE.CatmullRomCurve3(railPoints, true); // Closed tube!
      const railGeo = new THREE.TubeGeometry(railCurve, numSteps, 0.14, 8, true);
      const railMesh = new THREE.Mesh(railGeo, railMat);
      railMesh.castShadow = true;
      railMesh.receiveShadow = true;

      this.trackGroup.add(railMesh);
      this.trackGroup.add(postGroup);
    }
  }

  // 6. Overhead Highway Gantries, Start Line Archway & Distance Boards
  private buildTrackArchitecture() {
    // A. Start Line Gantry Archway (at z = 60m straight across the starting grid)
    const startPt = new THREE.Vector3(0, 0.22, 60);
    const startTang = new THREE.Vector3(0, 0, 1);

    const archGroup = new THREE.Group();
    archGroup.position.copy(startPt);
    archGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), startTang);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1f242d, metalness: 0.8, roughness: 0.3 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });

    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6.5, 0.8), pillarMat);
    pillarL.position.set(-7.5, 3.25, 0);
    pillarL.castShadow = true;
    const pillarR = pillarL.clone();
    pillarR.position.x = 7.5;

    const crossbeam = new THREE.Mesh(new THREE.BoxGeometry(16.5, 1.4, 1.0), beamMat);
    crossbeam.position.set(0, 6.0, 0);
    crossbeam.castShadow = true;

    // Neon Race Banner
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 512;
    bannerCanvas.height = 128;
    const bctx = bannerCanvas.getContext('2d')!;
    bctx.fillStyle = '#0a0e17';
    bctx.fillRect(0, 0, 512, 128);
    bctx.fillStyle = '#00f2fe';
    bctx.font = 'bold 44px sans-serif';
    bctx.textAlign = 'center';
    bctx.fillText('APEX DRIFT HIGHWAY', 256, 75);

    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 1.1),
      new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide })
    );
    banner.rotation.y = Math.PI; // Face approaching vehicles
    banner.position.set(0, 6.0, -0.52);

    archGroup.add(pillarL, pillarR, crossbeam, banner);
    this.trackGroup.add(archGroup);

    // B. Highway Gantry Signs at t = 0.25, 0.55, 0.82
    for (const gantryT of [0.25, 0.55, 0.82]) {
      const pt = this.splineCurve.getPoint(gantryT);
      const tang = this.splineCurve.getTangent(gantryT);

      const gantry = new THREE.Group();
      gantry.position.copy(pt);
      gantry.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tang);

      const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 7.0, 12), pillarMat);
      pL.position.set(-7.5, 3.5, 0);
      const pR = pL.clone();
      pR.position.x = 7.5;

      const beam = new THREE.Mesh(new THREE.BoxGeometry(16.0, 0.4, 0.4), pillarMat);
      beam.position.set(0, 6.5, 0);

      const signBoard = new THREE.Mesh(
        new THREE.BoxGeometry(6.5, 2.2, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x007749, roughness: 0.4 })
      );
      signBoard.position.set(-2.5, 5.2, 0);

      gantry.add(pL, pR, beam, signBoard);
      this.trackGroup.add(gantry);
    }
  }

  // 7. Authentic Photorealistic 3D Trees & Foliage along Highway
  private createOakTemplate(): THREE.Group {
    const group = new THREE.Group();

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x3d2817,
      roughness: 0.95,
      metalness: 0.05
    });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.46, 8.0, 12), trunkMat);
    trunk.position.y = 4.0;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // Spreading branch boughs
    const branchGeo = new THREE.CylinderGeometry(0.16, 0.26, 3.4, 8);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + 0.3;
      const branch = new THREE.Mesh(branchGeo, trunkMat);
      branch.position.set(Math.cos(angle) * 0.9, 6.0, Math.sin(angle) * 0.9);
      branch.rotation.set(Math.sin(angle) * 0.55, 0, -Math.cos(angle) * 0.55);
      branch.castShadow = true;
      group.add(branch);
    }

    // Lush organic multi-lobed canopy with smooth normals (Icosahedron subdiv 2)
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x2e5927,
      roughness: 0.82,
      metalness: 0.04
    });

    const leafMatHighlight = new THREE.MeshStandardMaterial({
      color: 0x3a6b32,
      roughness: 0.8,
      metalness: 0.04
    });

    const lobes: [number, number, number, number, boolean][] = [
      [0, 8.5, 0, 3.6, false],
      [1.7, 7.4, 1.2, 2.6, true],
      [-1.6, 7.5, -1.0, 2.7, false],
      [-1.2, 7.1, 1.5, 2.5, true],
      [1.4, 6.9, -1.5, 2.4, false],
      [0, 10.4, 0, 2.3, true]
    ];

    lobes.forEach(([x, y, z, r, isHigh]) => {
      const lobe = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r, 2),
        isHigh ? leafMatHighlight : leafMat
      );
      lobe.position.set(x, y, z);
      lobe.castShadow = true;
      lobe.receiveShadow = true;
      group.add(lobe);
    });

    return group;
  }

  private createPineTemplate(): THREE.Group {
    const group = new THREE.Group();

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x2e1d13,
      roughness: 0.95,
      metalness: 0.05
    });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.36, 11.5, 10), trunkMat);
    trunk.position.y = 5.75;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    const needleMat = new THREE.MeshStandardMaterial({
      color: 0x1b3c22,
      roughness: 0.85,
      metalness: 0.05
    });

    const needleMatUpper = new THREE.MeshStandardMaterial({
      color: 0x224c2b,
      roughness: 0.82,
      metalness: 0.05
    });

    const tiers = [
      { y: 5.0, r: 3.2, h: 3.0, mat: needleMat },
      { y: 6.9, r: 2.6, h: 2.8, mat: needleMat },
      { y: 8.7, r: 2.0, h: 2.5, mat: needleMatUpper },
      { y: 10.3, r: 1.5, h: 2.2, mat: needleMatUpper },
      { y: 11.7, r: 0.8, h: 1.8, mat: needleMatUpper }
    ];

    tiers.forEach((t) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 14), t.mat);
      cone.position.y = t.y;
      cone.castShadow = true;
      cone.receiveShadow = true;
      group.add(cone);
    });

    return group;
  }

  private buildTrees() {
    const oakTemplate = this.createOakTemplate();
    const pineTemplate = this.createPineTemplate();
    const treeGroup = new THREE.Group();

    // 1. Densely line the entire 3.8 KM circuit with alternating Oaks and Pines
    const count = 260;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pt = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const side = (i % 2 === 0 ? 1 : -1) * (i % 3 === 0 ? -1 : 1);
      const distance = 10.5 + (i % 4) * 3.8 + Math.random() * 4.5;
      const treePos = pt.clone().add(binormal.multiplyScalar(side * distance));

      // Absolute safety constraint: never place any tree within 9.5m of ANY road surface!
      const { dist } = this.getClosestSplinePoint(treePos.x, treePos.z);
      if (dist < 9.5) continue;

      const groundY = this.getElevationAt(treePos.x, treePos.z);

      const template = i % 2 === 0 ? oakTemplate : pineTemplate;
      const tree = template.clone(true);
      const scale = 0.95 + (i % 4) * 0.12 + Math.random() * 0.15;
      tree.scale.set(scale, scale * (0.95 + Math.random() * 0.2), scale);
      tree.position.set(treePos.x, groundY, treePos.z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      treeGroup.add(tree);
    }

    // 2. Majestic Tree Avenue along the Starting Straightaway (Z = 25 to 320)
    for (let z = 25; z <= 320; z += 35) {
      for (const side of [-1, 1]) {
        for (const distOffset of [11.5, 17.0]) {
          const treePos = new THREE.Vector3(side * distOffset, 0, z);

          // Absolute safety constraint: never place any tree within 9.5m of ANY road surface!
          const { dist } = this.getClosestSplinePoint(treePos.x, treePos.z);
          if (dist < 9.5) continue;

          const groundY = this.getElevationAt(treePos.x, treePos.z);

          const template = (z + (side > 0 ? 10 : 0)) % 70 === 0 ? pineTemplate : oakTemplate;
          const tree = template.clone(true);
          const scale = 1.0 + Math.random() * 0.2;
          tree.scale.set(scale, scale * (0.95 + Math.random() * 0.15), scale);
          tree.position.set(treePos.x, groundY, treePos.z);
          tree.rotation.y = Math.random() * Math.PI * 2;
          treeGroup.add(tree);
        }
      }
    }

    this.trackGroup.add(treeGroup);
  }

  // 8. Natural Granite Boulders & Rock Formations along Mountain Foothills
  private buildRoadsideBoulders() {
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x5a544c,
      roughness: 0.95,
      metalness: 0.05
    });

    const rockGroup = new THREE.Group();

    for (let i = 0; i < 30; i++) {
      const t = 0.28 + (i / 30) * 0.42;
      const pt = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const side = i % 2 === 0 ? 1 : -1;
      const dist = 14.0 + Math.random() * 16.0;
      const rockPos = pt.clone().add(binormal.multiplyScalar(side * dist));

      const rockScale = 1.2 + Math.random() * 2.2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rockScale, 1), rockMat);
      const groundY = this.getElevationAt(rockPos.x, rockPos.z);
      rock.position.set(rockPos.x, groundY + rockScale * 0.35, rockPos.z);
      rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      rock.castShadow = true;
      rockGroup.add(rock);
    }

    this.trackGroup.add(rockGroup);
  }

  // 9. Asphalt 9 Stunt Jump Ramp perched on Alpine Crest
  private buildJumpRamps() {
    const rampT = 0.38; // Hillcrest at turn 3
    const rampPoint = this.splineCurve.getPoint(rampT);
    const tangent = this.splineCurve.getTangent(rampT);

    const rampGroup = new THREE.Group();
    rampGroup.position.set(rampPoint.x, rampPoint.y + 0.22, rampPoint.z);
    rampGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

    const rampWidth = 6.0;
    const rampLength = 9.0;
    const rampHeight = 2.2;

    const rampGeo = new THREE.BoxGeometry(rampWidth, rampHeight, rampLength);
    rampGeo.rotateX(Math.PI / 14);
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

    // Glowing Neon Boost Chevrons
    const chevronGeo = new THREE.BoxGeometry(rampWidth * 0.8, 0.12, 0.45);
    const chevronMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    const chevron = new THREE.Mesh(chevronGeo, chevronMat);
    chevron.position.set(0, rampHeight * 0.82, 2.2);
    rampGroup.add(chevron);

    this.trackGroup.add(rampGroup);

    this.ramps.push({
      position: new THREE.Vector3(rampPoint.x, rampPoint.y + 0.22, rampPoint.z),
      width: rampWidth,
      length: rampLength,
      height: rampHeight
    });
  }

  public getRoadCenterAtZ(z: number): { x: number; y: number } {
    const { point } = this.getClosestSplinePoint(0, z);
    return { x: point.x, y: point.y };
  }

  public getElevationAt(x: number, z: number): number {
    const { point, dist } = this.getClosestSplinePoint(x, z);

    for (const ramp of this.ramps) {
      const d = ramp.position.distanceTo(new THREE.Vector3(x, ramp.position.y, z));
      if (d < ramp.length * 0.6 && Math.abs(x - ramp.position.x) < ramp.width / 2) {
        return ramp.position.y + ramp.height;
      }
    }

    if (dist < 6.5) {
      // Direct asphalt road surface height
      return point.y + 0.22;
    } else if (dist < 8.5) {
      // Soft transition from asphalt curb edge to ground
      const t = (dist - 6.5) / 2.0;
      return (point.y + 0.22) * (1 - t) + (point.y - 0.05) * t;
    } else {
      // Rolling meadow countryside
      const flankDist = dist - 8.5;
      const rolling = Math.sin(x * 0.012) * Math.cos(z * 0.009) * 3.5;
      return point.y - 0.05 + Math.min(12.0, flankDist * 0.035) + rolling * Math.min(1.0, flankDist / 15.0);
    }
  }
}
