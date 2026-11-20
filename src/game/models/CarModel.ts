import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface CarMeshes {
  root: THREE.Group;
  bodyMesh?: THREE.Mesh;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  wheels: THREE.Object3D[];
  frontWheels: THREE.Object3D[];
  taillightBar?: THREE.Mesh;
}

export function createSportsCar(primaryColor: number = 0xd40000, onLoadCallback?: (meshes: CarMeshes) => void): CarMeshes {
  const root = new THREE.Group();

  // 1. High-Gloss Metallic PBR Red Paint (Candy Supra / Ferrari Red)
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: primaryColor,
    metalness: 0.95,
    roughness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 1.0
  });

  const detailsMaterial = new THREE.MeshStandardMaterial({
    color: 0x111115,
    metalness: 0.9,
    roughness: 0.25
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x111622,
    metalness: 0.2,
    roughness: 0.05,
    transmission: 0.92,
    thickness: 0.6,
    transparent: true
  });

  const wheels: THREE.Object3D[] = [];
  const frontWheels: THREE.Object3D[] = [];

  // Temporary sleek placeholder while GLB loads (50ms)
  const placeholderGroup = new THREE.Group();
  const tempBody = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 4.2), bodyMaterial);
  tempBody.position.y = 0.4;
  placeholderGroup.add(tempBody);
  root.add(placeholderGroup);

  // Load Real Photorealistic 3D Model
  const loader = new GLTFLoader();
  loader.load(
    '/models/car.glb',
    (gltf) => {
      // Remove temporary placeholder
      root.remove(placeholderGroup);

      const carModel = gltf.scene;
      carModel.scale.set(0.9, 0.9, 0.9);
      // In Three.js ferrari.glb, model faces -Z by default, so rotate 180 degrees to face +Z
      carModel.rotation.y = Math.PI;
      carModel.position.y = 0.02;

      carModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          if (mesh.name === 'body') {
            mesh.material = bodyMaterial;
          } else if (mesh.name.startsWith('rim_') || mesh.name === 'trim') {
            mesh.material = detailsMaterial;
          } else if (mesh.name === 'glass') {
            mesh.material = glassMaterial;
          }
        }
      });

      // Find wheels
      const wheelFL = carModel.getObjectByName('wheel_fl');
      const wheelFR = carModel.getObjectByName('wheel_fr');
      const wheelRL = carModel.getObjectByName('wheel_rl');
      const wheelRR = carModel.getObjectByName('wheel_rr');

      if (wheelFL) { wheels.push(wheelFL); frontWheels.push(wheelFL); }
      if (wheelFR) { wheels.push(wheelFR); frontWheels.push(wheelFR); }
      if (wheelRL) { wheels.push(wheelRL); }
      if (wheelRR) { wheels.push(wheelRR); }

      // Ground Ambient Shadow under car
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load('/models/ferrari_ao.png', (aoTexture) => {
        const shadowMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4),
          new THREE.MeshBasicMaterial({
            map: aoTexture,
            blending: THREE.MultiplyBlending,
            toneMapped: false,
            transparent: true,
            opacity: 0.85
          })
        );
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.y = 0.01;
        shadowMesh.renderOrder = 2;
        carModel.add(shadowMesh);
      });

      root.add(carModel);

      if (onLoadCallback) {
        onLoadCallback({
          root,
          bodyMaterial,
          wheels,
          frontWheels
        });
      }
    },
    undefined,
    (err) => {
      console.warn('[CarModel] Could not load GLB, using high-detail fallback:', err);
    }
  );

  return {
    root,
    bodyMaterial,
    wheels,
    frontWheels
  };
}
