import * as THREE from 'three';

export interface CarMeshes {
  root: THREE.Group;
  bodyMesh: THREE.Mesh;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  wheels: THREE.Group[];
  calipers: THREE.Mesh[];
  headlights: THREE.Mesh[];
  taillightBar: THREE.Mesh;
}

export function createSportsCar(primaryColor: number = 0x00f2fe): CarMeshes {
  const root = new THREE.Group();

  // 1. High-Gloss Metallic PBR Paint Material
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: primaryColor,
    metalness: 0.9,
    roughness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 1.0
  });

  const carbonMaterial = new THREE.MeshStandardMaterial({
    color: 0x15161b,
    roughness: 0.4,
    metalness: 0.6
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x050608,
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.85,
    thickness: 0.8,
    transparent: true
  });

  // Main Chassis (Lower Body)
  const lowerBodyGeo = new THREE.BoxGeometry(1.75, 0.45, 4.2);
  const bodyMesh = new THREE.Mesh(lowerBodyGeo, bodyMaterial);
  bodyMesh.position.y = 0.35;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  root.add(bodyMesh);

  // Aerodynamic Hood Slope (Wedge)
  const hoodGeo = new THREE.ConeGeometry(1.7, 1.4, 4);
  hoodGeo.rotateX(-Math.PI / 2);
  hoodGeo.rotateY(Math.PI / 4);
  const hoodMesh = new THREE.Mesh(hoodGeo, bodyMaterial);
  hoodMesh.scale.set(0.98, 0.22, 1.0);
  hoodMesh.position.set(0, 0.46, 1.25);
  hoodMesh.castShadow = true;
  root.add(hoodMesh);

  // Cabin / Greenhouse (Curved Roof & Pillars)
  const cabinGeo = new THREE.BoxGeometry(1.35, 0.45, 2.0);
  const cabinMesh = new THREE.Mesh(cabinGeo, glassMaterial);
  cabinMesh.position.set(0, 0.75, -0.2);
  cabinMesh.castShadow = true;
  root.add(cabinMesh);

  // Roof Shell (Painted Top)
  const roofGeo = new THREE.BoxGeometry(1.28, 0.06, 1.4);
  const roofMesh = new THREE.Mesh(roofGeo, bodyMaterial);
  roofMesh.position.set(0, 0.98, -0.2);
  roofMesh.castShadow = true;
  root.add(roofMesh);

  // Front Aerodynamic Splitter (Carbon Fiber)
  const splitterGeo = new THREE.BoxGeometry(1.85, 0.06, 0.6);
  const splitterMesh = new THREE.Mesh(splitterGeo, carbonMaterial);
  splitterMesh.position.set(0, 0.15, 2.15);
  root.add(splitterMesh);

  // Side Skirts
  const skirtL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.8), carbonMaterial);
  skirtL.position.set(-0.92, 0.18, 0);
  const skirtR = skirtL.clone();
  skirtR.position.x = 0.92;
  root.add(skirtL, skirtR);

  // Rear Diffuser
  const diffuserGeo = new THREE.BoxGeometry(1.7, 0.25, 0.4);
  const diffuserMesh = new THREE.Mesh(diffuserGeo, carbonMaterial);
  diffuserMesh.position.set(0, 0.25, -2.15);
  root.add(diffuserMesh);

  // Dual Exhaust Tips (Chrome Cylinders)
  const exhaustGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.3, 16);
  exhaustGeo.rotateX(Math.PI / 2);
  const exhaustMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.1 });
  const exhaustL = new THREE.Mesh(exhaustGeo, exhaustMat);
  exhaustL.position.set(-0.45, 0.22, -2.25);
  const exhaustR = exhaustL.clone();
  exhaustR.position.x = 0.45;
  root.add(exhaustL, exhaustR);

  // GT Rear Wing / Spoiler
  const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.06, 0.35), carbonMaterial);
  wingBlade.position.set(0, 1.05, -2.05);
  wingBlade.castShadow = true;

  const wingStalkL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.15), carbonMaterial);
  wingStalkL.position.set(-0.55, 0.85, -2.05);
  const wingStalkR = wingStalkL.clone();
  wingStalkR.position.x = 0.55;

  root.add(wingBlade, wingStalkL, wingStalkR);

  // Wheels & Brakes Assembly
  const wheels: THREE.Group[] = [];
  const calipers: THREE.Mesh[] = [];

  const wheelPositions = [
    { x: -0.92, y: 0.32, z: 1.35, isFront: true },  // Front Left
    { x: 0.92, y: 0.32, z: 1.35, isFront: true },   // Front Right
    { x: -0.95, y: 0.34, z: -1.35, isFront: false }, // Rear Left
    { x: 0.95, y: 0.34, z: -1.35, isFront: false }  // Rear Right
  ];

  const tireMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.85, metalness: 0.1 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x222226, metalness: 0.9, roughness: 0.25 });
  const discMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.95, roughness: 0.15 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: 0xff0044, roughness: 0.3 });

  wheelPositions.forEach((pos) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(pos.x, pos.y, pos.z);

    // Tire
    const tireRadius = pos.isFront ? 0.33 : 0.35;
    const tireWidth = pos.isFront ? 0.26 : 0.32;
    const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 24);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMesh = new THREE.Mesh(tireGeo, tireMat);
    tireMesh.castShadow = true;
    wheelGroup.add(tireMesh);

    // Rim Spoke Ring
    const rimGeo = new THREE.CylinderGeometry(tireRadius * 0.72, tireRadius * 0.72, tireWidth * 1.02, 16);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    wheelGroup.add(rimMesh);

    // Brake Rotor / Disc
    const discGeo = new THREE.CylinderGeometry(tireRadius * 0.58, tireRadius * 0.58, 0.04, 20);
    discGeo.rotateZ(Math.PI / 2);
    const discMesh = new THREE.Mesh(discGeo, discMat);
    wheelGroup.add(discMesh);

    // Red Brembo-style Brake Caliper
    const caliperGeo = new THREE.BoxGeometry(0.06, tireRadius * 0.32, 0.12);
    const caliperMesh = new THREE.Mesh(caliperGeo, caliperMat);
    caliperMesh.position.set(pos.x > 0 ? -0.06 : 0.06, tireRadius * 0.22, 0);
    wheelGroup.add(caliperMesh);
    calipers.push(caliperMesh);

    root.add(wheelGroup);
    wheels.push(wheelGroup);
  });

  // High-Intensity Headlights
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
  const lightGeo = new THREE.BoxGeometry(0.35, 0.08, 0.05);
  const headL = new THREE.Mesh(lightGeo, headlightMat);
  headL.position.set(-0.62, 0.42, 2.11);
  const headR = headL.clone();
  headR.position.x = 0.62;
  root.add(headL, headR);

  // Spotlights projecting road beams
  const spotL = new THREE.SpotLight(0x00f2fe, 4.0, 45, Math.PI / 6, 0.4);
  spotL.position.set(-0.62, 0.42, 2.11);
  spotL.target.position.set(-0.62, 0, 15);
  root.add(spotL, spotL.target);

  const spotR = new THREE.SpotLight(0x00f2fe, 4.0, 45, Math.PI / 6, 0.4);
  spotR.position.set(0.62, 0.42, 2.11);
  spotR.target.position.set(0.62, 0, 15);
  root.add(spotR, spotR.target);

  // Rear LED Taillight Bar
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
  const taillightBar = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.07, 0.05), tailMat);
  taillightBar.position.set(0, 0.52, -2.12);
  root.add(taillightBar);

  return {
    root,
    bodyMesh,
    bodyMaterial,
    wheels,
    calipers,
    headlights: [headL, headR],
    taillightBar
  };
}
