import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SuperCarConfig, SUPER_CARS } from '../../types';

export interface CarMeshes {
  root: THREE.Group;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  wheels: THREE.Object3D[];
  frontWheels: THREE.Object3D[];
  carConfig: SuperCarConfig;
}

export function createSportsCar(
  carConfig: SuperCarConfig = SUPER_CARS[0],
  onLoadCallback?: (meshes: CarMeshes) => void
): CarMeshes {
  const root = new THREE.Group();

  // 1. Photorealistic Multi-Coat Metallic PBR Car Paint
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: carConfig.bodyColorHex,
    metalness: 0.92,
    roughness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 1.0
  });

  const carbonMaterial = new THREE.MeshStandardMaterial({
    color: carConfig.accentColorHex,
    metalness: 0.85,
    roughness: 0.3
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0c1018,
    metalness: 0.15,
    roughness: 0.05,
    transmission: 0.9,
    thickness: 0.7,
    transparent: true
  });

  const wheels: THREE.Object3D[] = [];
  const frontWheels: THREE.Object3D[] = [];

  // 2. High-Detail Sculpted Aerodynamic Hypercar Silhouette
  // Built with authentic curved surfaces and widebody aerodynamics
  const aeroBody = buildProceduralHypercar(carConfig, bodyMaterial, carbonMaterial, glassMaterial, wheels, frontWheels);
  root.add(aeroBody);

  // 3. Load Official GLB Mesh Overlay if available
  const loader = new GLTFLoader();
  loader.load(
    '/models/car.glb',
    (gltf) => {
      // If GLB loaded successfully, integrate high-detail body
      const carModel = gltf.scene.children[0] || gltf.scene;
      carModel.scale.set(0.92, 0.92, 0.92);
      carModel.rotation.y = Math.PI;
      carModel.position.set(0, 0.02, 0);

      carModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          if (mesh.name === 'body') {
            mesh.material = bodyMaterial;
          } else if (mesh.name.startsWith('rim_') || mesh.name === 'trim') {
            mesh.material = carbonMaterial;
          } else if (mesh.name === 'glass') {
            mesh.material = glassMaterial;
          }
        }
      });

      // Ground Ambient Shadow Texture
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load('/models/ferrari_ao.png', (aoTexture) => {
        const shadowMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4),
          new THREE.MeshBasicMaterial({
            map: aoTexture,
            blending: THREE.MultiplyBlending,
            toneMapped: false,
            transparent: true,
            opacity: 0.8
          })
        );
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.y = 0.01;
        shadowMesh.renderOrder = 2;
        carModel.add(shadowMesh);
      });

      // Find GLB wheels
      const wheelFL = carModel.getObjectByName('wheel_fl');
      const wheelFR = carModel.getObjectByName('wheel_fr');
      const wheelRL = carModel.getObjectByName('wheel_rl');
      const wheelRR = carModel.getObjectByName('wheel_rr');

      if (wheelFL && wheelFR && wheelRL && wheelRR) {
        // Swap to GLB wheels
        wheels.length = 0;
        frontWheels.length = 0;
        wheels.push(wheelFL, wheelFR, wheelRL, wheelRR);
        frontWheels.push(wheelFL, wheelFR);
      }

      root.remove(aeroBody);
      root.add(carModel);

      onLoadCallback?.({
        root,
        bodyMaterial,
        wheels,
        frontWheels,
        carConfig
      });
    },
    undefined,
    () => {
      // Keep high-detail procedural hypercar
      onLoadCallback?.({
        root,
        bodyMaterial,
        wheels,
        frontWheels,
        carConfig
      });
    }
  );

  return {
    root,
    bodyMaterial,
    wheels,
    frontWheels,
    carConfig
  };
}

// Builds an authentic, low-slung, aggressive Track Hypercar
function buildProceduralHypercar(
  config: SuperCarConfig,
  bodyMat: THREE.Material,
  carbonMat: THREE.Material,
  glassMat: THREE.Material,
  wheels: THREE.Object3D[],
  frontWheels: THREE.Object3D[]
): THREE.Group {
  const car = new THREE.Group();

  // 1. Lower Monocoque Chassis
  const lowerGeo = new THREE.BoxGeometry(1.85, 0.42, 4.3);
  const lowerMesh = new THREE.Mesh(lowerGeo, bodyMat);
  lowerMesh.position.y = 0.32;
  lowerMesh.castShadow = true;
  car.add(lowerMesh);

  // 2. Sculpted Wedge Nose & Hood
  const hoodGeo = new THREE.ConeGeometry(1.8, 1.6, 4);
  hoodGeo.rotateX(-Math.PI / 2);
  hoodGeo.rotateY(Math.PI / 4);
  const hoodMesh = new THREE.Mesh(hoodGeo, bodyMat);
  hoodMesh.scale.set(0.98, 0.22, 0.95);
  hoodMesh.position.set(0, 0.42, 1.35);
  hoodMesh.castShadow = true;
  car.add(hoodMesh);

  // 3. Aerodynamic Teardrop Cockpit Canopy
  const cabinGeo = new THREE.SphereGeometry(1.0, 16, 12);
  cabinGeo.scale(0.68, 0.45, 1.25);
  const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
  cabinMesh.position.set(0, 0.65, -0.2);
  cabinMesh.castShadow = true;
  car.add(cabinMesh);

  // 4. Aggressive Carbon Fiber Front Splitter & Canards
  const splitterGeo = new THREE.BoxGeometry(1.95, 0.06, 0.75);
  const splitter = new THREE.Mesh(splitterGeo, carbonMat);
  splitter.position.set(0, 0.14, 2.2);
  car.add(splitter);

  // 5. Widebody Flared Wheel Arches
  const fenderMat = config.id === 'titan' ? carbonMat : bodyMat;
  const fenderGeo = new THREE.BoxGeometry(0.18, 0.4, 1.1);

  const fenderFL = new THREE.Mesh(fenderGeo, fenderMat);
  fenderFL.position.set(-0.95, 0.38, 1.35);
  const fenderFR = fenderFL.clone();
  fenderFR.position.x = 0.95;

  const fenderRL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, 1.2), fenderMat);
  fenderRL.position.set(-0.98, 0.42, -1.35);
  const fenderRR = fenderRL.clone();
  fenderRR.position.x = 0.98;

  car.add(fenderFL, fenderFR, fenderRL, fenderRR);

  // 6. GT Rear Wing & Carbon Endplates
  const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.05, 0.4), carbonMat);
  wingBlade.position.set(0, 1.12, -2.1);
  wingBlade.castShadow = true;

  const wingStalkL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.18), carbonMat);
  wingStalkL.position.set(-0.55, 0.9, -2.05);
  const wingStalkR = wingStalkL.clone();
  wingStalkR.position.x = 0.55;

  car.add(wingBlade, wingStalkL, wingStalkR);

  // 7. Aggressive LED DRL Headlights (Slanted Angel Eyes)
  const headMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
  const lightGeo = new THREE.BoxGeometry(0.38, 0.06, 0.05);
  const headL = new THREE.Mesh(lightGeo, headMat);
  headL.position.set(-0.64, 0.38, 2.16);
  headL.rotation.z = -0.15;
  const headR = headL.clone();
  headR.position.x = 0.64;
  headR.rotation.z = 0.15;
  car.add(headL, headR);

  // 8. Taillight Lightbar
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.05, 0.05), tailMat);
  tailBar.position.set(0, 0.48, -2.16);
  car.add(tailBar);

  // 9. Wheels & Brakes
  const wheelPositions = [
    { x: -0.92, y: 0.32, z: 1.35, isFront: true },
    { x: 0.92, y: 0.32, z: 1.35, isFront: true },
    { x: -0.96, y: 0.34, z: -1.35, isFront: false },
    { x: 0.96, y: 0.34, z: -1.35, isFront: false }
  ];

  const tireMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: config.accentColorHex, metalness: 0.9, roughness: 0.2 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: 0xff1100, roughness: 0.3 });

  wheelPositions.forEach((pos) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(pos.x, pos.y, pos.z);

    const radius = pos.isFront ? 0.33 : 0.35;
    const width = pos.isFront ? 0.28 : 0.34;

    // Tire
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 24), tireMat);
    tire.rotateZ(Math.PI / 2);
    tire.castShadow = true;
    wheelGroup.add(tire);

    // Rim Spoke Ring
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.75, radius * 0.75, width * 1.02, 16), rimMat);
    rim.rotateZ(Math.PI / 2);
    wheelGroup.add(rim);

    // Red Brembo Brake Caliper
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.06, radius * 0.32, 0.12), caliperMat);
    caliper.position.set(pos.x > 0 ? -0.06 : 0.06, radius * 0.2, 0);
    wheelGroup.add(caliper);

    car.add(wheelGroup);
    wheels.push(wheelGroup);
    if (pos.isFront) {
      frontWheels.push(wheelGroup);
    }
  });

  return car;
}
