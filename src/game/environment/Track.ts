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
    this.buildChevronSigns();
    this.buildBrakeMarkers();
    this.buildHighwayStreetlights();
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
    const terrainGeo = new THREE.PlaneGeometry(1600, 2400, 140, 140);
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

    // Procedural High-Detail Meadow & Soil Texture Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Base rich alpine meadow green
    ctx.fillStyle = '#2c4b1b';
    ctx.fillRect(0, 0, 1024, 1024);

    // Multi-frequency noise for organic grass patches, clover & dry soil
    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;

    for (let y = 0; y < 1024; y++) {
      for (let x = 0; x < 1024; x++) {
        const idx = (y * 1024 + x) * 4;
        const n1 = Math.sin(x * 0.035) * Math.cos(y * 0.035);
        const n2 = Math.sin(x * 0.12 + y * 0.08) * 0.5;
        const n3 = Math.sin(x * 0.45) * Math.sin(y * 0.45) * 0.25;
        const noise = (n1 + n2 + n3 + 1.75) / 3.5; // [0, 1]

        // Blend between deep forest moss (#233f16), vibrant turf (#3a6824), and dry prairie grass (#4a5c24)
        const r = Math.floor(35 + noise * 38);
        const g = Math.floor(62 + noise * 48);
        const b = Math.floor(22 + noise * 18);

        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Subtle fine micro-speckle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let i = 0; i < 8000; i++) {
      ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
    }

    const terrainTexture = new THREE.CanvasTexture(canvas);
    terrainTexture.wrapS = THREE.RepeatWrapping;
    terrainTexture.wrapT = THREE.RepeatWrapping;
    terrainTexture.repeat.set(48, 72);
    terrainTexture.anisotropy = 8;

    const terrainMat = new THREE.MeshStandardMaterial({
      map: terrainTexture,
      roughness: 0.92,
      metalness: 0.03
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

  // 6b. Dynamic Racetrack Warning Chevron Arrow Signs on Curves (>>> / <<<)
  private buildChevronSigns() {
    const chevronGroup = new THREE.Group();

    // Sharp curve zones: t values and sign directions (1 = curve right, -1 = curve left)
    const curveLocations = [
      { t: 0.08, dir: 1, count: 5 },  // Turn 1
      { t: 0.16, dir: 1, count: 5 },  // Turn 2
      { t: 0.28, dir: -1, count: 6 }, // Turn 3-4 Alpine crest
      { t: 0.44, dir: -1, count: 7 }, // Turn 5 Forest Hairpin
      { t: 0.52, dir: 1, count: 5 },  // Turn 6 S-Bend
      { t: 0.65, dir: -1, count: 5 }, // Turn 8 Valley sweep
      { t: 0.88, dir: 1, count: 5 }   // Turn 11 Final entry
    ];

    // High-visibility reflective yellow canvas with bold black chevron arrow
    const createChevronTex = (dir: number) => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;

      ctx.fillStyle = '#ffcc00'; // High-vis highway yellow
      ctx.fillRect(0, 0, 256, 256);

      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 10;
      ctx.strokeRect(8, 8, 240, 240);

      // Arrow
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      if (dir === 1) {
        // >>> pointing right
        ctx.moveTo(70, 40);
        ctx.lineTo(170, 128);
        ctx.lineTo(70, 216);
        ctx.lineTo(105, 216);
        ctx.lineTo(205, 128);
        ctx.lineTo(105, 40);
      } else {
        // <<< pointing left
        ctx.moveTo(186, 40);
        ctx.lineTo(86, 128);
        ctx.lineTo(186, 216);
        ctx.lineTo(151, 216);
        ctx.lineTo(51, 128);
        ctx.lineTo(151, 40);
      }
      ctx.closePath();
      ctx.fill();

      const tex = new THREE.CanvasTexture(c);
      return tex;
    };

    const rightTex = createChevronTex(1);
    const leftTex = createChevronTex(-1);

    const postMat = new THREE.MeshStandardMaterial({ color: 0x495057, metalness: 0.85, roughness: 0.25 });
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8);
    const boardGeo = new THREE.PlaneGeometry(1.4, 1.4);

    curveLocations.forEach(({ t, dir, count }) => {
      const mat = new THREE.MeshBasicMaterial({ map: dir === 1 ? rightTex : leftTex, side: THREE.DoubleSide });

      for (let j = 0; j < count; j++) {
        const signT = (t + j * 0.007) % 1.0;
        const pt = this.splineCurve.getPoint(signT);
        const tang = this.splineCurve.getTangent(signT);
        const binorm = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0, 1, 0)).normalize();

        // Place on outer barrier of the curve
        const sideOffset = -dir * 7.1;
        const pos = pt.clone().add(binorm.multiplyScalar(sideOffset));
        pos.y += 0.85;

        const signMesh = new THREE.Group();
        signMesh.position.copy(pos);

        // Turn board to face approaching driver
        const lookTarget = pt.clone().add(tang.clone().multiplyScalar(-18));
        signMesh.lookAt(lookTarget);

        const board = new THREE.Mesh(boardGeo, mat);
        board.position.y = 0.55;

        const post = new THREE.Mesh(postGeo, postMat);
        post.position.y = -0.15;
        post.castShadow = true;

        signMesh.add(board, post);
        chevronGroup.add(signMesh);
      }
    });

    this.trackGroup.add(chevronGroup);
  }

  // 6c. Racetrack Braking Distance Countdown Markers (150m, 100m, 50m)
  private buildBrakeMarkers() {
    const markerGroup = new THREE.Group();

    const createBrakeBoard = (text: string) => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 160;
      const ctx = c.getContext('2d')!;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 256, 160);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 12;
      ctx.strokeRect(6, 6, 244, 148);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 88px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 80);

      const tex = new THREE.CanvasTexture(c);
      const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), mat);
      return mesh;
    };

    const postMat = new THREE.MeshStandardMaterial({ color: 0x343a40, metalness: 0.8, roughness: 0.3 });
    const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8);

    // Braking zones before Turn 1 and Turn 5
    const zones = [
      { baseT: 0.055, distances: ['150', '100', '50'] },
      { baseT: 0.41, distances: ['150', '100', '50'] }
    ];

    zones.forEach(({ baseT, distances }) => {
      distances.forEach((distStr, idx) => {
        const markerT = (baseT + idx * 0.005) % 1.0;
        const pt = this.splineCurve.getPoint(markerT);
        const tang = this.splineCurve.getTangent(markerT);
        const binorm = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0, 1, 0)).normalize();

        const pos = pt.clone().add(binorm.multiplyScalar(7.2));
        pos.y += 0.7;

        const markerObj = new THREE.Group();
        markerObj.position.copy(pos);

        const lookTarget = pt.clone().add(tang.clone().multiplyScalar(-15));
        markerObj.lookAt(lookTarget);

        const board = createBrakeBoard(distStr);
        board.position.y = 0.5;

        const post = new THREE.Mesh(postGeo, postMat);
        post.position.y = -0.1;
        post.castShadow = true;

        markerObj.add(board, post);
        markerGroup.add(markerObj);
      });
    });

    this.trackGroup.add(markerGroup);
  }

  // 6d. Highway Tubular Steel Floodlight / Streetlamp Poles
  private buildHighwayStreetlights() {
    const lampGroup = new THREE.Group();
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xadb5bd, metalness: 0.88, roughness: 0.28 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x212529, metalness: 0.9, roughness: 0.2 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });

    const poleGeo = new THREE.CylinderGeometry(0.12, 0.18, 9.5, 10);
    const armGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.0, 8);
    armGeo.rotateZ(Math.PI / 3);

    const headGeo = new THREE.BoxGeometry(0.8, 0.22, 1.4);
    const bulbGeo = new THREE.PlaneGeometry(0.65, 1.2);
    bulbGeo.rotateX(Math.PI / 2);

    const numLamps = 34; // ~110m intervals around the closed 3.8 KM circuit
    for (let i = 0; i < numLamps; i++) {
      const t = i / numLamps;
      const pt = this.splineCurve.getPoint(t);
      const tang = this.splineCurve.getTangent(t);
      const binorm = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0, 1, 0)).normalize();

      const side = (i % 2 === 0 ? 1 : -1);
      const pos = pt.clone().add(binorm.multiplyScalar(side * 7.6));
      pos.y = this.getElevationAt(pos.x, pos.z);

      const lamp = new THREE.Group();
      lamp.position.copy(pos);
      lamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tang);

      // Main vertical pole
      const pole = new THREE.Mesh(poleGeo, lampMat);
      pole.position.set(0, 4.75, 0);
      pole.castShadow = true;

      // Curved overhang arm reaching into the road
      const arm = new THREE.Mesh(armGeo, lampMat);
      arm.position.set(-side * 1.5, 9.8, 0);
      arm.rotation.z = side * (Math.PI / 3);

      // Overhead luminaire housing
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(-side * 2.8, 10.6, 0);

      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(-side * 2.8, 10.45, 0);

      lamp.add(pole, arm, head, bulb);
      lampGroup.add(lamp);
    }

    this.trackGroup.add(lampGroup);
  }

  // 7. Authentic Photorealistic 3D Trees & Foliage along Highway
  private createOakTemplate(): THREE.Group {
    const group = new THREE.Group();

    // Natural Gnarled Wood Bark
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x3d2817,
      roughness: 0.95,
      metalness: 0.05
    });

    // Realistic tapered oak trunk with root flare
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.58, 8.5, 14), trunkMat);
    trunk.position.y = 4.25;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // Primary spreading scaffold branches
    const branchGeo = new THREE.CylinderGeometry(0.14, 0.28, 4.2, 8);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + 0.4;
      const branch = new THREE.Mesh(branchGeo, trunkMat);
      branch.position.set(Math.cos(angle) * 1.1, 6.2, Math.sin(angle) * 1.1);
      branch.rotation.set(Math.sin(angle) * 0.65, 0, -Math.cos(angle) * 0.65);
      branch.castShadow = true;
      group.add(branch);
    }

    // Lush organic multi-layered leaf foliage clouds with perturbed noise vertices
    const leafMatUnder = new THREE.MeshStandardMaterial({
      color: 0x1f4219, // Deep forest under-shadow
      roughness: 0.88,
      metalness: 0.03
    });

    const leafMatMid = new THREE.MeshStandardMaterial({
      color: 0x2f6024, // Rich emerald mid-tone
      roughness: 0.82,
      metalness: 0.04
    });

    const leafMatHighlight = new THREE.MeshStandardMaterial({
      color: 0x487e32, // Sunlit golden-green canopy crown
      roughness: 0.78,
      metalness: 0.04
    });

    // Perturb geometric vertices for natural fluffy leaf clusters
    const createPerturbedFoliageGeo = (radius: number, noiseAmp: number) => {
      const geo = new THREE.DodecahedronGeometry(radius, 2);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const n = Math.sin(vx * 3.5) * Math.cos(vy * 3.5) * Math.sin(vz * 3.5);
        const factor = 1.0 + n * noiseAmp;
        pos.setXYZ(i, vx * factor, vy * factor, vz * factor);
      }
      geo.computeVertexNormals();
      return geo;
    };

    const lobes: [number, number, number, number, THREE.MeshStandardMaterial][] = [
      [0, 8.8, 0, 3.8, leafMatMid],
      [2.0, 7.8, 1.4, 2.7, leafMatMid],
      [-1.9, 8.0, -1.2, 2.8, leafMatUnder],
      [-1.4, 7.5, 1.8, 2.6, leafMatHighlight],
      [1.6, 7.2, -1.8, 2.5, leafMatUnder],
      [0, 11.2, 0, 2.6, leafMatHighlight],
      [1.1, 9.8, 0.9, 2.2, leafMatHighlight],
      [-1.0, 9.5, -0.8, 2.3, leafMatMid]
    ];

    lobes.forEach(([x, y, z, r, mat]) => {
      const lobe = new THREE.Mesh(createPerturbedFoliageGeo(r, 0.18), mat);
      lobe.position.set(x, y, z);
      lobe.castShadow = true;
      lobe.receiveShadow = true;
      group.add(lobe);
    });

    return group;
  }

  // Authentic Tiered Alpine Pine / Douglas Fir
  private createPineTemplate(): THREE.Group {
    const group = new THREE.Group();

    // Dark Bark Conifer Trunk
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x241710,
      roughness: 0.96,
      metalness: 0.04
    });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.44, 13.0, 10), trunkMat);
    trunk.position.y = 6.5;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    const needleMatDark = new THREE.MeshStandardMaterial({
      color: 0x142e18, // Deep evergreen shadow
      roughness: 0.88,
      metalness: 0.03
    });

    const needleMatMid = new THREE.MeshStandardMaterial({
      color: 0x1d4423, // Classic alpine pine needle
      roughness: 0.84,
      metalness: 0.04
    });

    const needleMatFresh = new THREE.MeshStandardMaterial({
      color: 0x28592f, // Fresh spruce shoots
      roughness: 0.8,
      metalness: 0.04
    });

    // Create realistic jagged drooping pine needle tier with star-pointed geometry
    const createPineTierGeo = (radius: number, height: number) => {
      const geo = new THREE.ConeGeometry(radius, height, 12, 1);
      const pos = geo.attributes.position;
      // Displace alternating radial vertices to create realistic drooping branch tips
      for (let i = 0; i < pos.count; i++) {
        const vy = pos.getY(i);
        if (vy < 0) { // Base vertices
          const vx = pos.getX(i);
          const vz = pos.getZ(i);
          const angle = Math.atan2(vz, vx);
          const star = Math.sin(angle * 6) * 0.28;
          const droop = Math.cos(angle * 4) * 0.15;
          pos.setX(i, vx * (1.0 + star));
          pos.setZ(i, vz * (1.0 + star));
          pos.setY(i, vy - 0.25 - droop);
        }
      }
      geo.computeVertexNormals();
      return geo;
    };

    const tiers = [
      { y: 5.2, r: 3.5, h: 2.8, mat: needleMatDark },
      { y: 7.0, r: 3.0, h: 2.6, mat: needleMatDark },
      { y: 8.7, r: 2.5, h: 2.4, mat: needleMatMid },
      { y: 10.3, r: 2.0, h: 2.2, mat: needleMatMid },
      { y: 11.8, r: 1.5, h: 2.0, mat: needleMatFresh },
      { y: 13.2, r: 1.0, h: 1.8, mat: needleMatFresh },
      { y: 14.4, r: 0.5, h: 1.4, mat: needleMatFresh }
    ];

    tiers.forEach((t) => {
      const cone = new THREE.Mesh(createPineTierGeo(t.r, t.h), t.mat);
      cone.position.y = t.y;
      cone.castShadow = true;
      cone.receiveShadow = true;
      group.add(cone);
    });

    return group;
  }

  // Dense Roadside Wildflower Shrub
  private createBushTemplate(): THREE.Group {
    const group = new THREE.Group();

    const bushMat = new THREE.MeshStandardMaterial({
      color: 0x336224,
      roughness: 0.85,
      metalness: 0.04
    });

    const flowerMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });

    const numClumps = 6;
    for (let i = 0; i < numClumps; i++) {
      const r = 0.65 + Math.random() * 0.45;
      const clump = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), bushMat);
      const angle = (i / numClumps) * Math.PI * 2;
      clump.position.set(
        Math.cos(angle) * 0.7,
        0.5 + Math.random() * 0.4,
        Math.sin(angle) * 0.7
      );
      clump.castShadow = true;
      group.add(clump);

      // Flower specks
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4), flowerMat);
      fl.position.set(clump.position.x * 1.1, clump.position.y + 0.35, clump.position.z * 1.1);
      group.add(fl);
    }

    return group;
  }

  private buildTrees() {
    const oakTemplate = this.createOakTemplate();
    const pineTemplate = this.createPineTemplate();
    const bushTemplate = this.createBushTemplate();
    const treeGroup = new THREE.Group();

    // 1. Densely line the entire 3.8 KM circuit with alternating Oaks, Pines & Roadside Bushes
    const count = 300;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pt = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const side = (i % 2 === 0 ? 1 : -1) * (i % 3 === 0 ? -1 : 1);
      const distance = 10.2 + (i % 5) * 3.4 + Math.random() * 4.0;
      const treePos = pt.clone().add(binormal.multiplyScalar(side * distance));

      // Absolute safety constraint: never place any tree within 9.5m of ANY road surface!
      const { dist } = this.getClosestSplinePoint(treePos.x, treePos.z);
      if (dist < 9.5) continue;

      const groundY = this.getElevationAt(treePos.x, treePos.z);

      const template = i % 2 === 0 ? oakTemplate : pineTemplate;
      const tree = template.clone(true);
      const scale = 0.95 + (i % 4) * 0.12 + Math.random() * 0.18;
      tree.scale.set(scale, scale * (0.95 + Math.random() * 0.2), scale);
      tree.position.set(treePos.x, groundY, treePos.z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      treeGroup.add(tree);

      // Sprinkle roadside wild shrubs along the embankment
      if (i % 2 === 0) {
        const bushPos = pt.clone().add(binormal.multiplyScalar(side * (8.8 + Math.random() * 1.2)));
        const bushY = this.getElevationAt(bushPos.x, bushPos.z);
        const bush = bushTemplate.clone(true);
        bush.position.set(bushPos.x, bushY, bushPos.z);
        bush.rotation.y = Math.random() * Math.PI * 2;
        treeGroup.add(bush);
      }
    }

    // 2. Majestic Tree Avenue along the Starting Straightaway (Z = 25 to 320)
    for (let z = 25; z <= 320; z += 30) {
      for (const side of [-1, 1]) {
        for (const distOffset of [11.5, 17.0]) {
          const treePos = new THREE.Vector3(side * distOffset, 0, z);

          // Absolute safety constraint: never place any tree within 9.5m of ANY road surface!
          const { dist } = this.getClosestSplinePoint(treePos.x, treePos.z);
          if (dist < 9.5) continue;

          const groundY = this.getElevationAt(treePos.x, treePos.z);

          const template = (z + (side > 0 ? 10 : 0)) % 60 === 0 ? pineTemplate : oakTemplate;
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
