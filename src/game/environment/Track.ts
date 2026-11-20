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
  public sampledPoints: THREE.Vector3[] = [];
  public ramps: RampCollider[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. British Countryside Highway Spline
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(15, 0.5, 80),
      new THREE.Vector3(-25, 2.0, 180),
      new THREE.Vector3(-55, 4.0, 300), // Sweeping left curve
      new THREE.Vector3(-30, 7.5, 420), // Hill climb
      new THREE.Vector3(15, 11.0, 520), // Crest with Stunt Jump Ramp
      new THREE.Vector3(60, 5.5, 640),  // Downhill curve
      new THREE.Vector3(40, 2.0, 760),
      new THREE.Vector3(-15, 1.0, 880), // S-curve through autumn trees
      new THREE.Vector3(-40, 2.5, 1000),
      new THREE.Vector3(-10, 0.5, 1120),
      new THREE.Vector3(0, 0.0, 1250)   // Final sprint to finish
    ];

    this.splineCurve = new THREE.CatmullRomCurve3(points);
    this.splineCurve.curveType = 'catmullrom';
    this.splineCurve.tension = 0.5;

    // Pre-sample spline points for ultrafast O(1) nearest-point lookups
    this.sampledPoints = this.splineCurve.getPoints(400);

    this.setupAtmosphere();
    this.buildTerrain();
    this.buildRoad();
    this.buildArmcoGuardrails();
    this.buildTrackArchitecture();
    this.buildAutumnTrees();
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

  // 1. Golden Hour Autumn Sky & Directional Lighting
  private setupAtmosphere() {
    this.scene.background = new THREE.Color(0x90c4f8);

    // Sky Dome
    const sky = new Sky();
    sky.scale.setScalar(1700);
    this.trackGroup.add(sky);

    const sun = new THREE.Vector3();
    const uniforms = sky.material.uniforms;
    uniforms['turbidity'].value = 3.5;
    uniforms['rayleigh'].value = 1.1;
    uniforms['mieCoefficient'].value = 0.005;
    uniforms['mieDirectionalG'].value = 0.8;

    const elevation = 42;
    const azimuth = 195;
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    sun.setFromSphericalCoords(1, phi, theta);
    uniforms['sunPosition'].value.copy(sun);

    // Balanced Photographic Lighting (Prevents blown-out whiteout)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(ambientLight);

    // Directional Sunlight
    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.8);
    dirLight.position.set(100, 140, 100);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 450;
    const d = 90;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0004;
    this.scene.add(dirLight);

    // Natural Sky & Grass Bounce
    const hemiLight = new THREE.HemisphereLight(0x7ec8f8, 0x2e5c1e, 0.55);
    this.scene.add(hemiLight);
  }

  // 2. Rolling British Hills Contouring Along the Spline Roadbed
  private buildTerrain() {
    const terrainGeo = new THREE.PlaneGeometry(1200, 1600, 90, 90);
    terrainGeo.rotateX(-Math.PI / 2);
    // Align terrain center directly with the track span (0 to 1250m)
    terrainGeo.translate(0, 0, 625);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);

      // Distance from this world vertex to the actual spline road
      const { point, dist } = this.getClosestSplinePoint(vx, vz);

      if (dist < 7.2) {
        // Flat roadbed indentation under the asphalt road
        pos.setY(i, point.y - 0.35);
      } else {
        // Rolling countryside rising on either side of the road
        const flankDist = dist - 7.2;
        const rolling = Math.sin(vx * 0.015) * Math.cos(vz * 0.01) * 7.0;
        const elevation = point.y - 0.35 + flankDist * 0.11 + Math.max(-1.5, rolling);
        pos.setY(i, elevation);
      }
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x3d6124, // Lush British meadow green
      roughness: 0.88,
      metalness: 0.04
    });

    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.position.set(0, 0, 0);
    terrain.receiveShadow = true;
    this.trackGroup.add(terrain);
  }

  // 3. Smooth Two-Lane Country Road with Visible Asphalt & Skid Marks
  private buildRoad() {
    const numSteps = 500;
    const roadWidth = 12.0;

    const roadGeo = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Road Texture Canvas (Asphalt + Red/White curbs + Center lines + Skid marks)
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Asphalt Base (Rich dark charcoal asphalt)
    ctx.fillStyle = '#1c1e23';
    ctx.fillRect(0, 0, 512, 1024);

    // Asphalt Grain Texture
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let i = 0; i < 5000; i++) {
      ctx.fillRect(Math.random() * 512, Math.random() * 1024, 2, 2);
    }

    // Outer Red/White Racing Curbs
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

      // Elevated +0.22m to ensure it sits visibly above the green terrain
      vertices.push(left.x, left.y + 0.22, left.z);
      vertices.push(right.x, right.y + 0.22, right.z);

      uvs.push(0, t * 50);
      uvs.push(1, t * 50);

      if (i < numSteps) {
        const base = i * 2;
        // Winding order facing UP towards the sky
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
  }

  // 4. Armco Galvanized Steel Crash Barriers
  private buildArmcoGuardrails() {
    const numSteps = 300;
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

        if (i % 4 === 0) {
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(barrierPos.x, barrierPos.y - 0.25, barrierPos.z);
          post.castShadow = true;
          postGroup.add(post);
        }
      }

      const railCurve = new THREE.CatmullRomCurve3(railPoints);
      const railGeo = new THREE.TubeGeometry(railCurve, numSteps, 0.14, 8, false);
      const railMesh = new THREE.Mesh(railGeo, railMat);
      railMesh.castShadow = true;
      railMesh.receiveShadow = true;

      this.trackGroup.add(railMesh);
      this.trackGroup.add(postGroup);
    }
  }

  // 5. Overhead Highway Gantries, Start Line Archway & Distance Boards
  private buildTrackArchitecture() {
    // A. Start Line Gantry Archway (at t = 0.038, z ~ 45m ahead of starting grid)
    const startPt = this.splineCurve.getPoint(0.038);
    const startTang = this.splineCurve.getTangent(0.038);

    const archGroup = new THREE.Group();
    archGroup.position.copy(startPt);
    archGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), startTang);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1f242d, metalness: 0.8, roughness: 0.3 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });

    // Left & Right Pillars
    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6.5, 0.8), pillarMat);
    pillarL.position.set(-7.5, 3.25, 0);
    pillarL.castShadow = true;
    const pillarR = pillarL.clone();
    pillarR.position.x = 7.5;

    // Crossbeam
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
    banner.rotation.y = Math.PI; // Face forwards towards approaching grid
    banner.position.set(0, 6.0, -0.52);

    archGroup.add(pillarL, pillarR, crossbeam, banner);
    this.trackGroup.add(archGroup);

    // B. Highway Gantry Signs at t = 0.25 and t = 0.65
    for (const gantryT of [0.25, 0.65]) {
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

      // Highway Sign Board
      const signBoard = new THREE.Mesh(
        new THREE.BoxGeometry(6.5, 2.2, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x007749, roughness: 0.4 })
      );
      signBoard.position.set(-2.5, 5.2, 0);

      gantry.add(pL, pR, beam, signBoard);
      this.trackGroup.add(gantry);
    }
  }

  // 6. Lush Autumn Trees (Forza Horizon 4 Autumn Colors)
  private buildAutumnTrees() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x382315, roughness: 0.92 });
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.45, 5.0, 10);

    const autumnColors = [
      0x9b2226, // Deep Crimson Maple
      0xae2012, // Burnt Autumn Red
      0xca6702, // Golden Amber
      0xbb3e03, // Rust Sienna
      0x283618, // Deep Pine/Evergreen
      0x606c38  // Olive Moss
    ];

    for (let i = 0; i < 240; i++) {
      const t = Math.random();
      const pt = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const side = Math.random() > 0.5 ? 1 : -1;
      const distance = 9.5 + Math.random() * 38.0;
      const treePos = pt.clone().add(binormal.multiplyScalar(side * distance));

      const groundY = Math.max(-0.2, this.getElevationAt(treePos.x, treePos.z) - 0.3);

      const tree = new THREE.Group();
      tree.position.set(treePos.x, groundY, treePos.z);

      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2.5;
      trunk.castShadow = true;
      tree.add(trunk);

      const color = autumnColors[Math.floor(Math.random() * autumnColors.length)];
      const foliageMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.82,
        metalness: 0.02
      });

      const scale = 1.1 + Math.random() * 0.9;
      const c1 = new THREE.Mesh(new THREE.SphereGeometry(1.8 * scale, 12, 10), foliageMat);
      c1.position.set(0, 5.2 * scale, 0);
      c1.castShadow = true;

      const c2 = new THREE.Mesh(new THREE.SphereGeometry(1.4 * scale, 10, 8), foliageMat);
      c2.position.set(0.4 * scale, 6.4 * scale, 0.3 * scale);
      c2.castShadow = true;

      const c3 = new THREE.Mesh(new THREE.SphereGeometry(1.5 * scale, 10, 8), foliageMat);
      c3.position.set(-0.4 * scale, 5.8 * scale, -0.3 * scale);
      c3.castShadow = true;

      tree.add(c1, c2, c3);
      this.trackGroup.add(tree);
    }
  }

  // 7. Asphalt 9 Jump Ramp
  private buildJumpRamps() {
    const rampPoint = this.splineCurve.getPoint(0.42);
    const tangent = this.splineCurve.getTangent(0.42);

    const rampGroup = new THREE.Group();
    rampGroup.position.copy(rampPoint);
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
      position: rampPoint,
      width: rampWidth,
      length: rampLength,
      height: rampHeight
    });
  }

  public getRoadCenterAtZ(z: number): { x: number; y: number } {
    const clampedZ = Math.max(0, Math.min(1250, z));
    const t = clampedZ / 1250;
    const pt = this.splineCurve.getPoint(t);
    return { x: pt.x, y: pt.y };
  }

  public getElevationAt(x: number, z: number): number {
    const { point } = this.getClosestSplinePoint(x, z);

    for (const ramp of this.ramps) {
      const dist = ramp.position.distanceTo(new THREE.Vector3(x, ramp.position.y, z));
      if (dist < ramp.length * 0.6 && Math.abs(x - ramp.position.x) < ramp.width / 2) {
        return ramp.position.y + ramp.height;
      }
    }

    return point.y;
  }
}
