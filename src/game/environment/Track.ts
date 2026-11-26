import * as THREE from 'three';

export interface RampCollider {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  binormal: THREE.Vector3;
  width: number;
  length: number;
  height: number;
}

interface SplineChunkBounds {
  start: number;
  end: number;
  midIdx: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class HighwayTrack {
  public scene: THREE.Scene;
  public trackGroup: THREE.Group = new THREE.Group();
  public splineCurve: THREE.CatmullRomCurve3;
  public sampledPoints: THREE.Vector3[] = [];
  public sampledTangents: THREE.Vector3[] = [];
  public ramps: RampCollider[] = [];
  public dirLight!: THREE.DirectionalLight;

  private splineChunks: SplineChunkBounds[] = [];
  private windTurbineBlades: THREE.Group[] = [];
  private lighthouseBeacons: THREE.Group[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. EXPANSIVE 12.5 KM GRAND COASTAL & ALPINE WORLD CIRCUIT (33 Control Points)
    const points = [
      // SECTOR 1: GRAND PRIX START SPEEDWAY
      new THREE.Vector3(0, 0.0, 0),
      new THREE.Vector3(0, 0.0, 350),
      new THREE.Vector3(0, 0.0, 750),
      new THREE.Vector3(25, 0.4, 1150),

      // SECTOR 2: RIVIERA COASTAL OCEAN HIGHWAY
      new THREE.Vector3(180, 1.2, 1600),
      new THREE.Vector3(450, 1.8, 2050),
      new THREE.Vector3(780, 2.0, 2450),
      new THREE.Vector3(1050, 2.5, 2900),
      new THREE.Vector3(1180, 3.8, 3350),

      // SECTOR 3: ALPINE FOOTHILLS & MOUNTAIN PASS ASCENT
      new THREE.Vector3(1100, 7.5, 3850),
      new THREE.Vector3(880, 14.0, 4300),
      new THREE.Vector3(720, 21.0, 4700),
      new THREE.Vector3(480, 28.5, 5050),
      new THREE.Vector3(180, 34.0, 5300),

      // SECTOR 4: HIGH VIADUCT SKY BRIDGE
      new THREE.Vector3(-180, 36.5, 5400),
      new THREE.Vector3(-550, 36.0, 5350),
      new THREE.Vector3(-920, 33.5, 5150),

      // SECTOR 5: NEON CYBER MOUNTAIN TUNNEL
      new THREE.Vector3(-1250, 27.0, 4800),
      new THREE.Vector3(-1520, 21.0, 4350),
      new THREE.Vector3(-1700, 16.0, 3850),
      new THREE.Vector3(-1800, 12.0, 3350),

      // SECTOR 6: RED ROCK CANYON & DRIFT GULCH
      new THREE.Vector3(-1850, 8.5, 2850),
      new THREE.Vector3(-1880, 5.5, 2300),
      new THREE.Vector3(-1820, 3.5, 1750),
      new THREE.Vector3(-1650, 2.2, 1250),

      // SECTOR 7: TALL REDWOOD RIVER VALLEY
      new THREE.Vector3(-1380, 1.4, 800),
      new THREE.Vector3(-1050, 0.8, 450),
      new THREE.Vector3(-720, 0.5, 200),

      // SECTOR 8: COASTAL BOULEVARD & FINAL CHICANE TO GRID
      new THREE.Vector3(-420, 0.2, 50),
      new THREE.Vector3(-200, 0.0, -120),
      new THREE.Vector3(-60, 0.0, -220),
      new THREE.Vector3(0, 0.0, -120),
      new THREE.Vector3(0, 0.0, -30)
    ];

    this.splineCurve = new THREE.CatmullRomCurve3(points, true);
    this.splineCurve.curveType = 'catmullrom';
    this.splineCurve.tension = 0.5;

    // Pre-cache 2,400 track points AND tangents + AABB spatial chunks (~100x faster lookup!)
    const totalSamples = 2400;
    this.sampledPoints = this.splineCurve.getPoints(totalSamples);
    this.sampledTangents = [];
    for (let i = 0; i < this.sampledPoints.length; i++) {
      this.sampledTangents.push(this.splineCurve.getTangent(i / totalSamples));
    }

    const chunkSize = 32;
    this.splineChunks = [];
    for (let start = 0; start < this.sampledPoints.length; start += chunkSize) {
      const end = Math.min(this.sampledPoints.length - 1, start + chunkSize - 1);
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (let j = start; j <= end; j++) {
        const pt = this.sampledPoints[j];
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.z < minZ) minZ = pt.z;
        if (pt.z > maxZ) maxZ = pt.z;
      }
      this.splineChunks.push({
        start,
        end,
        midIdx: (start + end) >> 1,
        minX,
        maxX,
        minZ,
        maxZ
      });
    }

    this.setupLighting();
    this.buildTerrain();
    this.buildOceanAndBeach();
    this.buildDistantMountains();
    this.buildRoad();
    this.buildHighwayTunnel();
    this.buildViaductBridge();
    this.buildGrandstandComplex();
    this.buildArmcoGuardrails();
    this.buildTrackArchitecture();
    this.buildChevronSigns();
    this.buildBrakeMarkers();
    this.buildHighwayStreetlights();
    this.buildLighthouse();
    this.buildWindTurbines();
    this.buildTrees();
    this.buildRoadsideBoulders();
    this.buildJumpRamps();

    this.scene.add(this.trackGroup);
  }

  // Exact hierarchical chunk-AABB closest spline lookup with sub-meter segment interpolation
  public getClosestSplinePoint(x: number, z: number): {
    point: THREE.Vector3;
    tangent: THREE.Vector3;
    dist: number;
    t: number;
  } {
    const n = this.sampledPoints.length;
    let minDistSq = Infinity;
    let closestIndex = 0;

    // Seed upper bound from chunk midpoints first so irrelevant distant chunks prune immediately
    for (let cIdx = 0; cIdx < this.splineChunks.length; cIdx++) {
      const mid = this.sampledPoints[this.splineChunks[cIdx].midIdx];
      const dx = x - mid.x;
      const dz = z - mid.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        closestIndex = this.splineChunks[cIdx].midIdx;
      }
    }

    for (let cIdx = 0; cIdx < this.splineChunks.length; cIdx++) {
      const c = this.splineChunks[cIdx];
      const bdx = x < c.minX ? c.minX - x : x > c.maxX ? x - c.maxX : 0;
      const bdz = z < c.minZ ? c.minZ - z : z > c.maxZ ? z - c.maxZ : 0;
      if (bdx * bdx + bdz * bdz > minDistSq) continue;

      for (let i = c.start; i <= c.end; i++) {
        const p = this.sampledPoints[i];
        const dx = x - p.x;
        const dz = z - p.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < minDistSq) {
          minDistSq = dSq;
          closestIndex = i;
        }
      }
    }

    // Refine between closest segment neighbors for sub-meter smoothness along guardrails & road
    const prevIdx = (closestIndex - 1 + n) % n;
    const nextIdx = (closestIndex + 1) % n;
    const pCurr = this.sampledPoints[closestIndex];
    const pPrev = this.sampledPoints[prevIdx];
    const pNext = this.sampledPoints[nextIdx];

    const prevDistSq = (x - pPrev.x) ** 2 + (z - pPrev.z) ** 2;
    const nextDistSq = (x - pNext.x) ** 2 + (z - pNext.z) ** 2;

    const pA = prevDistSq < nextDistSq ? pPrev : pCurr;
    const pB = prevDistSq < nextDistSq ? pCurr : pNext;
    const baseIdx = prevDistSq < nextDistSq ? prevIdx : closestIndex;

    const segDx = pB.x - pA.x;
    const segDz = pB.z - pA.z;
    const segLenSq = segDx * segDx + segDz * segDz;

    let proj = 0;
    if (segLenSq > 0.0001) {
      proj = THREE.MathUtils.clamp(((x - pA.x) * segDx + (z - pA.z) * segDz) / segLenSq, 0, 1);
    }

    const interpPoint = new THREE.Vector3(
      pA.x + segDx * proj,
      pA.y + (pB.y - pA.y) * proj,
      pA.z + segDz * proj
    );

    const exactDist = Math.hypot(x - interpPoint.x, z - interpPoint.z);
    const tangent = this.sampledTangents[closestIndex];
    const t = ((baseIdx + proj) % n) / n;

    return {
      point: interpPoint,
      tangent,
      dist: exactDist,
      t
    };
  }

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.58);
    this.trackGroup.add(ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfff8e8, 1.9);
    this.dirLight.position.set(120, 180, 100);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 500;
    const d = 120;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0003;
    this.trackGroup.add(this.dirLight);
    this.trackGroup.add(this.dirLight.target);

    const hemiLight = new THREE.HemisphereLight(0x8ecae6, 0x3b5c28, 0.62);
    this.trackGroup.add(hemiLight);
  }

  // Tileable seamless FBM grass/meadow texture (Zero checkerboard waffle grid!)
  private buildTerrain() {
    const terrainGeo = new THREE.PlaneGeometry(5400, 7600, 200, 240);
    terrainGeo.rotateX(-Math.PI / 2);
    terrainGeo.translate(-400, 0, 2600);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);

      const closest = this.getClosestSplinePoint(vx, vz);
      const { dist, point } = closest;
      const elev = this.getNaturalTerrainElevation(vx, vz, closest);

      let y = elev;
      if (dist < 11.5) {
        y = point.y - 0.45;
      } else if (dist < 22.0) {
        const blend = (dist - 11.5) / 10.5;
        const targetDepress = point.y - 0.45;
        y = targetDepress * (1 - blend) + elev * blend;
      }
      pos.setY(i, y);
    }
    terrainGeo.computeVertexNormals();

    // Multi-frequency periodic non-grid organic meadow texture (512x512 seamlessly tileable)
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    const twoPi = Math.PI * 2;
    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const idx = (y * size + x) * 4;

        // Multi-angle irrational-rotated periodic waves (eliminates horizontal/vertical waffle lines)
        const f1 = Math.sin(twoPi * (u * 2 + v * 1) + 0.4) * Math.cos(twoPi * (u * 1 - v * 3) + 1.2);
        const f2 = Math.sin(twoPi * (u * 5 + v * 3) + 2.1) * 0.55;
        const f3 = Math.cos(twoPi * (u * 9 - v * 7) + 0.7) * 0.35;
        const f4 = Math.sin(twoPi * (u * 17 + v * 13)) * 0.2;
        // Fast deterministic grain hash per texel
        const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const micro = (hash - Math.floor(hash) - 0.5) * 0.32;

        const n = THREE.MathUtils.clamp((f1 + f2 + f3 + f4 + micro + 2.1) / 4.2, 0, 1);

        // Rich natural Alpine grass palette (olive moss to lush sunlit meadow)
        data[idx] = Math.floor(38 + n * 44);
        data[idx + 1] = Math.floor(68 + n * 58);
        data[idx + 2] = Math.floor(26 + n * 24);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const terrainTexture = new THREE.CanvasTexture(canvas);
    terrainTexture.wrapS = THREE.RepeatWrapping;
    terrainTexture.wrapT = THREE.RepeatWrapping;
    terrainTexture.repeat.set(70, 95);
    terrainTexture.anisotropy = 8;

    const terrainMat = new THREE.MeshStandardMaterial({
      map: terrainTexture,
      roughness: 0.94,
      metalness: 0.02
    });

    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    this.trackGroup.add(terrain);
  }

  private getNaturalTerrainElevation(
    x: number,
    z: number,
    precomputed?: { point: THREE.Vector3; dist: number }
  ): number {
    const { point, dist } = precomputed || this.getClosestSplinePoint(x, z);

    if (x > 850 && z > 1200 && z < 3600) {
      return -0.5;
    }

    if (dist < 11.5) {
      return point.y - 0.45;
    } else if (dist < 24.0) {
      const blend = (dist - 11.5) / 12.5;
      return (point.y - 0.45) * (1 - blend) + (point.y - 0.05) * blend;
    } else {
      const flankDist = dist - 24.0;
      const rolling = Math.sin(x * 0.007) * Math.cos(z * 0.005) * 5.0;
      return point.y - 0.05 + Math.min(22.0, flankDist * 0.038) + rolling * Math.min(1.0, flankDist / 30.0);
    }
  }

  private buildOceanAndBeach() {
    const oceanGroup = new THREE.Group();

    const waterGeo = new THREE.PlaneGeometry(3600, 4200, 16, 16);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0077be,
      roughness: 0.09,
      metalness: 0.8,
      transparent: true,
      opacity: 0.92
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(2400, -0.7, 2400);
    water.receiveShadow = true;
    oceanGroup.add(water);

    const beachGeo = new THREE.PlaneGeometry(320, 2400);
    beachGeo.rotateX(-Math.PI / 2);
    const beachMat = new THREE.MeshStandardMaterial({
      color: 0xe9d8a6,
      roughness: 0.95,
      metalness: 0.02
    });
    const beach = new THREE.Mesh(beachGeo, beachMat);
    beach.position.set(1280, -0.4, 2500);
    beach.rotation.y = -0.22;
    oceanGroup.add(beach);

    const yachtHullMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.2, metalness: 0.4 });
    const yachtSailMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide });

    for (let i = 0; i < 14; i++) {
      const yacht = new THREE.Group();
      const yx = 1600 + (i % 4) * 240 + (i * 19 % 70);
      const yz = 1800 + Math.floor(i / 4) * 350 + (i * 23 % 80);

      const hull = new THREE.Mesh(new THREE.BoxGeometry(6.5, 2.2, 18.0), yachtHullMat);
      hull.position.y = 0.4;
      yacht.add(hull);

      const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.8, 9.0), yachtHullMat);
      cabin.position.set(0, 2.1, -1.0);
      yacht.add(cabin);

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 16.0, 8), yachtHullMat);
      mast.position.set(0, 8.5, 1.0);
      yacht.add(mast);

      const sailGeo = new THREE.BufferGeometry();
      const sailVerts = new Float32Array([0, 1.5, 1.0, 0, 15.5, 1.0, 0, 2.0, 8.5]);
      sailGeo.setAttribute('position', new THREE.BufferAttribute(sailVerts, 3));
      sailGeo.computeVertexNormals();
      yacht.add(new THREE.Mesh(sailGeo, yachtSailMat));

      yacht.position.set(yx, -0.6, yz);
      yacht.rotation.y = i * 0.45;
      oceanGroup.add(yacht);
    }

    this.trackGroup.add(oceanGroup);
  }

  private buildDistantMountains() {
    const mountainGroup = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x454a54, roughness: 0.92, metalness: 0.06 });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.72, metalness: 0.05 });

    const numPeaks = 48;
    const centerX = -400;
    const centerZ = 2600;

    for (let i = 0; i < numPeaks; i++) {
      const angle = (i / numPeaks) * Math.PI * 2;
      const baseRadius = 280 + (i % 4) * 40;
      const peakHeight = 220 + (i % 6) * 35;

      const radius = 3300 + (i % 5) * 160 + (i % 3) * 100;
      const mx = centerX + Math.cos(angle) * radius;
      const mz = centerZ + Math.sin(angle) * radius;

      const { dist } = this.getClosestSplinePoint(mx, mz);
      if (dist < baseRadius + 180) continue;

      const mountainGeo = new THREE.ConeGeometry(baseRadius, peakHeight, 10, 3);
      const pos = mountainGeo.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const vx = pos.getX(v);
        const vy = pos.getY(v);
        const vz = pos.getZ(v);
        const noise = 1.0 + Math.sin(vx * 0.03) * Math.cos(vz * 0.03) * 0.24;
        pos.setXYZ(v, vx * noise, vy, vz * noise);
      }
      mountainGeo.computeVertexNormals();

      const mountain = new THREE.Mesh(mountainGeo, rockMat);
      mountain.position.set(mx, peakHeight * 0.44 - 10, mz);
      mountain.rotation.y = angle + 0.35;
      mountainGroup.add(mountain);

      const snowGeo = new THREE.ConeGeometry(baseRadius * 0.38, peakHeight * 0.38, 10, 2);
      const snowMesh = new THREE.Mesh(snowGeo, snowMat);
      snowMesh.position.set(mx, peakHeight * 0.74 - 10, mz);
      snowMesh.rotation.y = mountain.rotation.y;
      mountainGroup.add(snowMesh);
    }

    this.trackGroup.add(mountainGroup);
  }

  private buildRoad() {
    const numSteps = 2200;
    const roadWidth = 18.5;

    const roadGeo = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#191b20';
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let i = 0; i < 8000; i++) {
      ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
    }

    for (let y = 0; y < 1024; y += 64) {
      ctx.fillStyle = (y / 64) % 2 === 0 ? '#d90429' : '#f8f9fa';
      ctx.fillRect(0, y, 32, 64);
      ctx.fillRect(992, y, 32, 64);
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(38, 0, 10, 1024);
    ctx.fillRect(976, 0, 10, 1024);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    for (let y = 0; y < 1024; y += 100) {
      ctx.fillRect(276, y, 8, 60);
      ctx.fillRect(740, y, 8, 60);
    }

    ctx.fillStyle = '#ffb703';
    ctx.fillRect(504, 0, 6, 1024);
    ctx.fillRect(514, 0, 6, 1024);

    ctx.fillStyle = 'rgba(10, 10, 14, 0.3)';
    ctx.beginPath();
    ctx.ellipse(360, 512, 16, 420, 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(664, 512, 16, 420, -0.05, 0, Math.PI * 2);
    ctx.fill();

    const roadTexture = new THREE.CanvasTexture(canvas);
    roadTexture.wrapS = THREE.RepeatWrapping;
    roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.anisotropy = 8;

    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.6,
      metalness: 0.12,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });

    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= numSteps; i++) {
      const t = i / numSteps;
      const point = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const left = point.clone().addScaledVector(binormal, roadWidth / 2);
      const right = point.clone().addScaledVector(binormal, -roadWidth / 2);

      vertices.push(left.x, left.y + 0.22, left.z);
      vertices.push(right.x, right.y + 0.22, right.z);

      uvs.push(0, t * 400);
      uvs.push(1, t * 400);

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

    // Start/Finish Checkered Line at z = 6m
    const checkCanvas = document.createElement('canvas');
    checkCanvas.width = 512;
    checkCanvas.height = 64;
    const cctx = checkCanvas.getContext('2d')!;
    const sq = 32;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 16; col++) {
        cctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#111111';
        cctx.fillRect(col * sq, row * sq, sq, sq);
      }
    }
    const checkTex = new THREE.CanvasTexture(checkCanvas);
    const startLine = new THREE.Mesh(
      new THREE.PlaneGeometry(17.5, 2.2),
      new THREE.MeshBasicMaterial({ map: checkTex, polygonOffset: true, polygonOffsetFactor: -4 })
    );
    startLine.rotation.x = -Math.PI / 2;
    startLine.position.set(0, 0.24, 4.0);
    this.trackGroup.add(startLine);

    // Reflective Amber Cat's-Eye Road Studs — SINGLE InstancedMesh (saves ~624 draw calls!)
    const studCount = Math.floor(1.0 / 0.0016) + 1;
    const studGeo = new THREE.BoxGeometry(0.14, 0.05, 0.24);
    const studMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    const studInstanced = new THREE.InstancedMesh(studGeo, studMat, studCount);
    const dummy = new THREE.Object3D();

    let idx = 0;
    for (let t = 0; t <= 1.0 && idx < studCount; t += 0.0016) {
      const pt = this.splineCurve.getPoint(t);
      const tang = this.splineCurve.getTangent(t);
      dummy.position.set(pt.x, pt.y + 0.24, pt.z);
      dummy.rotation.set(0, Math.atan2(tang.x, tang.z), 0);
      dummy.updateMatrix();
      studInstanced.setMatrixAt(idx++, dummy.matrix);
    }
    studInstanced.count = idx;
    studInstanced.instanceMatrix.needsUpdate = true;
    this.trackGroup.add(studInstanced);
  }

  private buildHighwayTunnel() {
    const tunnelGroup = new THREE.Group();
    const startT = 0.52;
    const endT = 0.61;
    const steps = 90;

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1f2227,
      roughness: 0.88,
      metalness: 0.15,
      side: THREE.BackSide
    });

    const cyanLightMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    const amberLightMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });

    const tunnelPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = startT + (i / steps) * (endT - startT);
      const pt = this.splineCurve.getPoint(t);
      tunnelPoints.push(new THREE.Vector3(pt.x, pt.y + 4.2, pt.z));
    }

    const tunnelPath = new THREE.CatmullRomCurve3(tunnelPoints);
    const tunnelGeo = new THREE.TubeGeometry(tunnelPath, steps, 12.0, 14, false);
    tunnelGroup.add(new THREE.Mesh(tunnelGeo, wallMat));

    const lampGeo = new THREE.BoxGeometry(0.35, 0.15, 3.8);
    const lampCount = Math.floor((steps - 2) / 3);
    const cyanInst = new THREE.InstancedMesh(lampGeo, cyanLightMat, lampCount);
    const amberInst = new THREE.InstancedMesh(lampGeo, amberLightMat, lampCount);
    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);

    let lIdx = 0;
    for (let i = 2; i < steps && lIdx < lampCount; i += 3) {
      const t = startT + (i / steps) * (endT - startT);
      const pt = this.splineCurve.getPoint(t);
      const tang = this.splineCurve.getTangent(t);
      const binorm = new THREE.Vector3().crossVectors(tang, up).normalize();
      const yaw = Math.atan2(tang.x, tang.z);

      dummy.position.copy(pt).addScaledVector(binorm, 4.5);
      dummy.position.y += 7.8;
      dummy.rotation.set(0, yaw, 0);
      dummy.updateMatrix();
      cyanInst.setMatrixAt(lIdx, dummy.matrix);

      dummy.position.copy(pt).addScaledVector(binorm, -4.5);
      dummy.position.y += 7.8;
      dummy.updateMatrix();
      amberInst.setMatrixAt(lIdx, dummy.matrix);
      lIdx++;
    }
    cyanInst.count = lIdx;
    amberInst.count = lIdx;
    tunnelGroup.add(cyanInst, amberInst);

    const portalMat = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.5 });
    for (const portalT of [startT, endT]) {
      const pt = this.splineCurve.getPoint(portalT);
      const tang = this.splineCurve.getTangent(portalT);
      const portal = new THREE.Group();
      portal.position.set(pt.x, pt.y + 4.2, pt.z);
      portal.rotation.y = Math.atan2(tang.x, tang.z);

      const arch = new THREE.Mesh(new THREE.TorusGeometry(12.2, 1.6, 8, 16, Math.PI), portalMat);
      portal.add(arch);
      tunnelGroup.add(portal);
    }

    this.trackGroup.add(tunnelGroup);
  }

  // Oriented Viaduct Sky Bridge Piers & Girders along exact highway tangent/binormal!
  private buildViaductBridge() {
    const bridgeGroup = new THREE.Group();
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x5a6268, roughness: 0.85, metalness: 0.2 });
    const cableMat = new THREE.MeshStandardMaterial({ color: 0xdce1e9, roughness: 0.3, metalness: 0.9 });
    const girderGeo = new THREE.BoxGeometry(22.0, 2.0, 3.8);
    const towerGeo = new THREE.CylinderGeometry(0.45, 0.65, 26.0, 10);

    const startT = 0.42;
    const endT = 0.49;
    const numPillars = 11;
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < numPillars; i++) {
      const t = startT + (i / (numPillars - 1)) * (endT - startT);
      const pt = this.splineCurve.getPoint(t);
      const tang = this.splineCurve.getTangent(t);
      const binorm = new THREE.Vector3().crossVectors(tang, up).normalize();
      const yaw = Math.atan2(tang.x, tang.z);

      const pillarHeight = Math.max(12.0, pt.y + 6.0);
      const pillarGeo = new THREE.BoxGeometry(3.2, pillarHeight, 3.2);

      const leftPos = pt.clone().addScaledVector(binorm, -9.2);
      const rightPos = pt.clone().addScaledVector(binorm, 9.2);

      const pL = new THREE.Mesh(pillarGeo, pillarMat);
      pL.position.set(leftPos.x, pt.y - pillarHeight / 2, leftPos.z);
      pL.rotation.y = yaw;
      pL.castShadow = true;

      const pR = new THREE.Mesh(pillarGeo, pillarMat);
      pR.position.set(rightPos.x, pt.y - pillarHeight / 2, rightPos.z);
      pR.rotation.y = yaw;
      pR.castShadow = true;

      const girder = new THREE.Mesh(girderGeo, pillarMat);
      girder.position.set(pt.x, pt.y - 1.0, pt.z);
      girder.rotation.y = yaw;
      girder.castShadow = true;

      bridgeGroup.add(pL, pR, girder);

      if (i === 3 || i === 7) {
        const towerLPos = pt.clone().addScaledVector(binorm, -9.8);
        const towerRPos = pt.clone().addScaledVector(binorm, 9.8);

        const tL = new THREE.Mesh(towerGeo, cableMat);
        tL.position.set(towerLPos.x, pt.y + 13.0, towerLPos.z);
        const tR = new THREE.Mesh(towerGeo, cableMat);
        tR.position.set(towerRPos.x, pt.y + 13.0, towerRPos.z);
        bridgeGroup.add(tL, tR);
      }
    }

    this.trackGroup.add(bridgeGroup);
  }

  private buildGrandstandComplex() {
    const standGroup = new THREE.Group();

    const standMat = new THREE.MeshStandardMaterial({ color: 0x2b303a, roughness: 0.7 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.5 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.4 });

    for (let s = 0; s < 4; s++) {
      const zPos = 110 + s * 85;
      const grandstand = new THREE.Group();

      for (let tier = 0; tier < 8; tier++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(10.0, 1.0, 75.0), standMat);
        step.position.set(tier * 1.3, tier * 1.0 + 0.5, 0);
        grandstand.add(step);

        const seats = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 73.0), seatMat);
        seats.position.set(tier * 1.3, tier * 1.0 + 1.2, 0);
        grandstand.add(seats);
      }

      const canopy = new THREE.Mesh(new THREE.BoxGeometry(16.0, 0.6, 78.0), canopyMat);
      canopy.position.set(4.5, 12.5, 0);
      canopy.rotation.z = -0.08;
      canopy.castShadow = true;
      grandstand.add(canopy);

      const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 12.0), standMat);
      pillarL.position.set(11.0, 6.0, 35.0);
      const pillarR = pillarL.clone();
      pillarR.position.z = -35.0;
      grandstand.add(pillarL, pillarR);

      grandstand.position.set(22.0, 0.0, zPos);
      standGroup.add(grandstand);
    }

    const pitWallMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.6 });
    const pitWall = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 380.0), pitWallMat);
    pitWall.position.set(-11.5, 0.7, 240.0);
    pitWall.castShadow = true;
    standGroup.add(pitWall);

    this.trackGroup.add(standGroup);
  }

  // Armco Guardrails + SINGLE InstancedMesh for ~1,066 wooden support posts!
  private buildArmcoGuardrails() {
    const numSteps = 1600;
    const roadWidth = 18.5;

    const railMat = new THREE.MeshStandardMaterial({
      color: 0xb0b8c2,
      metalness: 0.85,
      roughness: 0.28
    });

    const postMat = new THREE.MeshStandardMaterial({ color: 0x3d352e, roughness: 0.95 });
    const postGeo = new THREE.BoxGeometry(0.2, 1.0, 0.2);

    const postCountPerSide = Math.floor(numSteps / 3) + 1;
    const postsInstanced = new THREE.InstancedMesh(postGeo, postMat, postCountPerSide * 2);
    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    let postIdx = 0;

    for (const side of [-1, 1]) {
      const railPoints: THREE.Vector3[] = [];

      for (let i = 0; i <= numSteps; i++) {
        const t = i / numSteps;
        const pt = this.splineCurve.getPoint(t);
        const tangent = this.splineCurve.getTangent(t);
        const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const barrierPos = pt.clone().addScaledVector(binormal, side * (roadWidth / 2 + 1.2));
        barrierPos.y += 0.58;
        railPoints.push(barrierPos);

        if (i % 3 === 0 && postIdx < postCountPerSide * 2) {
          dummy.position.set(barrierPos.x, barrierPos.y - 0.25, barrierPos.z);
          dummy.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
          dummy.updateMatrix();
          postsInstanced.setMatrixAt(postIdx++, dummy.matrix);
        }
      }

      const railCurve = new THREE.CatmullRomCurve3(railPoints, true);
      const railGeo = new THREE.TubeGeometry(railCurve, numSteps, 0.16, 8, true);
      const railMesh = new THREE.Mesh(railGeo, railMat);
      railMesh.receiveShadow = true;
      this.trackGroup.add(railMesh);
    }

    postsInstanced.count = postIdx;
    postsInstanced.instanceMatrix.needsUpdate = true;
    this.trackGroup.add(postsInstanced);
  }

  private buildTrackArchitecture() {
    const startPt = new THREE.Vector3(0, 0.22, 60);
    const archGroup = new THREE.Group();
    archGroup.position.copy(startPt);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1f242d, metalness: 0.8, roughness: 0.3 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });

    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 7.6, 0.9), pillarMat);
    pillarL.position.set(-11.5, 3.8, 0);
    pillarL.castShadow = true;
    const pillarR = pillarL.clone();
    pillarR.position.x = 11.5;

    const crossbeam = new THREE.Mesh(new THREE.BoxGeometry(24.5, 2.0, 1.2), beamMat);
    crossbeam.position.set(0, 6.8, 0);
    crossbeam.castShadow = true;

    // Aspect-matched 1280x96 wide banner so typography renders razor-sharp!
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 1280;
    bannerCanvas.height = 96;
    const bctx = bannerCanvas.getContext('2d')!;
    bctx.fillStyle = '#070b14';
    bctx.fillRect(0, 0, 1280, 96);
    bctx.strokeStyle = '#00f2fe';
    bctx.lineWidth = 4;
    bctx.strokeRect(4, 4, 1272, 88);
    bctx.fillStyle = '#00f2fe';
    bctx.font = 'bold 46px sans-serif';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText('APEX WORLD CIRCUIT  •  12.5 KM GRAND HIGHWAY', 640, 50);

    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    bannerTex.anisotropy = 4;
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(21.0, 1.58),
      new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide })
    );
    banner.rotation.y = Math.PI;
    banner.position.set(0, 6.8, -0.62);

    archGroup.add(pillarL, pillarR, crossbeam, banner);
    this.trackGroup.add(archGroup);

    // Highway Gantries with readable highway text
    const signBoardTexts = ['RIVIERA COASTAL EXIT  ↗', 'ALPINE SKY BRIDGE  2 KM', 'REDWOOD VALLEY  •  SPEEDWAY'];
    const gantryTs = [0.20, 0.40, 0.70];
    gantryTs.forEach((gantryT, idx) => {
      const pt = this.splineCurve.getPoint(gantryT);
      const tang = this.splineCurve.getTangent(gantryT);

      const gantry = new THREE.Group();
      gantry.position.copy(pt);
      gantry.rotation.y = Math.atan2(tang.x, tang.z);

      const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 8.2, 12), pillarMat);
      pL.position.set(-11.5, 4.1, 0);
      const pR = pL.clone();
      pR.position.x = 11.5;

      const beam = new THREE.Mesh(new THREE.BoxGeometry(24.0, 0.45, 0.45), pillarMat);
      beam.position.set(0, 7.5, 0);

      const sCanvas = document.createElement('canvas');
      sCanvas.width = 512;
      sCanvas.height = 160;
      const sctx = sCanvas.getContext('2d')!;
      sctx.fillStyle = '#006a4e';
      sctx.fillRect(0, 0, 512, 160);
      sctx.strokeStyle = '#ffffff';
      sctx.lineWidth = 8;
      sctx.strokeRect(8, 8, 496, 144);
      sctx.fillStyle = '#ffffff';
      sctx.font = 'bold 30px sans-serif';
      sctx.textAlign = 'center';
      sctx.textBaseline = 'middle';
      sctx.fillText(signBoardTexts[idx], 256, 80);

      const sTex = new THREE.CanvasTexture(sCanvas);
      const signFaceMat = new THREE.MeshBasicMaterial({ map: sTex });
      const greenMat = new THREE.MeshStandardMaterial({ color: 0x005c43, roughness: 0.4 });
      const signBoard = new THREE.Mesh(new THREE.BoxGeometry(9.0, 2.8, 0.18), [
        greenMat, greenMat, greenMat, greenMat, greenMat, signFaceMat
      ]);
      signBoard.position.set(-3.5, 6.0, 0);

      gantry.add(pL, pR, beam, signBoard);
      this.trackGroup.add(gantry);
    });
  }

  private buildChevronSigns() {
    const chevronGroup = new THREE.Group();
    const curveLocations = [
      { t: 0.08, dir: 1, count: 6 },
      { t: 0.18, dir: 1, count: 6 },
      { t: 0.28, dir: -1, count: 7 },
      { t: 0.38, dir: -1, count: 7 },
      { t: 0.64, dir: 1, count: 7 },
      { t: 0.78, dir: -1, count: 6 },
      { t: 0.90, dir: 1, count: 6 }
    ];

    const createChevronTex = (dir: number) => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 10;
      ctx.strokeRect(8, 8, 240, 240);
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      if (dir === 1) {
        ctx.moveTo(70, 40); ctx.lineTo(170, 128); ctx.lineTo(70, 216);
        ctx.lineTo(105, 216); ctx.lineTo(205, 128); ctx.lineTo(105, 40);
      } else {
        ctx.moveTo(186, 40); ctx.lineTo(86, 128); ctx.lineTo(186, 216);
        ctx.lineTo(151, 216); ctx.lineTo(51, 128); ctx.lineTo(151, 40);
      }
      ctx.closePath();
      ctx.fill();
      return new THREE.CanvasTexture(c);
    };

    const rightTex = createChevronTex(1);
    const leftTex = createChevronTex(-1);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x495057, metalness: 0.85, roughness: 0.25 });
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8);
    const boardGeo = new THREE.PlaneGeometry(1.4, 1.4);
    const up = new THREE.Vector3(0, 1, 0);

    curveLocations.forEach(({ t, dir, count }) => {
      const mat = new THREE.MeshBasicMaterial({ map: dir === 1 ? rightTex : leftTex, side: THREE.DoubleSide });

      for (let j = 0; j < count; j++) {
        const signT = (t + j * 0.0035) % 1.0;
        const pt = this.splineCurve.getPoint(signT);
        const tang = this.splineCurve.getTangent(signT);
        const binorm = new THREE.Vector3().crossVectors(tang, up).normalize();

        const sideOffset = -dir * 10.8;
        const pos = pt.clone().addScaledVector(binorm, sideOffset);
        pos.y += 0.85;

        const signMesh = new THREE.Group();
        signMesh.position.copy(pos);
        const lookTarget = pt.clone().addScaledVector(tang, -18);
        signMesh.lookAt(lookTarget);

        const board = new THREE.Mesh(boardGeo, mat);
        board.position.y = 0.55;
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.y = -0.15;

        signMesh.add(board, post);
        chevronGroup.add(signMesh);
      }
    });

    this.trackGroup.add(chevronGroup);
  }

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
      return new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), mat);
    };

    const postMat = new THREE.MeshStandardMaterial({ color: 0x343a40, metalness: 0.8, roughness: 0.3 });
    const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8);
    const up = new THREE.Vector3(0, 1, 0);

    const zones = [
      { baseT: 0.06, distances: ['150', '100', '50'] },
      { baseT: 0.36, distances: ['150', '100', '50'] },
      { baseT: 0.62, distances: ['150', '100', '50'] }
    ];

    zones.forEach(({ baseT, distances }) => {
      distances.forEach((distStr, idx) => {
        const markerT = (baseT + idx * 0.003) % 1.0;
        const pt = this.splineCurve.getPoint(markerT);
        const tang = this.splineCurve.getTangent(markerT);
        const binorm = new THREE.Vector3().crossVectors(tang, up).normalize();

        const pos = pt.clone().addScaledVector(binorm, 11.0);
        pos.y += 0.7;

        const markerObj = new THREE.Group();
        markerObj.position.copy(pos);
        const lookTarget = pt.clone().addScaledVector(tang, -15);
        markerObj.lookAt(lookTarget);

        const board = createBrakeBoard(distStr);
        board.position.y = 0.5;
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.y = -0.1;

        markerObj.add(board, post);
        markerGroup.add(markerObj);
      });
    });

    this.trackGroup.add(markerGroup);
  }

  // Highway Streetlights — 4 InstancedMeshes instead of 300 separate draw calls!
  private buildHighwayStreetlights() {
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xadb5bd, metalness: 0.88, roughness: 0.28 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x212529, metalness: 0.9, roughness: 0.2 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });

    const poleGeo = new THREE.CylinderGeometry(0.14, 0.22, 10.5, 10);
    const armGeo = new THREE.CylinderGeometry(0.09, 0.12, 4.8, 8);
    const headGeo = new THREE.BoxGeometry(0.9, 0.24, 1.5);
    const bulbGeo = new THREE.PlaneGeometry(0.75, 1.3);
    bulbGeo.rotateX(Math.PI / 2);

    const numLamps = 75;
    const poleInst = new THREE.InstancedMesh(poleGeo, lampMat, numLamps);
    const armInst = new THREE.InstancedMesh(armGeo, lampMat, numLamps);
    const headInst = new THREE.InstancedMesh(headGeo, headMat, numLamps);
    const bulbInst = new THREE.InstancedMesh(bulbGeo, bulbMat, numLamps);

    const up = new THREE.Vector3(0, 1, 0);
    const parentObj = new THREE.Object3D();
    const childObj = new THREE.Object3D();
    const worldMat = new THREE.Matrix4();

    for (let i = 0; i < numLamps; i++) {
      const t = i / numLamps;
      const pt = this.splineCurve.getPoint(t);
      const tang = this.splineCurve.getTangent(t);
      const binorm = new THREE.Vector3().crossVectors(tang, up).normalize();

      const side = i % 2 === 0 ? 1 : -1;
      const pos = pt.clone().addScaledVector(binorm, side * 11.2);
      pos.y = this.getNaturalTerrainElevation(pos.x, pos.z);

      parentObj.position.copy(pos);
      parentObj.rotation.set(0, Math.atan2(tang.x, tang.z), 0);
      parentObj.updateMatrix();

      childObj.position.set(0, 5.25, 0);
      childObj.rotation.set(0, 0, 0);
      childObj.updateMatrix();
      worldMat.multiplyMatrices(parentObj.matrix, childObj.matrix);
      poleInst.setMatrixAt(i, worldMat);

      childObj.position.set(-side * 2.0, 10.2, 0);
      childObj.rotation.set(0, 0, side * (Math.PI / 3));
      childObj.updateMatrix();
      worldMat.multiplyMatrices(parentObj.matrix, childObj.matrix);
      armInst.setMatrixAt(i, worldMat);

      childObj.position.set(-side * 3.6, 11.0, 0);
      childObj.rotation.set(0, 0, 0);
      childObj.updateMatrix();
      worldMat.multiplyMatrices(parentObj.matrix, childObj.matrix);
      headInst.setMatrixAt(i, worldMat);

      childObj.position.set(-side * 3.6, 10.85, 0);
      childObj.updateMatrix();
      worldMat.multiplyMatrices(parentObj.matrix, childObj.matrix);
      bulbInst.setMatrixAt(i, worldMat);
    }

    this.trackGroup.add(poleInst, armInst, headInst, bulbInst);
  }

  private buildLighthouse() {
    const lighthouse = new THREE.Group();
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.6 });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 6.2, 38.0, 8), towerMat);
    tower.position.y = 19.0;
    tower.castShadow = true;
    lighthouse.add(tower);

    const redBandMat = new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.5 });
    for (const by of [12.0, 24.0]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 4.0, 8), redBandMat);
      band.position.y = by;
      lighthouse.add(band);
    }

    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 1.2, 8), towerMat);
    gallery.position.y = 38.6;
    lighthouse.add(gallery);

    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.2, 4.2, 8),
      new THREE.MeshBasicMaterial({ color: 0xfffaed })
    );
    lantern.position.y = 41.2;
    lighthouse.add(lantern);

    const beaconGroup = new THREE.Group();
    beaconGroup.position.set(0, 41.2, 0);
    const beamGeo = new THREE.ConeGeometry(8.0, 120.0, 16);
    beamGeo.rotateX(Math.PI / 2);
    beamGeo.translate(0, 0, 60.0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff0aa,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    });
    beaconGroup.add(new THREE.Mesh(beamGeo, beamMat));
    lighthouse.add(beaconGroup);
    this.lighthouseBeacons.push(beaconGroup);

    lighthouse.position.set(1380, 0.0, 3100);
    this.trackGroup.add(lighthouse);
  }

  private buildWindTurbines() {
    const turbineGroup = new THREE.Group();
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3, metalness: 0.5 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const bladeGeo = new THREE.BoxGeometry(0.65, 18.0, 0.15);

    const turbinePositions = [
      [-2100, 2600],
      [-2250, 2200],
      [-2400, 1800],
      [-2200, 1400],
      [-2350, 2900],
      [-2500, 2400]
    ];

    turbinePositions.forEach(([tx, tz]) => {
      const turbine = new THREE.Group();
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.8, 48.0, 12), towerMat);
      tower.position.y = 24.0;
      turbine.add(tower);

      const nacelle = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 6.5), towerMat);
      nacelle.position.set(0, 48.0, 0);
      turbine.add(nacelle);

      const rotorGroup = new THREE.Group();
      rotorGroup.position.set(0, 48.0, 3.4);
      rotorGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 12), towerMat));

      for (let b = 0; b < 3; b++) {
        const bladeArm = new THREE.Group();
        bladeArm.rotation.z = (b / 3) * Math.PI * 2;
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.y = 9.5;
        bladeArm.add(blade);
        rotorGroup.add(bladeArm);
      }

      turbine.add(rotorGroup);
      this.windTurbineBlades.push(rotorGroup);

      const groundY = this.getNaturalTerrainElevation(tx, tz);
      turbine.position.set(tx, groundY, tz);
      turbineGroup.add(turbine);
    });

    this.trackGroup.add(turbineGroup);
  }

  // INSTANCED TREES & FOLIAGE: Converts ~2,000+ separate meshes into ~14 batched draw calls!
  private buildTrees() {
    const oaks: THREE.Object3D[] = [];
    const pines: THREE.Object3D[] = [];
    const palms: THREE.Object3D[] = [];
    const redwoods: THREE.Object3D[] = [];
    const up = new THREE.Vector3(0, 1, 0);

    const count = 520;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pt = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const side = (i % 2 === 0 ? 1 : -1) * (i % 3 === 0 ? -1 : 1);
      const distance = 15.0 + (i % 5) * 4.4 + ((i * 17) % 10) * 0.6;
      const treePos = pt.clone().addScaledVector(binormal, side * distance);

      const { dist } = this.getClosestSplinePoint(treePos.x, treePos.z);
      if (dist < 14.2) continue;

      const groundY = this.getNaturalTerrainElevation(treePos.x, treePos.z);
      const s = 0.95 + (i % 4) * 0.12;
      const node = new THREE.Object3D();
      node.position.set(treePos.x, groundY, treePos.z);
      node.rotation.y = (i * 1.7) % (Math.PI * 2);
      node.scale.set(s, s * (0.94 + (i % 3) * 0.08), s);
      node.updateMatrix();

      if (t >= 0.10 && t <= 0.28) {
        palms.push(node);
      } else if (t >= 0.29 && t <= 0.50) {
        pines.push(node);
      } else if (t >= 0.74 && t <= 0.88) {
        redwoods.push(node);
      } else if (i % 2 === 0) {
        oaks.push(node);
      } else {
        pines.push(node);
      }
    }

    const dummy = new THREE.Object3D();
    const outMat = new THREE.Matrix4();

    // 1. European Oaks (Instanced)
    if (oaks.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.28, 0.58, 8.5, 10);
      trunkGeo.translate(0, 4.25, 0);
      const crown1Geo = new THREE.DodecahedronGeometry(3.6, 1);
      crown1Geo.translate(0, 8.8, 0);
      const crown2Geo = new THREE.DodecahedronGeometry(2.6, 1);
      crown2Geo.translate(0.8, 10.8, -0.6);

      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.95 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6024, roughness: 0.82 });

      const tInst = new THREE.InstancedMesh(trunkGeo, trunkMat, oaks.length);
      const c1Inst = new THREE.InstancedMesh(crown1Geo, leafMat, oaks.length);
      const c2Inst = new THREE.InstancedMesh(crown2Geo, leafMat, oaks.length);

      oaks.forEach((n, idx) => {
        tInst.setMatrixAt(idx, n.matrix);
        c1Inst.setMatrixAt(idx, n.matrix);
        c2Inst.setMatrixAt(idx, n.matrix);
      });
      this.trackGroup.add(tInst, c1Inst, c2Inst);
    }

    // 2. Alpine Pines (Instanced)
    if (pines.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.18, 0.44, 13.0, 8);
      trunkGeo.translate(0, 6.5, 0);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x241710, roughness: 0.96 });
      const needleMat = new THREE.MeshStandardMaterial({ color: 0x1d4423, roughness: 0.84 });

      const tInst = new THREE.InstancedMesh(trunkGeo, trunkMat, pines.length);
      pines.forEach((n, idx) => tInst.setMatrixAt(idx, n.matrix));
      this.trackGroup.add(tInst);

      const tiers = [
        { y: 5.2, r: 3.5, h: 2.8 },
        { y: 7.4, r: 2.9, h: 2.6 },
        { y: 9.4, r: 2.2, h: 2.3 },
        { y: 11.2, r: 1.5, h: 2.0 }
      ];
      tiers.forEach((tier) => {
        const coneGeo = new THREE.ConeGeometry(tier.r, tier.h, 8);
        coneGeo.translate(0, tier.y, 0);
        const inst = new THREE.InstancedMesh(coneGeo, needleMat, pines.length);
        pines.forEach((n, idx) => inst.setMatrixAt(idx, n.matrix));
        this.trackGroup.add(inst);
      });
    }

    // 3. Riviera Palm Trees (Instanced)
    if (palms.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.24, 0.45, 11.0, 8);
      trunkGeo.rotateZ(-0.12);
      trunkGeo.translate(0.6, 5.5, 0);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6c584c, roughness: 0.9 });

      const frondMat = new THREE.MeshStandardMaterial({ color: 0x38b000, roughness: 0.6, side: THREE.DoubleSide });
      const frondGeo = new THREE.BoxGeometry(0.42, 0.08, 4.2);
      frondGeo.rotateX(0.38);
      frondGeo.translate(0, 0, 2.0);

      const tInst = new THREE.InstancedMesh(trunkGeo, trunkMat, palms.length);
      const fInst = new THREE.InstancedMesh(frondGeo, frondMat, palms.length * 6);

      palms.forEach((n, idx) => {
        tInst.setMatrixAt(idx, n.matrix);
        for (let f = 0; f < 6; f++) {
          dummy.position.set(1.2, 11.1, 0);
          dummy.rotation.set(0, (f / 6) * Math.PI * 2, 0);
          dummy.updateMatrix();
          outMat.multiplyMatrices(n.matrix, dummy.matrix);
          fInst.setMatrixAt(idx * 6 + f, outMat);
        }
      });
      this.trackGroup.add(tInst, fInst);
    }

    // 4. Giant Redwoods (Instanced)
    if (redwoods.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.45, 1.1, 24.0, 10);
      trunkGeo.translate(0, 12.0, 0);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x582f0e, roughness: 0.95 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x1e3f20, roughness: 0.8 });

      const tInst = new THREE.InstancedMesh(trunkGeo, trunkMat, redwoods.length);
      redwoods.forEach((n, idx) => tInst.setMatrixAt(idx, n.matrix));
      this.trackGroup.add(tInst);

      const tiers = [
        { y: 12.5, r: 4.8, h: 4.0 },
        { y: 16.0, r: 3.9, h: 3.6 },
        { y: 19.2, r: 3.0, h: 3.2 },
        { y: 22.0, r: 1.9, h: 2.5 }
      ];
      tiers.forEach((tier) => {
        const coneGeo = new THREE.ConeGeometry(tier.r, tier.h, 8);
        coneGeo.translate(0, tier.y, 0);
        const inst = new THREE.InstancedMesh(coneGeo, leafMat, redwoods.length);
        redwoods.forEach((n, idx) => inst.setMatrixAt(idx, n.matrix));
        this.trackGroup.add(inst);
      });
    }
  }

  // Roadside Boulders as a SINGLE InstancedMesh (70 draw calls -> 1!)
  private buildRoadsideBoulders() {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x495057, roughness: 0.94, metalness: 0.05 });
    const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);

    const numRocks = 70;
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, numRocks);
    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < numRocks; i++) {
      const t = i / numRocks;
      const pt = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const side = i % 2 === 0 ? 1 : -1;
      const dist = 16.5 + ((i * 29) % 14);
      const rockPos = pt.clone().addScaledVector(binormal, side * dist);

      const rockScale = 1.6 + ((i * 11) % 28) * 0.1;
      const groundY = this.getNaturalTerrainElevation(rockPos.x, rockPos.z);

      dummy.position.set(rockPos.x, groundY + rockScale * 0.35, rockPos.z);
      dummy.rotation.set(i * 0.7, i * 1.1, i * 0.5);
      dummy.scale.setScalar(rockScale);
      dummy.updateMatrix();
      rockInst.setMatrixAt(i, dummy.matrix);
    }

    this.trackGroup.add(rockInst);
  }

  private buildJumpRamps() {
    const rampSpecs = [
      { t: 0.145, side: -4.2, height: 2.3 }, // Riviera Coastline Highway Kicker
      { t: 0.38, side: 4.2, height: 2.45 },  // Alpine Foothills Ascent Jump
      { t: 0.465, side: -3.8, height: 2.6 }, // Sky Viaduct Aerobridge Launch
      { t: 0.69, side: 4.2, height: 2.35 }   // Red Rock Canyon Air Deck
    ];

    const rampWidth = 5.6;
    const rampLength = 9.5;
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xf5b000, roughness: 0.35, metalness: 0.6 });
    const chevronMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const railStripeMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    const up = new THREE.Vector3(0, 1, 0);

    rampSpecs.forEach((spec) => {
      const rampPoint = this.splineCurve.getPoint(spec.t);
      const tangent = this.splineCurve.getTangent(spec.t).normalize();
      const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const rampGroup = new THREE.Group();
      const rampPos = rampPoint.clone().addScaledVector(binormal, spec.side);
      rampGroup.position.set(rampPos.x, rampPos.y + 0.22, rampPos.z);
      rampGroup.rotation.y = Math.atan2(tangent.x, tangent.z);

      const rampGeo = new THREE.BoxGeometry(rampWidth, spec.height, rampLength);
      rampGeo.rotateX(Math.PI / 14);
      const rampMesh = new THREE.Mesh(rampGeo, rampMat);
      rampMesh.position.set(0, spec.height * 0.44, 0);
      rampMesh.castShadow = true;
      rampMesh.receiveShadow = true;
      rampGroup.add(rampMesh);

      // Glowing boost chevrons & edge safety strips
      for (const cz of [-1.2, 1.2, 3.2]) {
        const chevron = new THREE.Mesh(
          new THREE.BoxGeometry(rampWidth * 0.72, 0.1, 0.42),
          chevronMat
        );
        chevron.position.set(0, spec.height * (0.45 + (cz + 4.75) / 14), cz);
        chevron.rotation.x = Math.PI / 14;
        rampGroup.add(chevron);
      }

      const sideRailGeo = new THREE.BoxGeometry(0.16, 0.18, rampLength);
      sideRailGeo.rotateX(Math.PI / 14);
      const railL = new THREE.Mesh(sideRailGeo, railStripeMat);
      railL.position.set(-rampWidth * 0.48, spec.height * 0.56, 0);
      const railR = railL.clone();
      railR.position.x = rampWidth * 0.48;
      rampGroup.add(railL, railR);

      this.trackGroup.add(rampGroup);

      this.ramps.push({
        position: new THREE.Vector3(rampPos.x, rampPos.y + 0.22, rampPos.z),
        tangent,
        binormal,
        width: rampWidth,
        length: rampLength,
        height: spec.height
      });
    });
  }

  public update(delta: number) {
    for (const blades of this.windTurbineBlades) {
      blades.rotation.z += delta * 1.6;
    }
    for (const beacon of this.lighthouseBeacons) {
      beacon.rotation.y += delta * 1.2;
    }
  }

  public getRoadCenterAtZ(z: number): { x: number; y: number } {
    const { point } = this.getClosestSplinePoint(0, z);
    return { x: point.x, y: point.y };
  }

  // Exact ground height query including local-space ramp slope lookup!
  public getElevationAt(x: number, z: number): number {
    for (const ramp of this.ramps) {
      const dx = x - ramp.position.x;
      const dz = z - ramp.position.z;
      const localSide = dx * ramp.binormal.x + dz * ramp.binormal.z;
      const localFwd = dx * ramp.tangent.x + dz * ramp.tangent.z;

      if (Math.abs(localSide) < ramp.width * 0.5 && Math.abs(localFwd) < ramp.length * 0.5) {
        const slopeProgress = (localFwd + ramp.length * 0.5) / ramp.length;
        return ramp.position.y + slopeProgress * ramp.height;
      }
    }

    const { point, dist } = this.getClosestSplinePoint(x, z);

    if (dist < 9.5) {
      return point.y + 0.22;
    } else if (dist < 13.5) {
      const t = (dist - 9.5) / 4.0;
      return (point.y + 0.22) * (1 - t) + (point.y - 0.05) * t;
    } else {
      return this.getNaturalTerrainElevation(x, z);
    }
  }

  public dispose() {
    this.scene.remove(this.trackGroup);
    this.trackGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          if (!m) return;
          if ((m as THREE.MeshStandardMaterial).map) {
            (m as THREE.MeshStandardMaterial).map?.dispose();
          }
          m.dispose();
        });
      }
    });
  }
}
