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

    // 1. Winding British Countryside Highway Spline
    const points = [
      new THREE.Vector3(0, 0, -40),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 60),      // Starting straight
      new THREE.Vector3(0, 0, 140),     // Straight through start archway (which is at z=50)
      new THREE.Vector3(18, 0.5, 240),  // Smooth sweeping right
      new THREE.Vector3(-25, 2.0, 360), // Sweeping left
      new THREE.Vector3(-55, 4.0, 480), // Highway bend
      new THREE.Vector3(-30, 7.5, 600), // Countryside hill
      new THREE.Vector3(15, 11.0, 720), // Stunt jump ramp crest
      new THREE.Vector3(60, 5.5, 840),  // Downhill wide sweep
      new THREE.Vector3(40, 2.0, 960),
      new THREE.Vector3(-15, 1.0, 1080),// S-curve through forest
      new THREE.Vector3(-40, 2.5, 1200),
      new THREE.Vector3(-10, 0.5, 1320),
      new THREE.Vector3(0, 0.0, 1440),  // Final straightaway
      new THREE.Vector3(0, 0.0, 1500)
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
    this.buildDistantMountains();
    this.buildFluffyClouds();
    this.buildTrackArchitecture();
    this.buildAutumnTrees();
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

  // 1. Golden Hour Autumn Sky & Directional Lighting
  private setupAtmosphere() {
    this.scene.background = new THREE.Color(0x8bc0f8);

    // Sky Dome
    const sky = new Sky();
    sky.scale.setScalar(1700);
    this.trackGroup.add(sky);

    const sun = new THREE.Vector3();
    const uniforms = sky.material.uniforms;
    uniforms['turbidity'].value = 3.2;
    uniforms['rayleigh'].value = 1.05;
    uniforms['mieCoefficient'].value = 0.005;
    uniforms['mieDirectionalG'].value = 0.8;

    const elevation = 42;
    const azimuth = 195;
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    sun.setFromSphericalCoords(1, phi, theta);
    uniforms['sunPosition'].value.copy(sun);

    // Natural Balanced Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(ambientLight);

    // Directional Sunlight with Soft Shadows
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

    // Hemisphere bounce
    const hemiLight = new THREE.HemisphereLight(0x7ec8f8, 0x2e5c1e, 0.55);
    this.scene.add(hemiLight);
  }

  // 2. Distant Majestic Mountain Ranges on the Horizon
  private buildDistantMountains() {
    const mountainMat = new THREE.MeshStandardMaterial({
      color: 0x4a5d6e, // Slate blue mountain haze
      roughness: 0.95,
      metalness: 0.05
    });

    const mountainGroup = new THREE.Group();

    // Ring of 28 distant mountain peaks safely outside the play area
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2;
      const radius = 680 + Math.random() * 120;
      const mx = Math.cos(angle) * radius;
      const mz = 700 + Math.sin(angle) * radius;

      // Ensure mountain is at least 300m away from any track point
      const { dist } = this.getClosestSplinePoint(mx, mz);
      if (dist < 300) continue;

      const peakHeight = 110 + Math.random() * 110;
      const baseRadius = 110 + Math.random() * 50;

      const cone = new THREE.Mesh(new THREE.ConeGeometry(baseRadius, peakHeight, 8), mountainMat);
      cone.position.set(mx, peakHeight * 0.42, mz);
      mountainGroup.add(cone);
    }

    this.trackGroup.add(mountainGroup);
  }

  // 3. Volumetric Fluffy White Clouds in the Sky
  private buildFluffyClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: 0.85
    });

    const cloudGroup = new THREE.Group();

    for (let i = 0; i < 18; i++) {
      const cx = (Math.random() - 0.5) * 800;
      const cz = (Math.random() - 0.5) * 1200 + 625;
      const cy = 110 + Math.random() * 45;

      const cloud = new THREE.Group();
      cloud.position.set(cx, cy, cz);

      // Cloud puff clusters (3 to 5 overlapping spheres)
      const puffs = 3 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffs; p++) {
        const radius = 18 + Math.random() * 14;
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 8), cloudMat);
        sphere.position.set((p - puffs / 2) * 18, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 12);
        cloud.add(sphere);
      }

      cloudGroup.add(cloud);
    }

    this.trackGroup.add(cloudGroup);
  }

  // 4. Rolling British Hills Contouring Along the Spline Roadbed
  private buildTerrain() {
    const terrainGeo = new THREE.PlaneGeometry(1400, 1900, 100, 100);
    terrainGeo.rotateX(-Math.PI / 2);
    terrainGeo.translate(0, 0, 720);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);

      pos.setY(i, this.getElevationAt(vx, vz));
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

  // 5. Smooth Two-Lane Country Road with Visible Asphalt, Cat's-Eyes & Rumble Strips
  private buildRoad() {
    const numSteps = 500;
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

    // Reflective Cat's-Eye Road Studs along center line every 12 meters
    const studGeo = new THREE.BoxGeometry(0.12, 0.04, 0.2);
    const studMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    const studGroup = new THREE.Group();

    for (let t = 0; t <= 1.0; t += 0.01) {
      const pt = this.splineCurve.getPoint(t);
      const tang = this.splineCurve.getTangent(t);
      const stud = new THREE.Mesh(studGeo, studMat);
      stud.position.set(pt.x, pt.y + 0.24, pt.z);
      stud.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tang);
      studGroup.add(stud);
    }
    this.trackGroup.add(studGroup);
  }

  // 6. Armco Galvanized Steel Crash Barriers
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

  // 7. Overhead Highway Gantries, Start Line Archway & Distance Boards
  private buildTrackArchitecture() {
    // A. Start Line Gantry Archway (at z = 50m straight across the starting grid)
    const startPt = new THREE.Vector3(0, 0.22, 50);
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

      const signBoard = new THREE.Mesh(
        new THREE.BoxGeometry(6.5, 2.2, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x007749, roughness: 0.4 })
      );
      signBoard.position.set(-2.5, 5.2, 0);

      gantry.add(pL, pR, beam, signBoard);
      this.trackGroup.add(gantry);
    }

    // C. Trackside Distance Braking Boards before curves
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.5 });
    const textMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    [0.18, 0.195, 0.21, 0.48, 0.495, 0.51].forEach((tVal, idx) => {
      const pt = this.splineCurve.getPoint(tVal);
      const tang = this.splineCurve.getTangent(tVal);
      const binormal = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0, 1, 0)).normalize();

      const boardGroup = new THREE.Group();
      boardGroup.position.copy(pt).add(binormal.multiplyScalar(7.2));
      boardGroup.position.y += 0.8;
      boardGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tang);

      const board = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.08), boardMat);
      const textStripe = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.09), textMat);
      textStripe.position.y = 0.2;

      boardGroup.add(board, textStripe);
      this.trackGroup.add(boardGroup);
    });
  }

  // 8. Natural Autumn Trees with Multi-Tier Foliage & Branching
  private buildAutumnTrees() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2719, roughness: 0.95 });
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.48, 5.2, 10);

    const autumnColors = [
      0x9b2226, // Deep Crimson Maple
      0xae2012, // Burnt Autumn Red
      0xca6702, // Golden Amber
      0xbb3e03, // Rust Sienna
      0x283618, // Deep Pine/Evergreen
      0x606c38  // Olive Moss
    ];

    for (let i = 0; i < 200; i++) {
      const t = 0.02 + Math.random() * 0.96;
      const pt = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const side = Math.random() > 0.5 ? 1 : -1;
      const distance = 9.8 + Math.random() * 32.0;
      const treePos = pt.clone().add(binormal.multiplyScalar(side * distance));

      const groundY = this.getElevationAt(treePos.x, treePos.z);

      const tree = new THREE.Group();
      tree.position.set(treePos.x, groundY, treePos.z);
      tree.rotation.y = Math.random() * Math.PI * 2;

      // Realistic Trunk with Natural Lean
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2.6; // Trunk base rests directly on ground
      trunk.rotation.z = (Math.random() - 0.5) * 0.08;
      trunk.castShadow = true;
      tree.add(trunk);

      // Multi-layer organic foliage attached to the trunk
      const color = autumnColors[Math.floor(Math.random() * autumnColors.length)];
      const foliageMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.82,
        metalness: 0.02
      });

      const scale = 1.05 + Math.random() * 0.95;

      const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.9 * scale, 1), foliageMat);
      c1.position.set(0, 5.0 * scale, 0);
      c1.castShadow = true;

      const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 * scale, 1), foliageMat);
      c2.position.set(0.4 * scale, 6.2 * scale, 0.3 * scale);
      c2.castShadow = true;

      const c3 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5 * scale, 1), foliageMat);
      c3.position.set(-0.4 * scale, 5.5 * scale, -0.3 * scale);
      c3.castShadow = true;

      tree.add(c1, c2, c3);
      this.trackGroup.add(tree);
    }
  }

  // 9. Natural Granite Boulders & Rock Formations along Road Shoulders
  private buildRoadsideBoulders() {
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x5a544c,
      roughness: 0.95,
      metalness: 0.05
    });

    const rockGroup = new THREE.Group();

    for (let i = 0; i < 40; i++) {
      const t = 0.04 + Math.random() * 0.92;
      const pt = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const side = Math.random() > 0.5 ? 1 : -1;
      const dist = 8.2 + Math.random() * 5.5;
      const rockPos = pt.clone().add(binormal.multiplyScalar(side * dist));

      const rockScale = 0.8 + Math.random() * 1.5;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rockScale, 1), rockMat);
      const groundY = this.getElevationAt(rockPos.x, rockPos.z);
      rock.position.set(rockPos.x, groundY + rockScale * 0.35, rockPos.z);
      rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      rock.castShadow = true;
      rockGroup.add(rock);
    }

    this.trackGroup.add(rockGroup);
  }

  // 10. Asphalt 9 Stunt Jump Ramp
  private buildJumpRamps() {
    const rampT = 0.47;
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
    const clampedZ = Math.max(0, Math.min(1500, z));
    const t = clampedZ / 1500;
    const pt = this.splineCurve.getPoint(t);
    return { x: pt.x, y: pt.y };
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
      return point.y - 0.05 + Math.min(10.0, flankDist * 0.035) + rolling * Math.min(1.0, flankDist / 15.0);
    }
  }
}
