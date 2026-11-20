import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { SuperCarConfig, SUPER_CARS } from '../../types';

export interface CarMeshes {
  root: THREE.Group;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  wheels: THREE.Object3D[];
  frontWheels: THREE.Object3D[];
  carConfig: SuperCarConfig;
  applyDamageVisuals: (health: number) => void;
}

// Global cached GLTF model to avoid re-fetching
let cachedGltfScene: THREE.Group | null = null;
let gltfLoadingPromise: Promise<THREE.Group> | null = null;

function loadFerrariGltf(): Promise<THREE.Group> {
  if (cachedGltfScene) {
    return Promise.resolve(cachedGltfScene);
  }
  if (gltfLoadingPromise) {
    return gltfLoadingPromise;
  }

  gltfLoadingPromise = new Promise((resolve, reject) => {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    dracoLoader.setDecoderConfig({ type: 'js' });

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      '/models/car.glb',
      (gltf) => {
        const model = gltf.scene.children[0] || gltf.scene;
        cachedGltfScene = model as THREE.Group;
        console.log('[CarModel] Successfully loaded high-poly Ferrari 458 GLTF model with Draco');
        resolve(cachedGltfScene);
      },
      undefined,
      (err) => {
        console.error('[CarModel] Failed to load car.glb:', err);
        reject(err);
      }
    );
  });

  return gltfLoadingPromise;
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

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: carConfig.accentColorHex,
    metalness: 0.92,
    roughness: 0.18
  });

  const carbonMaterial = new THREE.MeshStandardMaterial({
    color: 0x18181c,
    metalness: 0.85,
    roughness: 0.35
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0a1018,
    metalness: 0.1,
    roughness: 0.04,
    transmission: 0.92,
    thickness: 0.65,
    transparent: true,
    opacity: 0.85
  });

  const wheels: THREE.Object3D[] = [];
  const frontWheels: THREE.Object3D[] = [];

  let frontSplitterRef: THREE.Mesh | null = null;
  let rearWingRef: THREE.Group | null = null;

  // Placeholder while GLB initializes
  const placeholder = buildHighDetailProceduralCar(carConfig, bodyMaterial, carbonMaterial, glassMaterial, wheels, frontWheels);
  root.add(placeholder);

  // Apply Realtime Visible Damage
  const applyDamageVisuals = (health: number) => {
    const damagePercent = Math.max(0, Math.min(100, health));
    const damageFactor = (100 - damagePercent) / 100; // 0.0 (pristine) to 1.0 (wrecked)

    // 1. Body paint scratches and dulling
    bodyMaterial.roughness = 0.12 + damageFactor * 0.45;
    bodyMaterial.clearcoat = Math.max(0.2, 1.0 - damageFactor * 0.8);

    // 2. Physical Front Splitter Droop from collisions
    if (frontSplitterRef) {
      frontSplitterRef.rotation.x = -damageFactor * 0.18;
      frontSplitterRef.position.y = 0.12 - damageFactor * 0.08;
    }

    // 3. Rear GT Wing Tilt / Looseness from impacts
    if (rearWingRef) {
      rearWingRef.rotation.z = (Math.sin(damageFactor * 5) * 0.08) * damageFactor;
      rearWingRef.rotation.x = -0.12 - damageFactor * 0.15;
    }
  };

  // Load and apply authentic high-poly 3D sports car model
  loadFerrariGltf()
    .then((baseModel) => {
      const carModel = baseModel.clone(true);
      carModel.scale.set(0.95, 0.95, 0.95);
      carModel.rotation.y = Math.PI; // Face forward along +Z axis
      carModel.position.set(0, 0, 0);

      // Tailored materials per car
      carModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          if (mesh.name === 'body') {
            mesh.material = bodyMaterial;
          } else if (mesh.name.startsWith('rim_')) {
            mesh.material = rimMaterial;
          } else if (mesh.name === 'trim') {
            mesh.material = carbonMaterial;
          } else if (mesh.name === 'glass') {
            mesh.material = glassMaterial;
          }
        }
      });

      // Ground Ambient Occlusion Shadow
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load('/models/ferrari_ao.png', (aoTexture) => {
        const shadowMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4),
          new THREE.MeshBasicMaterial({
            map: aoTexture,
            blending: THREE.MultiplyBlending,
            toneMapped: false,
            transparent: true,
            opacity: 0.82
          })
        );
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.y = 0.015;
        shadowMesh.renderOrder = 2;
        carModel.add(shadowMesh);
      });

      // Find GLB wheels
      const wheelFL = carModel.getObjectByName('wheel_fl');
      const wheelFR = carModel.getObjectByName('wheel_fr');
      const wheelRL = carModel.getObjectByName('wheel_rl');
      const wheelRR = carModel.getObjectByName('wheel_rr');

      if (wheelFL && wheelFR && wheelRL && wheelRR) {
        wheels.length = 0;
        frontWheels.length = 0;
        wheels.push(wheelFL, wheelFR, wheelRL, wheelRR);
        frontWheels.push(wheelFL, wheelFR);
      }

      // Add Custom Aerodynamic GT Wings
      const aero = attachCustomAero(carModel, carConfig, carbonMaterial, bodyMaterial);
      frontSplitterRef = aero.splitter;
      rearWingRef = aero.wing;

      // Swap out placeholder with authentic 3D car model
      root.remove(placeholder);
      root.add(carModel);

      onLoadCallback?.({
        root,
        bodyMaterial,
        wheels,
        frontWheels,
        carConfig,
        applyDamageVisuals
      });
    })
    .catch((err) => {
      console.warn('[CarModel] Fallback to procedural sports car:', err);
      onLoadCallback?.({
        root,
        bodyMaterial,
        wheels,
        frontWheels,
        carConfig,
        applyDamageVisuals
      });
    });

  return {
    root,
    bodyMaterial,
    wheels,
    frontWheels,
    carConfig,
    applyDamageVisuals
  };
}

// Attaches distinct aerodynamic packages (GT3 swan-neck wings, hypercar splitters)
function attachCustomAero(
  carModel: THREE.Object3D,
  config: SuperCarConfig,
  carbonMat: THREE.Material,
  bodyMat: THREE.Material
): { wing: THREE.Group | null; splitter: THREE.Mesh | null } {
  let wingGroup: THREE.Group | null = null;
  let splitter: THREE.Mesh | null = null;

  if (config.id === 'raptor' || config.id === 'spark' || config.id === 'titan' || config.id === 'apex') {
    wingGroup = new THREE.Group();

    const wingY = config.id === 'spark' ? 1.05 : config.id === 'titan' ? 1.15 : 0.98;
    const wingWidth = config.id === 'titan' ? 1.95 : 1.82;
    const wingZ = 1.85;

    // Carbon fiber main blade
    const bladeGeo = new THREE.BoxGeometry(wingWidth, 0.04, 0.35);
    const blade = new THREE.Mesh(bladeGeo, carbonMat);
    blade.position.set(0, wingY, wingZ);
    blade.rotation.x = -0.12;
    blade.castShadow = true;
    wingGroup.add(blade);

    // Endplates
    const endplateGeo = new THREE.BoxGeometry(0.02, 0.28, 0.42);
    const endplateL = new THREE.Mesh(endplateGeo, config.id === 'spark' ? bodyMat : carbonMat);
    endplateL.position.set(-wingWidth / 2, wingY, wingZ);
    endplateL.castShadow = true;
    const endplateR = endplateL.clone();
    endplateR.position.x = wingWidth / 2;
    wingGroup.add(endplateL, endplateR);

    // Swan-neck upright mounts
    const stalkGeo = new THREE.BoxGeometry(0.04, 0.42, 0.12);
    const stalkL = new THREE.Mesh(stalkGeo, carbonMat);
    stalkL.position.set(-0.45, wingY - 0.2, wingZ - 0.05);
    stalkL.castShadow = true;
    const stalkR = stalkL.clone();
    stalkR.position.x = 0.45;
    wingGroup.add(stalkL, stalkR);

    carModel.add(wingGroup);
  }

  // Front splitter
  if (config.id === 'titan' || config.id === 'spark' || config.id === 'raptor') {
    splitter = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.04, 0.35),
      carbonMat
    );
    splitter.position.set(0, 0.12, -2.15);
    splitter.castShadow = true;
    carModel.add(splitter);
  }

  return { wing: wingGroup, splitter };
}

// Procedural fallback
function buildHighDetailProceduralCar(
  config: SuperCarConfig,
  bodyMat: THREE.Material,
  carbonMat: THREE.Material,
  glassMat: THREE.Material,
  wheels: THREE.Object3D[],
  frontWheels: THREE.Object3D[]
): THREE.Group {
  const car = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(1.9, 0.45, 4.3);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 0.35;
  bodyMesh.castShadow = true;
  car.add(bodyMesh);

  const cabinGeo = new THREE.SphereGeometry(1.0, 16, 12);
  cabinGeo.scale(0.72, 0.45, 1.3);
  const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
  cabinMesh.position.set(0, 0.68, -0.2);
  cabinMesh.castShadow = true;
  car.add(cabinMesh);

  const wheelPositions = [
    { x: -0.92, y: 0.34, z: 1.35, isFront: true },
    { x: 0.92, y: 0.34, z: 1.35, isFront: true },
    { x: -0.96, y: 0.35, z: -1.35, isFront: false },
    { x: 0.96, y: 0.35, z: -1.35, isFront: false }
  ];

  const tireMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: config.accentColorHex, metalness: 0.9, roughness: 0.2 });

  wheelPositions.forEach((pos) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(pos.x, pos.y, pos.z);

    const radius = 0.34;
    const width = 0.28;

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 24), tireMat);
    tire.rotateZ(Math.PI / 2);
    tire.castShadow = true;
    wheelGroup.add(tire);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, width * 1.02, 16), rimMat);
    rim.rotateZ(Math.PI / 2);
    wheelGroup.add(rim);

    car.add(wheelGroup);
    wheels.push(wheelGroup);
    if (pos.isFront) {
      frontWheels.push(wheelGroup);
    }
  });

  return car;
}
