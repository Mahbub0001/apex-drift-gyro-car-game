import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { createSportsCar, CarMeshes } from '../../game/models/CarModel';
import { SuperCarConfig } from '../../types';
import { RotateCw, Move3d, Flame } from 'lucide-react';

interface CarPreview3DProps {
  car: SuperCarConfig;
  isRevving?: boolean;
  onRevClick?: () => void;
  className?: string;
  showControls?: boolean;
  controlsAlign?: 'top-right' | 'bottom-right';
  controlsClassName?: string;
  targetOffsetX?: number;
  cameraDistanceScale?: number;
}

type CameraAnglePreset = 'hero' | 'side' | 'rear';

export const CarPreview3D: React.FC<CarPreview3DProps> = ({
  car,
  isRevving = false,
  onRevClick,
  className = '',
  showControls = true,
  controlsAlign = 'top-right',
  controlsClassName,
  targetOffsetX = 0,
  cameraDistanceScale = 1.0
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [autoSpin, setAutoSpin] = useState<boolean>(true);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);

  const isRevvingRef = useRef<boolean>(isRevving);
  const autoSpinRef = useRef<boolean>(autoSpin);
  const carMeshesRef = useRef<CarMeshes | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
  const flamesRef = useRef<THREE.Group | null>(null);
  const currentCarIdRef = useRef<string>(car.id);
  const userInteractedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    isRevvingRef.current = isRevving;
  }, [isRevving]);

  useEffect(() => {
    autoSpinRef.current = autoSpin;
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoSpin;
    }
  }, [autoSpin]);

  // Attach rear exhaust rev flames onto active car root cleanly
  const attachFlamesToCar = (carRoot: THREE.Group) => {
    const flameGroup = new THREE.Group();
    const outerGeo = new THREE.ConeGeometry(0.11, 0.72, 12);
    outerGeo.rotateX(-Math.PI / 2);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const coreGeo = new THREE.ConeGeometry(0.055, 0.45, 10);
    coreGeo.rotateX(-Math.PI / 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xff9e00,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const fl = new THREE.Mesh(outerGeo, outerMat);
    fl.position.set(-0.14, 0.28, -2.32);
    const fr = new THREE.Mesh(outerGeo, outerMat);
    fr.position.set(0.14, 0.28, -2.32);
    const cl = new THREE.Mesh(coreGeo, coreMat);
    cl.position.set(-0.14, 0.28, -2.22);
    const cr = new THREE.Mesh(coreGeo, coreMat);
    cr.position.set(0.14, 0.28, -2.22);

    flameGroup.add(fl, fr, cl, cr);
    flameGroup.visible = false;
    carRoot.add(flameGroup);
    flamesRef.current = flameGroup;
  };

  // Initialize Three.js Studio Stage once
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let isDisposed = false;
    const w = container.clientWidth || 640;
    const h = container.clientHeight || 360;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a12);
    scene.fog = new THREE.Fog(0x070a12, 9, 24);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 60);
    camera.position.set(
      3.2 * cameraDistanceScale + targetOffsetX,
      1.48 * Math.max(1, cameraDistanceScale * 0.92),
      3.85 * cameraDistanceScale
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const controls = new OrbitControls(camera, canvas);
    controls.target.set(targetOffsetX, 0.48, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 2.9;
    controls.maxDistance = 9.0;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI * 0.46;
    controls.autoRotate = autoSpinRef.current;
    controls.autoRotateSpeed = 1.25;
    controlsRef.current = controls;

    // Pause auto-spin while user drags/zooms so it never fights manual inspection
    controls.addEventListener('start', () => {
      controls.autoRotate = false;
      if (userInteractedTimerRef.current) {
        clearTimeout(userInteractedTimerRef.current);
      }
    });
    controls.addEventListener('end', () => {
      if (userInteractedTimerRef.current) {
        clearTimeout(userInteractedTimerRef.current);
      }
      userInteractedTimerRef.current = window.setTimeout(() => {
        if (!isDisposed && autoSpinRef.current) {
          controls.autoRotate = true;
        }
      }, 2800);
    });

    // Studio HDR Reflections
    let envTex: THREE.Texture | null = null;
    new RGBELoader().load(
      '/textures/env.hdr',
      (texture) => {
        if (isDisposed) {
          texture.dispose();
          return;
        }
        texture.mapping = THREE.EquirectangularReflectionMapping;
        envTex = texture;
        scene.environment = texture;
      },
      undefined,
      () => {}
    );

    // 3-Point Studio Lighting
    const ambient = new THREE.AmbientLight(0xdbeafe, 0.75);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(car.bodyColorHex, 1.8);
    rimLight.position.set(-5, 3.5, -4);
    scene.add(rimLight);
    rimLightRef.current = rimLight;

    const cyanFill = new THREE.DirectionalLight(0x00f2fe, 0.9);
    cyanFill.position.set(4, 2, -5);
    scene.add(cyanFill);

    // Brushed Metallic Turntable Floor & Neon Rim Ring
    const floorGeo = new THREE.PlaneGeometry(36, 36);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d16,
      roughness: 0.42,
      metalness: 0.75
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    scene.add(floor);

    const plinthGeo = new THREE.CylinderGeometry(2.85, 3.05, 0.08, 64);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x111624,
      roughness: 0.25,
      metalness: 0.9
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = 0.04;
    plinth.receiveShadow = true;
    scene.add(plinth);

    const ringGeo = new THREE.TorusGeometry(2.86, 0.022, 12, 72);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: car.bodyColorHex });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.082;
    scene.add(ring);
    ringMatRef.current = ringMat;

    // Load Hero 3D Car
    currentCarIdRef.current = car.id;
    const initialMeshes = createSportsCar(car, (loaded) => {
      if (isDisposed) return;
      carMeshesRef.current = loaded;
      attachFlamesToCar(loaded.root);
      setModelLoaded(true);
    });
    initialMeshes.root.position.y = 0.08;
    carMeshesRef.current = initialMeshes;
    attachFlamesToCar(initialMeshes.root);
    scene.add(initialMeshes.root);

    // Responsive sizing via ResizeObserver
    const ro = new ResizeObserver((entries) => {
      if (isDisposed || !entries[0]) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    });
    ro.observe(container);

    let rafId = 0;
    const animate = () => {
      if (isDisposed) return;
      rafId = requestAnimationFrame(animate);

      const meshes = carMeshesRef.current;
      if (meshes) {
        if (isRevvingRef.current) {
          const t = performance.now() * 0.045;
          meshes.root.position.y = 0.08 + Math.sin(t * 1.3) * 0.006;
          meshes.root.rotation.z = Math.sin(t) * 0.014;
          meshes.root.rotation.x = -0.018 + Math.cos(t * 1.7) * 0.005;
          if (flamesRef.current) {
            flamesRef.current.visible = true;
            const s = 0.8 + Math.random() * 0.7;
            flamesRef.current.scale.set(1, 1, s);
          }
        } else {
          meshes.root.position.y = 0.08;
          meshes.root.rotation.set(0, 0, 0);
          if (flamesRef.current) {
            flamesRef.current.visible = false;
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      if (userInteractedTimerRef.current) clearTimeout(userInteractedTimerRef.current);
      controls.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      plinthGeo.dispose();
      plinthMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      envTex?.dispose();
      renderer.dispose();
    };
  }, []);

  // Dynamically update car model (if id changed) or live custom paint tint (if only color changed!)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (ringMatRef.current) {
      ringMatRef.current.color.setHex(car.bodyColorHex);
    }
    if (rimLightRef.current) {
      rimLightRef.current.color.setHex(car.bodyColorHex);
    }

    if (currentCarIdRef.current !== car.id) {
      currentCarIdRef.current = car.id;
      if (carMeshesRef.current) {
        scene.remove(carMeshesRef.current.root);
      }
      const nextMeshes = createSportsCar(car, (loaded) => {
        carMeshesRef.current = loaded;
        attachFlamesToCar(loaded.root);
        setModelLoaded(true);
      });
      nextMeshes.root.position.y = 0.08;
      carMeshesRef.current = nextMeshes;
      attachFlamesToCar(nextMeshes.root);
      scene.add(nextMeshes.root);
    } else if (carMeshesRef.current) {
      // Instant zero-flicker paint color swap!
      carMeshesRef.current.bodyMaterial.color.setHex(car.bodyColorHex);
    }
  }, [car]);

  const setCameraPreset = (preset: CameraAnglePreset) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (preset === 'hero') {
      camera.position.set(
        3.2 * cameraDistanceScale + targetOffsetX,
        1.48 * Math.max(1, cameraDistanceScale * 0.92),
        3.85 * cameraDistanceScale
      );
    } else if (preset === 'side') {
      camera.position.set(4.9 * cameraDistanceScale + targetOffsetX, 1.15, 0.05);
    } else {
      camera.position.set(-2.9 * cameraDistanceScale + targetOffsetX, 1.52, -4.0 * cameraDistanceScale);
    }
    controls.target.set(targetOffsetX, 0.48, 0);
    controls.update();
  };

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.target.set(targetOffsetX, 0.48, 0);
    controls.update();
  }, [targetOffsetX]);

  const resolvedControlsClass =
    controlsClassName || (controlsAlign === 'bottom-right' ? 'bottom-3 right-3' : 'top-3 right-3');

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing touch-none ${className}`}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Loading Indicator */}
      {!modelLoaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs font-mono uppercase tracking-widest text-[#00E5FF] animate-pulse bg-[#090A0D]/80 px-3 py-1.5 rounded-lg border border-white/15">
            Loading 3D Chassis...
          </span>
        </div>
      )}

      {/* Interactive HUD Hints & Quick Angles */}
      {showControls && (
        <>
          <div
            className={`hidden sm:flex absolute ${controlsClassName ? 'bottom-12 left-5 lg:bottom-14 lg:left-8' : 'bottom-3 left-3'} items-center space-x-1.5 px-2.5 py-1 rounded-md bg-[#090A0D]/75 backdrop-blur-md border border-white/15 pointer-events-none`}
          >
            <Move3d className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span className="text-[11px] font-racing text-gray-200">
              Drag to orbit 360° • Scroll to zoom
            </span>
          </div>

          <div
            className={`absolute ${resolvedControlsClass} flex items-center space-x-1.5`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {(['hero', 'side', 'rear'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCameraPreset(preset);
                }}
                className="px-2.5 py-1 rounded-md bg-[#12141A]/85 hover:bg-[#1e232e] border border-white/15 text-[11px] font-racing font-semibold text-gray-200 hover:text-[#00E5FF] transition-colors"
              >
                {preset === 'hero' ? 'Front' : preset === 'side' ? 'Side' : 'Rear'}
              </button>
            ))}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAutoSpin((prev) => !prev);
              }}
              aria-label="Toggle 360 Auto Spin"
              title="Toggle Auto-Rotate"
              className={`p-1.5 rounded-md border transition-colors ${
                autoSpin
                  ? 'bg-[#00E5FF]/15 border-[#00E5FF]/50 text-[#00E5FF]'
                  : 'bg-[#12141A]/85 border-white/15 text-gray-400 hover:text-white'
              }`}
            >
              <RotateCw className={`w-3.5 h-3.5 ${autoSpin ? 'animate-spin-slow' : ''}`} />
            </button>

            {onRevClick && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRevClick();
                }}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md border text-[11px] font-racing font-bold transition-all ${
                  isRevving
                    ? 'bg-[#FF3B30] border-[#FF3B30] text-white'
                    : 'bg-[#F5A623]/15 hover:bg-[#F5A623]/25 border-[#F5A623]/50 text-[#F5A623]'
                }`}
              >
                <Flame className="w-3 h-3" />
                <span>Rev</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
