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

    // 1. Grand Alpine & Coastal Highway Circuit (Expanded 7.6 KM Closed Circuit)
    const points = [
      // Sector 1: Start/Finish Speedway Corridor (High-Speed Straightaway facing +Z)
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 250),
      new THREE.Vector3(0, 0, 580),

      // Sector 2: Coastal Valley Sweeps & Ascending Foothills (Turn 1-3)
      new THREE.Vector3(140, 2.8, 980),
      new THREE.Vector3(320, 6.5, 1420),
      new THREE.Vector3(450, 11.0, 1880),

      // Sector 3: Alpine Mountain Pass & High Viaduct Bridge (Turn 4-5)
      new THREE.Vector3(480, 17.5, 2350),
      new THREE.Vector3(390, 23.0, 2800),
      new THREE.Vector3(210, 26.5, 3180),

      // Sector 4: Alpine Summit Crest & Stunt Jump Launch (Turn 6-7)
      new THREE.Vector3(30, 22.0, 3420),
      new THREE.Vector3(-190, 16.5, 3360),

      // Sector 5: Mountain Tunnel Cut & Rocky Canyon (Turn 8-10)
      new THREE.Vector3(-390, 11.0, 3080),
      new THREE.Vector3(-530, 6.2, 2660),
      new THREE.Vector3(-590, 3.8, 2180),

      // Sector 6: Canyon Drift S-Bends & Fast Chicanes (Turn 11-13)
      new THREE.Vector3(-560, 2.2, 1680),
      new THREE.Vector3(-460, 4.6, 1220),
      new THREE.Vector3(-510, 5.8, 820),

      // Sector 7: Return Expressway & Sweeping Valley Straights (Turn 14-16)
      new THREE.Vector3(-440, 3.8, 420),
      new THREE.Vector3(-290, 1.8, 120),
      new THREE.Vector3(-130, 0.7, -90),

      // Sector 8: Final Chicanes & Grid Reconnection
      new THREE.Vector3(-40, 0.2, -220),
      new THREE.Vector3(0, 0.0, -140),
      new THREE.Vector3(0, 0.0, -40)
    ];

    this.splineCurve = new THREE.CatmullRomCurve3(points, true); // CLOSED = TRUE!
    this.splineCurve.curveType = 'catmullrom';
    this.splineCurve.tension = 0.5;

    // Pre-sample spline points for ultrafast O(1) nearest-point lookups
    this.sampledPoints = this.splineCurve.getPoints(1200);

    this.setupLighting();
    this.buildTerrain();
    this.buildDistantMountains();
    this.buildRoad();
    this.buildHighwayTunnel();
    this.buildViaductBridge();
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

  // 2. Rolling British & Alpine Countryside Contouring Seamlessly Along the Grand Circuit
  private buildTerrain() {
    const terrainGeo = new THREE.PlaneGeometry(2800, 4800, 160, 200);
    terrainGeo.rotateX(-Math.PI / 2);
    terrainGeo.translate(-60, 0, 1600);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);

      const elev = this.getElevationAt(vx, vz);
      const { dist } = this.getClosestSplinePoint(vx, vz);
      // Depress ground mesh beneath 18.5m asphalt road ribbon to completely eliminate Z-fighting
      const y = dist < 9.5 ? elev - 0.34 : (dist < 12.5 ? elev - 0.34 * (1 - (dist - 9.5) / 3.0) : elev);
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
        const noise = (n1 + n2 + n3 + 1.75) / 3.5;

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
    terrainTexture.repeat.set(72, 120);
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

  // 3. Majestic 360-Degree Ring of Alpine Mountain Peaks Encircling the Horizon
  private buildDistantMountains() {
    const mountainGroup = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x47494e,
      roughness: 0.94,
      metalness: 0.06
    });

    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xf0f4f8,
      roughness: 0.72,
      metalness: 0.08
    });

    const numPeaks = 44;
    const centerX = -60;
    const centerZ = 1600;

    for (let i = 0; i < numPeaks; i++) {
      const angle = (i / numPeaks) * Math.PI * 2;
      const radius = 1450 + (i % 5) * 110 + Math.random() * 80;
      const mx = centerX + Math.cos(angle) * radius;
      const mz = centerZ + Math.sin(angle) * radius;

      const peakHeight = 150 + (i % 7) * 22 + Math.random() * 35;
      const baseRadius = 260 + (i % 4) * 45;

      // Mountain body
      const mountainGeo = new THREE.ConeGeometry(baseRadius, peakHeight, 9, 3);
      // Natural jagged ridge perturbation
      const pos = mountainGeo.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const vx = pos.getX(v);
        const vy = pos.getY(v);
        const vz = pos.getZ(v);
        const noise = 1.0 + Math.sin(vx * 0.04) * Math.cos(vz * 0.04) * 0.22;
        pos.setXYZ(v, vx * noise, vy, vz * noise);
      }
      mountainGeo.computeVertexNormals();

      const mountain = new THREE.Mesh(mountainGeo, rockMat);
      mountain.position.set(mx, peakHeight * 0.44, mz);
      mountain.rotation.y = angle + 0.3;
      mountain.castShadow = false;
      mountain.receiveShadow = true;
      mountainGroup.add(mountain);

      // Snow-capped peak summit
      const snowGeo = new THREE.ConeGeometry(baseRadius * 0.38, peakHeight * 0.38, 9, 2);
      const snowMesh = new THREE.Mesh(snowGeo, snowMat);
      snowMesh.position.set(mx, peakHeight * 0.75, mz);
      snowMesh.rotation.y = mountain.rotation.y;
      mountainGroup.add(snowMesh);
    }

    this.trackGroup.add(mountainGroup);
  }

  // 4. Grand 4-Lane 18.5m Wide High-Speed Highway Ribbon
  private buildRoad() {
    const numSteps = 1400;
    const roadWidth = 18.5; // Grand 4-lane width with generous overtaking & drift space

    const roadGeo = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Road Texture Canvas (4 Lanes + Red/White Curbs + Double Yellow Median + Skid Marks)
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Asphalt Base (Rich dark charcoal asphalt)
    ctx.fillStyle = '#17191d';
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle Asphalt Grain Noise
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let i = 0; i < 9000; i++) {
      ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
    }

    // Outer Red/White Racing Rumble Strip Curbs
    for (let y = 0; y < 1024; y += 64) {
      ctx.fillStyle = (y / 64) % 2 === 0 ? '#d90429' : '#f8f9fa';
      ctx.fillRect(0, y, 32, 64);
      ctx.fillRect(992, y, 32, 64);
    }

    // Solid White Shoulder Edge Lines
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(38, 0, 10, 1024);
    ctx.fillRect(976, 0, 10, 1024);

    // Lane 1 & 2 separator (Dashed White)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    for (let y = 0; y < 1024; y += 100) {
      ctx.fillRect(276, y, 8, 60);
    }

    // Lane 3 & 4 separator (Dashed White)
    for (let y = 0; y < 1024; y += 100) {
      ctx.fillRect(740, y, 8, 60);
    }

    // Double Continuous Amber Yellow Center Median
    ctx.fillStyle = '#ffb703';
    ctx.fillRect(504, 0, 6, 1024);
    ctx.fillRect(514, 0, 6, 1024);

    // Dark Rubber Tire Skid Marks on Apex Lines
    ctx.fillStyle = 'rgba(10, 10, 14, 0.32)';
    ctx.beginPath();
    ctx.ellipse(360, 512, 16, 420, 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(664, 512, 16, 420, -0.05, 0, Math.PI * 2);
    ctx.fill();

    const roadTexture = new THREE.CanvasTexture(canvas);
    roadTexture.wrapS = THREE.RepeatWrapping;
    roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(1, 1);
    roadTexture.anisotropy = 8;

    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.62,
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

      uvs.push(0, t * 240);
      uvs.push(1, t * 240);

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

    // Reflective Amber Cat's-Eye Road Studs along center line every ~18 meters
    const studGeo = new THREE.BoxGeometry(0.14, 0.05, 0.24);
    const studMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    const studGroup = new THREE.Group();

    for (let t = 0; t <= 1.0; t += 0.0025) {
      const pt = this.splineCurve.getPoint(t);
      const tang = this.splineCurve.getTangent(t);
      const stud = new THREE.Mesh(studGeo, studMat);
      stud.position.set(pt.x, pt.y + 0.24, pt.z);
      stud.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tang);
      studGroup.add(stud);
    }
    this.trackGroup.add(studGroup);
  }

  // 4b. Mountain Highway Tunnel Section with Illuminated Neon Lights (t = 0.50 to 0.57)
  private buildHighwayTunnel() {
    const tunnelGroup = new THREE.Group();
    const startT = 0.50;
    const endT = 0.57;
    const steps = 70;

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x27292d,
      roughness: 0.88,
      metalness: 0.12,
      side: THREE.BackSide
    });

    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff0aa });

    // Build arched tubular tunnel enclosure
    const tunnelPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = startT + (i / steps) * (endT - startT);
      const pt = this.splineCurve.getPoint(t);
      tunnelPoints.push(new THREE.Vector3(pt.x, pt.y + 3.8, pt.z));
    }

    const tunnelPath = new THREE.CatmullRomCurve3(tunnelPoints);
    const tunnelGeo = new THREE.TubeGeometry(tunnelPath, steps, 11.2, 12, false);
    const tunnelMesh = new THREE.Mesh(tunnelGeo, wallMat);
    tunnelGroup.add(tunnelMesh);

    // Overhead ceiling strip lights
    for (let i = 4; i < steps; i += 4) {
      const t = startT + (i / steps) * (endT - startT);
      const pt = this.splineCurve.getPoint(t);
      const tang = this.splineCurve.getTangent(t);

      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 3.2), lightMat);
      lamp.position.set(pt.x, pt.y + 7.2, pt.z);
      lamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tang);
      tunnelGroup.add(lamp);
    }

    // Tunnel Portals with Caution Chevron Markings
    const portalMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.6 });
    for (const portalT of [startT, endT]) {
      const pt = this.splineCurve.getPoint(portalT);
      const tang = this.splineCurve.getTangent(portalT);
      const portal = new THREE.Group();
      portal.position.set(pt.x, pt.y + 4.0, pt.z);
      portal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tang);

      const arch = new THREE.Mesh(new THREE.TorusGeometry(11.4, 1.2, 8, 16, Math.PI), portalMat);
      arch.rotation.x = -Math.PI / 2;
      portal.add(arch);
      tunnelGroup.add(portal);
    }

    this.trackGroup.add(tunnelGroup);
  }

  // 4c. Concrete Viaduct Bridge over Scenic Mountain Valley (t = 0.27 to 0.35)
  private buildViaductBridge() {
    const bridgeGroup = new THREE.Group();
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x6c757d,
      roughness: 0.85,
      metalness: 0.15
    });

    const startT = 0.27;
    const endT = 0.35;
    const numPillars = 9;

    for (let i = 0; i < numPillars; i++) {
      const t = startT + (i / (numPillars - 1)) * (endT - startT);
      const pt = this.splineCurve.getPoint(t);

      // Deep concrete piers grounding elevated highway to the valley basin
      const pillarHeight = Math.max(8.0, pt.y + 4.0);
      const pillarGeo = new THREE.BoxGeometry(2.8, pillarHeight, 2.8);
      const pL = new THREE.Mesh(pillarGeo, pillarMat);
      pL.position.set(pt.x - 7.5, pt.y - pillarHeight / 2, pt.z);
      pL.castShadow = true;

      const pR = new THREE.Mesh(pillarGeo, pillarMat);
      pR.position.set(pt.x + 7.5, pt.y - pillarHeight / 2, pt.z);
      pR.castShadow = true;

      // Cross-beam girder
      const girder = new THREE.Mesh(new THREE.BoxGeometry(20.0, 1.5, 3.2), pillarMat);
      girder.position.set(pt.x, pt.y - 0.75, pt.z);
      girder.castShadow = true;

      bridgeGroup.add(pL, pR, girder);
    }

    this.trackGroup.add(bridgeGroup);
  }

  // 5. Armco Galvanized Steel Crash Barriers
  private buildArmcoGuardrails() {
    const numSteps = 900;
    const roadWidth = 18.5; // Wide highway barrier spacing

    const railMat = new THREE.MeshStandardMaterial({
      color: 0xa8b0b8,
      metalness: 0.88,
      roughness: 0.3
    });

    const postMat = new THREE.MeshStandardMaterial({
      color: 0x3d352e,
      roughness: 0.95
    });

    const postGeo = new THREE.BoxGeometry(0.2, 1.0, 0.2);

    for (let side of [-1, 1]) {
      const railPoints: THREE.Vector3[] = [];
      const postGroup = new THREE.Group();

      for (let i = 0; i <= numSteps; i++) {
        const t = i / numSteps;
        const pt = this.splineCurve.getPoint(t);
        const tangent = this.splineCurve.getTangent(t);
        const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

        const barrierPos = pt.clone().add(binormal.multiplyScalar(side * (roadWidth / 2 + 1.2)));
        barrierPos.y += 0.58;
        railPoints.push(barrierPos);

        if (i % 3 === 0) {
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(barrierPos.x, barrierPos.y - 0.25, barrierPos.z);
          post.castShadow = true;
          postGroup.add(post);
        }
      }

      const railCurve = new THREE.CatmullRomCurve3(railPoints, true);
      const railGeo = new THREE.TubeGeometry(railCurve, numSteps, 0.16, 8, true);
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

    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 7.2, 0.9), pillarMat);
    pillarL.position.set(-11.5, 3.6, 0);
    pillarL.castShadow = true;
    const pillarR = pillarL.clone();
    pillarR.position.x = 11.5;

    const crossbeam = new THREE.Mesh(new THREE.BoxGeometry(24.5, 1.6, 1.2), beamMat);
    crossbeam.position.set(0, 6.6, 0);
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
      new THREE.PlaneGeometry(21.0, 1.3),
      new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide })
    );
    banner.rotation.y = Math.PI; // Face approaching vehicles
    banner.position.set(0, 6.6, -0.62);

    archGroup.add(pillarL, pillarR, crossbeam, banner);
    this.trackGroup.add(archGroup);

    // B. Highway Gantry Signs at t = 0.25, 0.55, 0.82
    for (const gantryT of [0.25, 0.55, 0.82]) {
      const pt = this.splineCurve.getPoint(gantryT);
      const tang = this.splineCurve.getTangent(gantryT);

      const gantry = new THREE.Group();
      gantry.position.copy(pt);
      gantry.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tang);

      const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 7.8, 12), pillarMat);
      pL.position.set(-11.5, 3.9, 0);
      const pR = pL.clone();
      pR.position.x = 11.5;

      const beam = new THREE.Mesh(new THREE.BoxGeometry(24.0, 0.45, 0.45), pillarMat);
      beam.position.set(0, 7.2, 0);

      const signBoard = new THREE.Mesh(
        new THREE.BoxGeometry(8.5, 2.6, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x007749, roughness: 0.4 })
      );
      signBoard.position.set(-3.5, 5.8, 0);

      gantry.add(pL, pR, beam, signBoard);
      this.trackGroup.add(gantry);
    }
  }

  // 6b. Dynamic Racetrack Warning Chevron Arrow Signs on Curves (>>> / <<<)
  private buildChevronSigns() {
    const chevronGroup = new THREE.Group();

    // Sharp curve zones: t values and sign directions (1 = curve right, -1 = curve left)
    const curveLocations = [
      { t: 0.07, dir: 1, count: 6 },  // Turn 1
      { t: 0.17, dir: 1, count: 6 },  // Turn 2
      { t: 0.26, dir: -1, count: 7 }, // Turn 3-4 Alpine crest
      { t: 0.42, dir: -1, count: 7 }, // Turn 5 Forest Hairpin
      { t: 0.63, dir: 1, count: 7 },  // Turn 8 S-Bend
      { t: 0.76, dir: -1, count: 6 }, // Turn 10 Valley sweep
      { t: 0.89, dir: 1, count: 6 }   // Turn 12 Final entry
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
        const signT = (t + j * 0.005) % 1.0;
        const pt = this.splineCurve.getPoint(signT);
        const tang = this.splineCurve.getTangent(signT);
        const binorm = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0, 1, 0)).normalize();

        // Place on outer barrier of the curve
        const sideOffset = -dir * 10.8;
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
      { baseT: 0.05, distances: ['150', '100', '50'] },
      { baseT: 0.39, distances: ['150', '100', '50'] }
    ];

    zones.forEach(({ baseT, distances }) => {
      distances.forEach((distStr, idx) => {
        const markerT = (baseT + idx * 0.004) % 1.0;
        const pt = this.splineCurve.getPoint(markerT);
        const tang = this.splineCurve.getTangent(markerT);
        const binorm = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0, 1, 0)).normalize();

        const pos = pt.clone().add(binorm.multiplyScalar(11.0));
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

    const poleGeo = new THREE.CylinderGeometry(0.14, 0.22, 10.5, 10);
    const armGeo = new THREE.CylinderGeometry(0.09, 0.12, 4.8, 8);
    armGeo.rotateZ(Math.PI / 3);

    const headGeo = new THREE.BoxGeometry(0.9, 0.24, 1.5);
    const bulbGeo = new THREE.PlaneGeometry(0.75, 1.3);
    bulbGeo.rotateX(Math.PI / 2);

    const numLamps = 68; // Spaced evenly along the expanded 7.6 KM highway circuit
    for (let i = 0; i < numLamps; i++) {
      const t = i / numLamps;
      const pt = this.splineCurve.getPoint(t);
      const tang = this.splineCurve.getTangent(t);
      const binorm = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0, 1, 0)).normalize();

      const side = (i % 2 === 0 ? 1 : -1);
      const pos = pt.clone().add(binorm.multiplyScalar(side * 11.2));
      pos.y = this.getElevationAt(pos.x, pos.z);

      const lamp = new THREE.Group();
      lamp.position.copy(pos);
      lamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tang);

      // Main vertical pole
      const pole = new THREE.Mesh(poleGeo, lampMat);
      pole.position.set(0, 5.25, 0);
      pole.castShadow = true;

      // Curved overhang arm reaching into the road
      const arm = new THREE.Mesh(armGeo, lampMat);
      arm.position.set(-side * 2.0, 10.2, 0);
      arm.rotation.z = side * (Math.PI / 3);

      // Overhead luminaire housing
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(-side * 3.6, 11.0, 0);

      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(-side * 3.6, 10.85, 0);

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

    // 1. Densely line the entire 7.6 KM circuit with alternating Oaks, Pines & Roadside Bushes
    const count = 480;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pt = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const side = (i % 2 === 0 ? 1 : -1) * (i % 3 === 0 ? -1 : 1);
      const distance = 14.5 + (i % 5) * 4.2 + Math.random() * 5.0;
      const treePos = pt.clone().add(binormal.multiplyScalar(side * distance));

      // Absolute safety constraint: never place any tree within 13.0m of ANY road center (road width = 18.5m)
      const { dist } = this.getClosestSplinePoint(treePos.x, treePos.z);
      if (dist < 13.0) continue;

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
        const bushPos = pt.clone().add(binormal.multiplyScalar(side * (12.2 + Math.random() * 1.5)));
        const { dist: bushDist } = this.getClosestSplinePoint(bushPos.x, bushPos.z);
        if (bushDist >= 11.2) {
          const bushY = this.getElevationAt(bushPos.x, bushPos.z);
          const bush = bushTemplate.clone(true);
          bush.position.set(bushPos.x, bushY, bushPos.z);
          bush.rotation.y = Math.random() * Math.PI * 2;
          treeGroup.add(bush);
        }
      }
    }

    // 2. Majestic Tree Avenue along the Starting Straightaway (Z = 25 to 320)
    for (let z = 25; z <= 320; z += 30) {
      for (const side of [-1, 1]) {
        for (const distOffset of [14.8, 21.0]) {
          const treePos = new THREE.Vector3(side * distOffset, 0, z);

          // Absolute safety constraint: never place any tree within 13.0m of ANY road surface!
          const { dist } = this.getClosestSplinePoint(treePos.x, treePos.z);
          if (dist < 13.0) continue;

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

    for (let i = 0; i < 45; i++) {
      const t = 0.22 + (i / 45) * 0.55;
      const pt = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const side = i % 2 === 0 ? 1 : -1;
      const dist = 16.5 + Math.random() * 20.0;
      const rockPos = pt.clone().add(binormal.multiplyScalar(side * dist));

      const rockScale = 1.4 + Math.random() * 2.8;
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

    const rampWidth = 7.5;
    const rampLength = 10.0;
    const rampHeight = 2.4;

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

    if (dist < 9.5) {
      // Direct asphalt road surface height (18.5m wide road has 9.25m half-width)
      return point.y + 0.22;
    } else if (dist < 13.0) {
      // Soft transition from asphalt curb edge to ground
      const t = (dist - 9.5) / 3.5;
      return (point.y + 0.22) * (1 - t) + (point.y - 0.05) * t;
    } else {
      // Rolling meadow countryside
      const flankDist = dist - 13.0;
      const rolling = Math.sin(x * 0.012) * Math.cos(z * 0.009) * 3.5;
      return point.y - 0.05 + Math.min(12.0, flankDist * 0.035) + rolling * Math.min(1.0, flankDist / 15.0);
    }
  }
}
