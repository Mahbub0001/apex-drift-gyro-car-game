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
  public sampledPoints: THREE.Vector3[] = [];
  public ramps: RampCollider[] = [];
  public dirLight!: THREE.DirectionalLight;

  // Animated environmental elements
  private windTurbineBlades: THREE.Group[] = [];
  private lighthouseBeacons: THREE.Group[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // =========================================================================
    // 1. EXPANSIVE 12.5 KM GRAND COASTAL & ALPINE WORLD CIRCUIT (33 Control Points)
    // Spans 5,400m in Z and 3,150m in X with Diverse Biomes & Zero Road Clutter
    // =========================================================================
    const points = [
      // === SECTOR 1: GRAND PRIX START SPEEDWAY (Grid, Grandstands & Pit Complex) ===
      new THREE.Vector3(0, 0.0, 0),        // 0: Start Grid Line
      new THREE.Vector3(0, 0.0, 350),      // 1: Pit Straightaway
      new THREE.Vector3(0, 0.0, 750),      // 2: Speed Trap Straight
      new THREE.Vector3(25, 0.4, 1150),    // 3: Turn 1 Entry

      // === SECTOR 2: RIVIERA COASTAL OCEAN HIGHWAY (Beach, Yachts & Lighthouse) ===
      new THREE.Vector3(180, 1.2, 1600),   // 4: Coastal Sweeper Entry
      new THREE.Vector3(450, 1.8, 2050),   // 5: Seawall Straight overlooking Ocean
      new THREE.Vector3(780, 2.0, 2450),   // 6: Palm Beach Curve
      new THREE.Vector3(1050, 2.5, 2900),  // 7: Ocean Marina & Lighthouse Point
      new THREE.Vector3(1180, 3.8, 3350),  // 8: Coastal Apex Turn

      // === SECTOR 3: ALPINE FOOTHILLS & MOUNTAIN PASS ASCENT ===
      new THREE.Vector3(1100, 7.5, 3850),  // 9: Ascending Mountain Highway
      new THREE.Vector3(880, 14.0, 4300),  // 10: S-Bend Climb 1
      new THREE.Vector3(720, 21.0, 4700),  // 11: Pine Forest Switchback
      new THREE.Vector3(480, 28.5, 5050),  // 12: High Altitude Mountain Crest
      new THREE.Vector3(180, 34.0, 5300),  // 13: Summit Approach & Hairpin

      // === SECTOR 4: HIGH VIADUCT SKY BRIDGE (Canyon Skyway Crossing) ===
      new THREE.Vector3(-180, 36.5, 5400), // 14: Viaduct Sky Bridge Entry (High Altitude)
      new THREE.Vector3(-550, 36.0, 5350), // 15: Viaduct Sky Bridge Mid-Span (Gorge View)
      new THREE.Vector3(-920, 33.5, 5150), // 16: Viaduct Sky Bridge Exit

      // === SECTOR 5: NEON CYBER MOUNTAIN TUNNEL ===
      new THREE.Vector3(-1250, 27.0, 4800),// 17: Tunnel Portal Entry
      new THREE.Vector3(-1520, 21.0, 4350),// 18: Underground Mountain Curve
      new THREE.Vector3(-1700, 16.0, 3850),// 19: Tunnel Midpoint with Neon Lights
      new THREE.Vector3(-1800, 12.0, 3350),// 20: Tunnel Portal Exit

      // === SECTOR 6: RED ROCK CANYON & DRIFT GULCH ===
      new THREE.Vector3(-1850, 8.5, 2850), // 21: Canyon Gulch High-Speed Sweeper
      new THREE.Vector3(-1880, 5.5, 2300), // 22: Red Rock Drift Curve
      new THREE.Vector3(-1820, 3.5, 1750), // 23: Canyon Straight with Wind Turbines
      new THREE.Vector3(-1650, 2.2, 1250), // 24: Descending Canyon S-Bend

      // === SECTOR 7: TALL REDWOOD RIVER VALLEY ===
      new THREE.Vector3(-1380, 1.4, 800),  // 25: Giant Redwood Forest Entry
      new THREE.Vector3(-1050, 0.8, 450),  // 26: Valley River Crossing Bridge
      new THREE.Vector3(-720, 0.5, 200),   // 27: Forest High-Speed Chicane

      // === SECTOR 8: COASTAL BOULEVARD & FINAL CHICANE TO GRID ===
      new THREE.Vector3(-420, 0.2, 50),    // 28: Return Expressway
      new THREE.Vector3(-200, 0.0, -120),  // 29: Final Chicane Entry
      new THREE.Vector3(-60, 0.0, -220),   // 30: Final Corner Apex
      new THREE.Vector3(0, 0.0, -120),     // 31: Align to Main Straight
      new THREE.Vector3(0, 0.0, -30)       // 32: Start Grid Reconnection
    ];

    this.splineCurve = new THREE.CatmullRomCurve3(points, true);
    this.splineCurve.curveType = 'catmullrom';
    this.splineCurve.tension = 0.5;

    // Sample 2,400 points for dense, high-precision distance lookups (1 point per ~5m)
    this.sampledPoints = this.splineCurve.getPoints(2400);

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

  // =========================================================================
  // LIGHTING: Natural Sun & Directional Cast
  // =========================================================================
  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfffaed, 1.85);
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
    this.scene.add(this.dirLight);

    const hemiLight = new THREE.HemisphereLight(0x90caf9, 0x335824, 0.55);
    this.scene.add(hemiLight);
  }

  // =========================================================================
  // TERRAIN: Seamless Contour with 100% Guaranteed Road Clearance (Zero Z-Fighting)
  // =========================================================================
  private buildTerrain() {
    // 5,200m x 7,400m terrain plane centered around the 12.5 KM circuit
    const terrainGeo = new THREE.PlaneGeometry(5400, 7600, 200, 240);
    terrainGeo.rotateX(-Math.PI / 2);
    terrainGeo.translate(-400, 0, 2600);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);

      const elev = this.getNaturalTerrainElevation(vx, vz);
      const { dist, point } = this.getClosestSplinePoint(vx, vz);

      // RIGID GUARANTEE: Within 11.5m of track centerline, ground is STRICTLY depressed 0.45m below road
      let y = elev;
      if (dist < 11.5) {
        y = point.y - 0.45;
      } else if (dist < 22.0) {
        // Soft blend from depressed road trench up to natural ground
        const blend = (dist - 11.5) / 10.5;
        const targetDepress = point.y - 0.45;
        y = targetDepress * (1 - blend) + elev * blend;
      }
      pos.setY(i, y);
    }
    terrainGeo.computeVertexNormals();

    // Procedural High-Detail Meadow & Soil Texture Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Rich Alpine Green base
    ctx.fillStyle = '#2c4b1b';
    ctx.fillRect(0, 0, 1024, 1024);

    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;

    for (let y = 0; y < 1024; y++) {
      for (let x = 0; x < 1024; x++) {
        const idx = (y * 1024 + x) * 4;
        const n1 = Math.sin(x * 0.035) * Math.cos(y * 0.035);
        const n2 = Math.sin(x * 0.12 + y * 0.08) * 0.5;
        const n3 = Math.sin(x * 0.45) * Math.sin(y * 0.45) * 0.25;
        const noise = (n1 + n2 + n3 + 1.75) / 3.5;

        data[idx] = Math.floor(35 + noise * 38);
        data[idx + 1] = Math.floor(62 + noise * 48);
        data[idx + 2] = Math.floor(22 + noise * 18);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const terrainTexture = new THREE.CanvasTexture(canvas);
    terrainTexture.wrapS = THREE.RepeatWrapping;
    terrainTexture.wrapT = THREE.RepeatWrapping;
    terrainTexture.repeat.set(120, 160);
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

  // Natural terrain elevation calculation
  private getNaturalTerrainElevation(x: number, z: number): number {
    const { point, dist } = this.getClosestSplinePoint(x, z);

    // Flat coastal basin on eastern edge (ocean at X > 850)
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

  // =========================================================================
  // COASTAL OCEAN, BEACH & YACHTS: Sector 2 Riviera Marine Vistas
  // =========================================================================
  private buildOceanAndBeach() {
    const oceanGroup = new THREE.Group();

    // 1. Vast Turquoise Ocean Water Surface
    const waterGeo = new THREE.PlaneGeometry(3600, 4200, 32, 32);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0077be,
      roughness: 0.08,
      metalness: 0.85,
      transparent: true,
      opacity: 0.92
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(2400, -0.7, 2400);
    water.receiveShadow = true;
    oceanGroup.add(water);

    // 2. Golden Sand Shoreline Beach Strip
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

    // 3. Anchored White Luxury Yachts in Marina
    const yachtHullMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.2, metalness: 0.4 });
    const yachtSailMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide });

    for (let i = 0; i < 14; i++) {
      const yacht = new THREE.Group();
      const yx = 1600 + (i % 4) * 240 + Math.random() * 80;
      const yz = 1800 + Math.floor(i / 4) * 350 + Math.random() * 90;

      // Boat Hull
      const hullGeo = new THREE.BoxGeometry(6.5, 2.2, 18.0);
      const hull = new THREE.Mesh(hullGeo, yachtHullMat);
      hull.position.y = 0.4;
      yacht.add(hull);

      // Cabin
      const cabinGeo = new THREE.BoxGeometry(4.2, 1.8, 9.0);
      const cabin = new THREE.Mesh(cabinGeo, yachtHullMat);
      cabin.position.set(0, 2.1, -1.0);
      yacht.add(cabin);

      // Mast & Sail
      const mastGeo = new THREE.CylinderGeometry(0.12, 0.16, 16.0, 8);
      const mast = new THREE.Mesh(mastGeo, yachtHullMat);
      mast.position.set(0, 8.5, 1.0);
      yacht.add(mast);

      const sailGeo = new THREE.BufferGeometry();
      const sailVerts = new Float32Array([
        0, 1.5, 1.0,
        0, 15.5, 1.0,
        0, 2.0, 8.5
      ]);
      sailGeo.setAttribute('position', new THREE.BufferAttribute(sailVerts, 3));
      sailGeo.computeVertexNormals();
      const sail = new THREE.Mesh(sailGeo, yachtSailMat);
      yacht.add(sail);

      yacht.position.set(yx, -0.6, yz);
      yacht.rotation.y = (i * 0.4) + Math.random() * 0.3;
      oceanGroup.add(yacht);
    }

    this.trackGroup.add(oceanGroup);
  }

  // =========================================================================
  // DISTANT HORIZON MOUNTAINS: STRICT NON-CLIPPING GUARANTEE (> baseRadius + 180m)
  // =========================================================================
  private buildDistantMountains() {
    const mountainGroup = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x3d4046,
      roughness: 0.92,
      metalness: 0.08
    });
    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.75,
      metalness: 0.06
    });

    const numPeaks = 48;
    const centerX = -400;
    const centerZ = 2600;

    for (let i = 0; i < numPeaks; i++) {
      const angle = (i / numPeaks) * Math.PI * 2;
      const baseRadius = 280 + (i % 4) * 40;
      const peakHeight = 220 + (i % 6) * 35;

      // Distance from center: placed at 3,200m - 4,200m away
      const radius = 3300 + (i % 5) * 160 + (i % 3) * 100;
      const mx = centerX + Math.cos(angle) * radius;
      const mz = centerZ + Math.sin(angle) * radius;

      // STRICT SAFETY CONSTRAINT: Distance to ANY track point MUST be >= baseRadius + 180m!
      const { dist } = this.getClosestSplinePoint(mx, mz);
      if (dist < baseRadius + 180) {
        // Mountain would be too close to circuit: skip or push outwards!
        continue;
      }

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
      mountain.receiveShadow = true;
      mountainGroup.add(mountain);

      // Snow-capped peak summit
      const snowGeo = new THREE.ConeGeometry(baseRadius * 0.38, peakHeight * 0.38, 10, 2);
      const snowMesh = new THREE.Mesh(snowGeo, snowMat);
      snowMesh.position.set(mx, peakHeight * 0.74 - 10, mz);
      snowMesh.rotation.y = mountain.rotation.y;
      mountainGroup.add(snowMesh);
    }

    this.trackGroup.add(mountainGroup);
  }

  // =========================================================================
  // 4-LANE GRAND HIGHWAY: 18.5m Wide High-Speed Asphalt Ribbon
  // =========================================================================
  private buildRoad() {
    const numSteps = 2200; // High segment density along 12.5 KM track
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

    // Asphalt Base
    ctx.fillStyle = '#17191d';
    ctx.fillRect(0, 0, 1024, 1024);

    // Aggregate grain noise
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

    // Reflective Amber Cat's-Eye Road Studs along center line
    const studGeo = new THREE.BoxGeometry(0.14, 0.05, 0.24);
    const studMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    const studGroup = new THREE.Group();

    for (let t = 0; t <= 1.0; t += 0.0016) {
      const pt = this.splineCurve.getPoint(t);
      const tang = this.splineCurve.getTangent(t);
      const stud = new THREE.Mesh(studGeo, studMat);
      stud.position.set(pt.x, pt.y + 0.24, pt.z);
      stud.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tang);
      studGroup.add(stud);
    }
    this.trackGroup.add(studGroup);
  }

  // =========================================================================
  // NEON CYBER HIGHWAY TUNNEL: Sector 5 Mountain Cut (t = 0.52 to 0.61)
  // =========================================================================
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

    // Build arched tubular tunnel enclosure
    const tunnelPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = startT + (i / steps) * (endT - startT);
      const pt = this.splineCurve.getPoint(t);
      tunnelPoints.push(new THREE.Vector3(pt.x, pt.y + 4.2, pt.z));
    }

    const tunnelPath = new THREE.CatmullRomCurve3(tunnelPoints);
    const tunnelGeo = new THREE.TubeGeometry(tunnelPath, steps, 12.0, 14, false);
    const tunnelMesh = new THREE.Mesh(tunnelGeo, wallMat);
    tunnelGroup.add(tunnelMesh);

    // Overhead dual neon ceiling strip lights
    for (let i = 2; i < steps; i += 3) {
      const t = startT + (i / steps) * (endT - startT);
      const pt = this.splineCurve.getPoint(t);
      const tang = this.splineCurve.getTangent(t);
      const binorm = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0, 1, 0)).normalize();

      // Left Cyan Neon Tube
      const cyanLamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 3.8), cyanLightMat);
      cyanLamp.position.copy(pt).add(binorm.clone().multiplyScalar(4.5));
      cyanLamp.position.y += 7.8;
      cyanLamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tang);
      tunnelGroup.add(cyanLamp);

      // Right Amber Neon Tube
      const amberLamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 3.8), amberLightMat);
      amberLamp.position.copy(pt).add(binorm.clone().multiplyScalar(-4.5));
      amberLamp.position.y += 7.8;
      amberLamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tang);
      tunnelGroup.add(amberLamp);
    }

    // Heavy Reinforced Concrete Portals with Hazard Chevrons
    const portalMat = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.5 });
    for (const portalT of [startT, endT]) {
      const pt = this.splineCurve.getPoint(portalT);
      const tang = this.splineCurve.getTangent(portalT);
      const portal = new THREE.Group();
      portal.position.set(pt.x, pt.y + 4.2, pt.z);
      portal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tang);

      const arch = new THREE.Mesh(new THREE.TorusGeometry(12.2, 1.6, 8, 16, Math.PI), portalMat);
      arch.rotation.x = -Math.PI / 2;
      portal.add(arch);
      tunnelGroup.add(portal);
    }

    this.trackGroup.add(tunnelGroup);
  }

  // =========================================================================
  // HIGH VIADUCT SKY BRIDGE: Sector 4 Mountain Gorge Crossing (t = 0.42 to 0.49)
  // =========================================================================
  private buildViaductBridge() {
    const bridgeGroup = new THREE.Group();
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x5a6268,
      roughness: 0.85,
      metalness: 0.2
    });
    const cableMat = new THREE.MeshStandardMaterial({
      color: 0xdce1e9,
      roughness: 0.3,
      metalness: 0.9
    });

    const startT = 0.42;
    const endT = 0.49;
    const numPillars = 11;

    for (let i = 0; i < numPillars; i++) {
      const t = startT + (i / (numPillars - 1)) * (endT - startT);
      const pt = this.splineCurve.getPoint(t);

      // Deep concrete piers grounding elevated highway down to the gorge basin (y=0)
      const pillarHeight = Math.max(12.0, pt.y + 6.0);
      const pillarGeo = new THREE.BoxGeometry(3.2, pillarHeight, 3.2);

      const pL = new THREE.Mesh(pillarGeo, pillarMat);
      pL.position.set(pt.x - 8.5, pt.y - pillarHeight / 2, pt.z);
      pL.castShadow = true;

      const pR = new THREE.Mesh(pillarGeo, pillarMat);
      pR.position.set(pt.x + 8.5, pt.y - pillarHeight / 2, pt.z);
      pR.castShadow = true;

      // Heavy Cross-beam girder
      const girder = new THREE.Mesh(new THREE.BoxGeometry(22.0, 2.0, 3.8), pillarMat);
      girder.position.set(pt.x, pt.y - 1.0, pt.z);
      girder.castShadow = true;

      bridgeGroup.add(pL, pR, girder);

      // Suspension cable towers at mid-bridge
      if (i === 3 || i === 7) {
        const towerGeo = new THREE.CylinderGeometry(0.45, 0.65, 26.0, 10);
        const tL = new THREE.Mesh(towerGeo, cableMat);
        tL.position.set(pt.x - 9.2, pt.y + 13.0, pt.z);
        const tR = tL.clone();
        tR.position.x = pt.x + 9.2;
        bridgeGroup.add(tL, tR);
      }
    }

    this.trackGroup.add(bridgeGroup);
  }

  // =========================================================================
  // SPEEDWAY GRANDSTANDS & PIT COMPLEX: Sector 1 Motorsport Arena
  // =========================================================================
  private buildGrandstandComplex() {
    const standGroup = new THREE.Group();

    const standMat = new THREE.MeshStandardMaterial({ color: 0x2b303a, roughness: 0.7 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.5 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.4 });

    // Multi-tier spectator grandstands along the main straight (x = +17 to +26, z = 80 to 420)
    for (let s = 0; s < 4; s++) {
      const zPos = 110 + s * 85;
      const grandstand = new THREE.Group();

      // Tiered stepped concrete base
      for (let tier = 0; tier < 8; tier++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(10.0, 1.0, 75.0), standMat);
        step.position.set(tier * 1.3, tier * 1.0 + 0.5, 0);
        grandstand.add(step);

        // Seating blocks
        const seats = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 73.0), seatMat);
        seats.position.set(tier * 1.3, tier * 1.0 + 1.2, 0);
        grandstand.add(seats);
      }

      // Overhead cantilever roof canopy
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(16.0, 0.6, 78.0), canopyMat);
      canopy.position.set(4.5, 12.5, 0);
      canopy.rotation.z = -0.08;
      canopy.castShadow = true;
      grandstand.add(canopy);

      // Support pillars
      const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 12.0), standMat);
      pillarL.position.set(11.0, 6.0, 35.0);
      const pillarR = pillarL.clone();
      pillarR.position.z = -35.0;
      grandstand.add(pillarL, pillarR);

      grandstand.position.set(22.0, 0.0, zPos);
      standGroup.add(grandstand);
    }

    // Pit Wall on the left side of the straight
    const pitWallMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.6 });
    const pitWall = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 380.0), pitWallMat);
    pitWall.position.set(-11.5, 0.7, 240.0);
    pitWall.castShadow = true;
    standGroup.add(pitWall);

    this.trackGroup.add(standGroup);
  }

  // =========================================================================
  // ARMCO GALVANIZED CRASH BARRIERS: Continuous Protection along 12.5 KM Track
  // =========================================================================
  private buildArmcoGuardrails() {
    const numSteps = 1600;
    const roadWidth = 18.5;

    const railMat = new THREE.MeshStandardMaterial({
      color: 0xb0b8c2,
      metalness: 0.88,
      roughness: 0.28
    });

    const postMat = new THREE.MeshStandardMaterial({
      color: 0x3d352e,
      roughness: 0.95
    });

    const postGeo = new THREE.BoxGeometry(0.2, 1.0, 0.2);

    for (const side of [-1, 1]) {
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

  // =========================================================================
  // OVERHEAD GANTRY ARCHWAYS & HIGHWAY SIGNAGE
  // =========================================================================
  private buildTrackArchitecture() {
    // A. Start Line Gantry Archway at z = 60m straight
    const startPt = new THREE.Vector3(0, 0.22, 60);
    const startTang = new THREE.Vector3(0, 0, 1);

    const archGroup = new THREE.Group();
    archGroup.position.copy(startPt);
    archGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), startTang);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1f242d, metalness: 0.8, roughness: 0.3 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });

    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 7.6, 0.9), pillarMat);
    pillarL.position.set(-11.5, 3.8, 0);
    pillarL.castShadow = true;
    const pillarR = pillarL.clone();
    pillarR.position.x = 11.5;

    const crossbeam = new THREE.Mesh(new THREE.BoxGeometry(24.5, 1.8, 1.2), beamMat);
    crossbeam.position.set(0, 6.8, 0);
    crossbeam.castShadow = true;

    // Neon Race Banner
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 512;
    bannerCanvas.height = 128;
    const bctx = bannerCanvas.getContext('2d')!;
    bctx.fillStyle = '#0a0e17';
    bctx.fillRect(0, 0, 512, 128);
    bctx.fillStyle = '#00f2fe';
    bctx.font = 'bold 38px sans-serif';
    bctx.textAlign = 'center';
    bctx.fillText('APEX WORLD CIRCUIT • 12.5 KM', 256, 75);

    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(21.0, 1.4),
      new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide })
    );
    banner.rotation.y = Math.PI;
    banner.position.set(0, 6.8, -0.62);

    archGroup.add(pillarL, pillarR, crossbeam, banner);
    this.trackGroup.add(archGroup);

    // B. Highway Gantry Signs at t = 0.20, 0.40, 0.70
    for (const gantryT of [0.20, 0.40, 0.70]) {
      const pt = this.splineCurve.getPoint(gantryT);
      const tang = this.splineCurve.getTangent(gantryT);

      const gantry = new THREE.Group();
      gantry.position.copy(pt);
      gantry.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tang);

      const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 8.2, 12), pillarMat);
      pL.position.set(-11.5, 4.1, 0);
      const pR = pL.clone();
      pR.position.x = 11.5;

      const beam = new THREE.Mesh(new THREE.BoxGeometry(24.0, 0.45, 0.45), pillarMat);
      beam.position.set(0, 7.5, 0);

      const signBoard = new THREE.Mesh(
        new THREE.BoxGeometry(9.0, 2.8, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x007749, roughness: 0.4 })
      );
      signBoard.position.set(-3.5, 6.0, 0);

      gantry.add(pL, pR, beam, signBoard);
      this.trackGroup.add(gantry);
    }
  }

  // =========================================================================
  // REFLECTIVE HIGHWAY WARNING CHEVRONS (>>> / <<<)
  // =========================================================================
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
        ctx.moveTo(70, 40);
        ctx.lineTo(170, 128);
        ctx.lineTo(70, 216);
        ctx.lineTo(105, 216);
        ctx.lineTo(205, 128);
        ctx.lineTo(105, 40);
      } else {
        ctx.moveTo(186, 40);
        ctx.lineTo(86, 128);
        ctx.lineTo(186, 216);
        ctx.lineTo(151, 216);
        ctx.lineTo(51, 128);
        ctx.lineTo(151, 40);
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

    curveLocations.forEach(({ t, dir, count }) => {
      const mat = new THREE.MeshBasicMaterial({ map: dir === 1 ? rightTex : leftTex, side: THREE.DoubleSide });

      for (let j = 0; j < count; j++) {
        const signT = (t + j * 0.0035) % 1.0;
        const pt = this.splineCurve.getPoint(signT);
        const tang = this.splineCurve.getTangent(signT);
        const binorm = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0, 1, 0)).normalize();

        const sideOffset = -dir * 10.8;
        const pos = pt.clone().add(binorm.multiplyScalar(sideOffset));
        pos.y += 0.85;

        const signMesh = new THREE.Group();
        signMesh.position.copy(pos);

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

  // =========================================================================
  // RACETRACK BRAKING DISTANCE COUNTDOWN BOARDS (150m, 100m, 50m)
  // =========================================================================
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

  // =========================================================================
  // HIGHWAY TUBULAR STEEL STREETLIGHTS
  // =========================================================================
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

    const numLamps = 75;
    for (let i = 0; i < numLamps; i++) {
      const t = i / numLamps;
      const pt = this.splineCurve.getPoint(t);
      const tang = this.splineCurve.getTangent(t);
      const binorm = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0, 1, 0)).normalize();

      const side = (i % 2 === 0 ? 1 : -1);
      const pos = pt.clone().add(binorm.multiplyScalar(side * 11.2));
      pos.y = this.getNaturalTerrainElevation(pos.x, pos.z);

      const lamp = new THREE.Group();
      lamp.position.copy(pos);
      lamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tang);

      const pole = new THREE.Mesh(poleGeo, lampMat);
      pole.position.set(0, 5.25, 0);
      pole.castShadow = true;

      const arm = new THREE.Mesh(armGeo, lampMat);
      arm.position.set(-side * 2.0, 10.2, 0);
      arm.rotation.z = side * (Math.PI / 3);

      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(-side * 3.6, 11.0, 0);

      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(-side * 3.6, 10.85, 0);

      lamp.add(pole, arm, head, bulb);
      lampGroup.add(lamp);
    }

    this.trackGroup.add(lampGroup);
  }

  // =========================================================================
  // COASTAL LIGHTHOUSE TOWER (Sector 2 Marina Point)
  // =========================================================================
  private buildLighthouse() {
    const lighthouse = new THREE.Group();

    // Octagonal tapered masonry tower with red/white bands
    const towerGeo = new THREE.CylinderGeometry(3.5, 6.2, 38.0, 8);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.6 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.y = 19.0;
    tower.castShadow = true;
    lighthouse.add(tower);

    // Red bands
    const redBandMat = new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.5 });
    for (const by of [12.0, 24.0]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 4.0, 8), redBandMat);
      band.position.y = by;
      lighthouse.add(band);
    }

    // Lantern room & balcony gallery
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 1.2, 8), towerMat);
    gallery.position.y = 38.6;
    lighthouse.add(gallery);

    const lanternMat = new THREE.MeshBasicMaterial({ color: 0xfffaed });
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 4.2, 8), lanternMat);
    lantern.position.y = 41.2;
    lighthouse.add(lantern);

    // Rotating beacon beam
    const beaconGroup = new THREE.Group();
    beaconGroup.position.set(0, 41.2, 0);
    const beamGeo = new THREE.ConeGeometry(8.0, 120.0, 16);
    beamGeo.rotateX(Math.PI / 2);
    beamGeo.translate(0, 0, 60.0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff0aa,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beaconGroup.add(beam);
    lighthouse.add(beaconGroup);
    this.lighthouseBeacons.push(beaconGroup);

    // Placed on rocky coastal promontory at (1380, 0, 3100)
    lighthouse.position.set(1380, 0.0, 3100);
    this.trackGroup.add(lighthouse);
  }

  // =========================================================================
  // WIND TURBINE GENERATORS (Sector 6 Canyon Ridge)
  // =========================================================================
  private buildWindTurbines() {
    const turbineGroup = new THREE.Group();
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3, metalness: 0.5 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });

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

      // 45m Tower
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.8, 48.0, 12), towerMat);
      tower.position.y = 24.0;
      tower.castShadow = true;
      turbine.add(tower);

      // Nacelle generator
      const nacelle = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 6.5), towerMat);
      nacelle.position.set(0, 48.0, 0);
      turbine.add(nacelle);

      // Rotor Hub & 3 Aerodynamic Blades
      const rotorGroup = new THREE.Group();
      rotorGroup.position.set(0, 48.0, 3.4);

      const hub = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 12), towerMat);
      rotorGroup.add(hub);

      for (let b = 0; b < 3; b++) {
        const bladeArm = new THREE.Group();
        bladeArm.rotation.z = (b / 3) * Math.PI * 2;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.65, 18.0, 0.15), bladeMat);
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

  // =========================================================================
  // TREES & FOLIAGE: Biome-Matched Palm Trees, Pines, Redwoods & Oaks
  // STRICT SAFETY: Placed >= 14.5m away from road center (outside guardrails)
  // =========================================================================
  private buildTrees() {
    const oakTemplate = this.createOakTemplate();
    const pineTemplate = this.createPineTemplate();
    const palmTemplate = this.createPalmTemplate();
    const redwoodTemplate = this.createRedwoodTemplate();
    const treeGroup = new THREE.Group();

    const count = 520;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pt = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const side = (i % 2 === 0 ? 1 : -1) * (i % 3 === 0 ? -1 : 1);
      const distance = 14.8 + (i % 5) * 4.2 + Math.random() * 6.0;
      const treePos = pt.clone().add(binormal.multiplyScalar(side * distance));

      // STRICT SAFETY CONSTRAINT: Never place any tree within 14.0m of road center
      const { dist } = this.getClosestSplinePoint(treePos.x, treePos.z);
      if (dist < 14.0) continue;

      // Select Biome-Appropriate Tree
      let template = oakTemplate;
      if (t >= 0.10 && t <= 0.28) {
        // Coastal Riviera: Palm Trees
        template = palmTemplate;
      } else if (t >= 0.29 && t <= 0.50) {
        // Alpine Mountain Pass: Alpine Pines
        template = pineTemplate;
      } else if (t >= 0.74 && t <= 0.88) {
        // Redwood River Valley: Giant Redwoods
        template = redwoodTemplate;
      } else {
        template = (i % 2 === 0 ? oakTemplate : pineTemplate);
      }

      const groundY = this.getNaturalTerrainElevation(treePos.x, treePos.z);
      const tree = template.clone(true);
      const scale = 0.95 + (i % 4) * 0.12 + Math.random() * 0.18;
      tree.scale.set(scale, scale * (0.95 + Math.random() * 0.2), scale);
      tree.position.set(treePos.x, groundY, treePos.z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      treeGroup.add(tree);
    }

    this.trackGroup.add(treeGroup);
  }

  // European Oak Template
  private createOakTemplate(): THREE.Group {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.95 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.58, 8.5, 12), trunkMat);
    trunk.position.y = 4.25;
    trunk.castShadow = true;
    group.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6024, roughness: 0.82 });
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(3.6, 1), leafMat);
    crown.position.y = 8.8;
    crown.castShadow = true;
    group.add(crown);

    const crownTop = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 1), leafMat);
    crownTop.position.set(0.8, 10.8, -0.6);
    crownTop.castShadow = true;
    group.add(crownTop);

    return group;
  }

  // Alpine Pine / Douglas Fir Template
  private createPineTemplate(): THREE.Group {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x241710, roughness: 0.96 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.44, 13.0, 10), trunkMat);
    trunk.position.y = 6.5;
    trunk.castShadow = true;
    group.add(trunk);

    const needleMat = new THREE.MeshStandardMaterial({ color: 0x1d4423, roughness: 0.84 });
    const tiers = [
      { y: 5.2, r: 3.5, h: 2.8 },
      { y: 7.2, r: 3.0, h: 2.6 },
      { y: 9.0, r: 2.4, h: 2.3 },
      { y: 10.6, r: 1.8, h: 2.0 },
      { y: 12.0, r: 1.2, h: 1.6 }
    ];

    tiers.forEach((t) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 8), needleMat);
      cone.position.y = t.y;
      cone.castShadow = true;
      group.add(cone);
    });

    return group;
  }

  // Coastal Riviera Palm Tree Template
  private createPalmTemplate(): THREE.Group {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6c584c, roughness: 0.9 });

    // Curved segmented palm trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.45, 11.0, 8), trunkMat);
    trunk.position.set(0.6, 5.5, 0);
    trunk.rotation.z = -0.12;
    trunk.castShadow = true;
    group.add(trunk);

    // Radiating green palm fronds
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x38b000, roughness: 0.6, side: THREE.DoubleSide });
    for (let f = 0; f < 7; f++) {
      const angle = (f / 7) * Math.PI * 2;
      const frondGeo = new THREE.BoxGeometry(0.4, 0.08, 4.2);
      frondGeo.translate(0, 0, 2.1);
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.position.set(1.2, 11.2, 0);
      frond.rotation.y = angle;
      frond.rotation.x = 0.38;
      frond.castShadow = true;
      group.add(frond);
    }

    return group;
  }

  // Giant Redwood Sequoia Template (24m Tall)
  private createRedwoodTemplate(): THREE.Group {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x582f0e, roughness: 0.95 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 1.1, 24.0, 10), trunkMat);
    trunk.position.y = 12.0;
    trunk.castShadow = true;
    group.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1e3f20, roughness: 0.8 });
    const tiers = [
      { y: 12.0, r: 4.8, h: 4.0 },
      { y: 15.5, r: 4.0, h: 3.6 },
      { y: 18.5, r: 3.2, h: 3.2 },
      { y: 21.2, r: 2.2, h: 2.6 },
      { y: 23.4, r: 1.2, h: 2.0 }
    ];

    tiers.forEach((t) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 8), leafMat);
      cone.position.y = t.y;
      cone.castShadow = true;
      group.add(cone);
    });

    return group;
  }

  // =========================================================================
  // ROADSIDE BOULDERS: STRICTLY OUTSIDE THE GUARDRAIL (dist >= 16.5m)
  // =========================================================================
  private buildRoadsideBoulders() {
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x495057,
      roughness: 0.94,
      metalness: 0.05
    });

    const rockGroup = new THREE.Group();
    const numRocks = 70;

    for (let i = 0; i < numRocks; i++) {
      const t = (i / numRocks);
      const pt = this.splineCurve.getPoint(t);
      const tangent = this.splineCurve.getTangent(t);
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const side = (i % 2 === 0 ? 1 : -1);
      // STRICT SAFETY: Placed at least 16.5m from road centerline (well clear of guardrails)
      const dist = 16.5 + Math.random() * 14.0;
      const rockPos = pt.clone().add(binormal.multiplyScalar(side * dist));

      const rockScale = 1.6 + Math.random() * 2.8;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rockScale, 1), rockMat);
      const groundY = this.getNaturalTerrainElevation(rockPos.x, rockPos.z);
      // Firmly embedded in soil
      rock.position.set(rockPos.x, groundY + rockScale * 0.35, rockPos.z);
      rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      rock.castShadow = true;
      rockGroup.add(rock);
    }

    this.trackGroup.add(rockGroup);
  }

  // =========================================================================
  // STUNT JUMP RAMPS: Placed in Dedicated Right Lane (Players Can Jump or Bypass)
  // =========================================================================
  private buildJumpRamps() {
    // Jump ramp on the mountain crest at turn 12 (t = 0.38)
    const rampT = 0.38;
    const rampPoint = this.splineCurve.getPoint(rampT);
    const tangent = this.splineCurve.getTangent(rampT);
    const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

    const rampGroup = new THREE.Group();
    // Offset to right lane (+4.5m) so drivers can choose whether to launch or pass cleanly
    const rampPos = rampPoint.clone().add(binormal.multiplyScalar(-4.5));
    rampGroup.position.set(rampPos.x, rampPos.y + 0.22, rampPos.z);
    rampGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

    const rampWidth = 6.2;
    const rampLength = 9.5;
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
      position: new THREE.Vector3(rampPos.x, rampPos.y + 0.22, rampPos.z),
      width: rampWidth,
      length: rampLength,
      height: rampHeight
    });
  }

  // =========================================================================
  // ANIMATION TICK: Wind Turbines & Lighthouse Beacon
  // =========================================================================
  public update(delta: number) {
    // Spin wind turbine propellors
    for (const blades of this.windTurbineBlades) {
      blades.rotation.z += delta * 1.6;
    }

    // Rotate lighthouse light beam
    for (const beacon of this.lighthouseBeacons) {
      beacon.rotation.y += delta * 1.2;
    }
  }

  public getRoadCenterAtZ(z: number): { x: number; y: number } {
    const { point } = this.getClosestSplinePoint(0, z);
    return { x: point.x, y: point.y };
  }

  // Exact ground height query for vehicle physics
  public getElevationAt(x: number, z: number): number {
    const { point, dist } = this.getClosestSplinePoint(x, z);

    for (const ramp of this.ramps) {
      const d = ramp.position.distanceTo(new THREE.Vector3(x, ramp.position.y, z));
      if (d < ramp.length * 0.6 && Math.abs(x - ramp.position.x) < ramp.width / 2) {
        return ramp.position.y + ramp.height;
      }
    }

    if (dist < 9.5) {
      // Direct asphalt road surface height
      return point.y + 0.22;
    } else if (dist < 13.5) {
      // Soft transition from asphalt curb edge to ground
      const t = (dist - 9.5) / 4.0;
      return (point.y + 0.22) * (1 - t) + (point.y - 0.05) * t;
    } else {
      return this.getNaturalTerrainElevation(x, z);
    }
  }
}
