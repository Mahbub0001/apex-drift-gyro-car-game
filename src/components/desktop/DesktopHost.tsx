import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import * as THREE from 'three';
import { WebRTCHost } from '../../services/webrtc';
import { ControllerInput } from '../../types';
import { Smartphone, QrCode, Keyboard, Gamepad2, Wifi, Zap, Compass, CheckCircle2 } from 'lucide-react';

interface DesktopHostProps {
  roomId: string;
  onLaunchGame?: () => void;
}

export const DesktopHost: React.FC<DesktopHostProps> = ({ roomId, onLaunchGame }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isPhoneConnected, setIsPhoneConnected] = useState<boolean>(false);
  const [ping, setPing] = useState<number>(0);
  const [currentInput, setCurrentInput] = useState<ControllerInput>({
    steer: 0,
    throttle: 0,
    brake: 0,
    handbrake: false,
    nitro: false,
    reset: false,
    cameraSwitch: false,
    angleDegrees: 0,
    timestamp: Date.now()
  });

  const [activeInputSource, setActiveInputSource] = useState<'gyro' | 'keyboard'>('keyboard');
  const hostRef = useRef<WebRTCHost | null>(null);
  const threeCanvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; carChassis: THREE.Group } | null>(null);

  // Generate QR Code with mobile controller URL
  useEffect(() => {
    // Generate URL based on current host/IP
    const currentOrigin = window.location.origin;
    const controllerUrl = `${currentOrigin}/?mode=controller&room=${roomId}`;

    QRCode.toDataURL(controllerUrl, {
      width: 260,
      margin: 2,
      color: {
        dark: '#00F2FE',
        light: '#08090C'
      }
    }).then(setQrDataUrl);
  }, [roomId]);

  // Initialize WebRTC Host
  useEffect(() => {
    const host = new WebRTCHost(roomId);
    hostRef.current = host;

    host.init(
      (input) => {
        setCurrentInput(input);
        setActiveInputSource('gyro');
      },
      (connected) => {
        setIsPhoneConnected(connected);
      }
    );

    const pingTimer = setInterval(() => {
      setPing(host.pingMs);
    }, 500);

    return () => {
      clearInterval(pingTimer);
      host.destroy();
    };
  }, [roomId]);

  // Keyboard Fallback Input Listener
  useEffect(() => {
    const keysPressed: Record<string, boolean> = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed[e.code] = true;
      updateKeyboardInput();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.code] = false;
      updateKeyboardInput();
    };

    const updateKeyboardInput = () => {
      let steer = 0;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) steer -= 1;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) steer += 1;

      let throttle = 0;
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) throttle = 1;

      let brake = 0;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) brake = 1;

      const handbrake = !!keysPressed['Space'];
      const nitro = !!(keysPressed['ShiftLeft'] || keysPressed['ShiftRight']);
      const cameraSwitch = !!keysPressed['KeyC'];
      const reset = !!keysPressed['KeyR'];

      // If keyboard is being pressed, update input
      if (steer !== 0 || throttle !== 0 || brake !== 0 || handbrake || nitro || cameraSwitch || reset) {
        setActiveInputSource('keyboard');
        setCurrentInput({
          steer,
          throttle,
          brake,
          handbrake,
          nitro,
          reset,
          cameraSwitch,
          angleDegrees: Math.round(steer * 45),
          timestamp: Date.now()
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Three.js 3D Test Vehicle Chassis Preview
  useEffect(() => {
    if (!threeCanvasRef.current) return;

    const canvas = threeCanvasRef.current;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0e14);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2.8, 5.2);
    camera.lookAt(0, 0.4, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0x00f2fe, 2.5);
    sun.position.set(5, 10, 7);
    scene.add(sun);

    const backRim = new THREE.DirectionalLight(0x8a2be2, 3.0);
    backRim.position.set(-5, 4, -6);
    scene.add(backRim);

    // Grid Floor
    const grid = new THREE.GridHelper(10, 20, 0x00f2fe, 0x1f2833);
    grid.position.y = -0.5;
    scene.add(grid);

    // Car Chassis Model
    const carGroup = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(1.6, 0.45, 3.6);
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x00f2fe,
      metalness: 0.9,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.2;
    carGroup.add(bodyMesh);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(1.2, 0.4, 1.8);
    const cabinMat = new THREE.MeshPhysicalMaterial({
      color: 0x08090c,
      metalness: 0.2,
      roughness: 0.1,
      transmission: 0.8,
      thickness: 0.5
    });
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(0, 0.55, -0.2);
    carGroup.add(cabinMesh);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 24);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });

    const wheelFL = new THREE.Mesh(wheelGeo, wheelMat);
    wheelFL.position.set(-0.85, 0, 1.1);
    const wheelFR = new THREE.Mesh(wheelGeo, wheelMat);
    wheelFR.position.set(0.85, 0, 1.1);
    const wheelRL = new THREE.Mesh(wheelGeo, wheelMat);
    wheelRL.position.set(-0.85, 0, -1.1);
    const wheelRR = new THREE.Mesh(wheelGeo, wheelMat);
    wheelRR.position.set(0.85, 0, -1.1);

    carGroup.add(wheelFL, wheelFR, wheelRL, wheelRR);

    // Headlights (Emissive)
    const lightGeo = new THREE.BoxGeometry(0.3, 0.08, 0.05);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    const lightL = new THREE.Mesh(lightGeo, lightMat);
    lightL.position.set(-0.55, 0.25, 1.81);
    const lightR = new THREE.Mesh(lightGeo, lightMat);
    lightR.position.set(0.55, 0.25, 1.81);
    carGroup.add(lightL, lightR);

    // Taillights
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.05), tailMat);
    tailBar.position.set(0, 0.3, -1.81);
    carGroup.add(tailBar);

    scene.add(carGroup);
    sceneRef.current = { scene, camera, renderer, carChassis: carGroup };

    let reqId: number;
    const animate = () => {
      reqId = requestAnimationFrame(animate);

      // Smoothly tilt car chassis based on current steering and throttle
      if (carGroup) {
        // Roll when steering
        const targetRoll = -currentInput.steer * 0.25;
        carGroup.rotation.z += (targetRoll - carGroup.rotation.z) * 0.1;

        // Yaw angle
        const targetYaw = -currentInput.steer * 0.45;
        carGroup.rotation.y += (targetYaw - carGroup.rotation.y) * 0.1;

        // Pitch when accelerating or braking
        const targetPitch = (currentInput.throttle * 0.08) - (currentInput.brake * 0.15);
        carGroup.rotation.x += (targetPitch - carGroup.rotation.x) * 0.1;

        // Turn front wheels
        wheelFL.rotation.y = -currentInput.steer * 0.55;
        wheelFR.rotation.y = -currentInput.steer * 0.55;

        // Nitro pulse color effect
        if (currentInput.nitro) {
          bodyMat.color.setHex(0x8a2be2);
        } else {
          bodyMat.color.setHex(0x00f2fe);
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [currentInput]);

  return (
    <div className="w-full max-w-6xl mx-auto p-6 font-racing text-white">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-center justify-between glass-panel p-5 rounded-2xl border border-white/10 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
              APEX DRIFT
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
              PHASE 1 COMPLETE
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Zero-Install Mobile Gyroscope Wheel Bridge & Telemetry Engine
          </p>
        </div>

        {/* Room Code Badge */}
        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <div className="glass-panel px-4 py-2 rounded-xl border border-cyan-500/30 flex items-center space-x-3">
            <span className="text-xs text-gray-400 uppercase font-bold">ROOM CODE:</span>
            <span className="text-xl font-display font-bold text-cyan-300 tracking-wider">
              {roomId}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className={`w-3 h-3 rounded-full ${isPhoneConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-xs uppercase font-bold text-gray-300">
              {isPhoneConnected ? `PHONE CONNECTED (${ping}ms)` : 'AWAITING PHONE SCAN'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: QR Pairing on Left, 3D Real-time Telemetry on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: QR Scan Card */}
        <div className="lg:col-span-5 flex flex-col justify-between glass-panel p-6 rounded-2xl border border-white/10">
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <QrCode className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-display font-bold uppercase text-white">
                Scan With Mobile Camera
              </h2>
            </div>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              No app store install required. Scan this code with any iPhone or Android camera to instantly transform your phone into a low-latency 60Hz Gyroscope Wheel.
            </p>

            {/* QR Code Container */}
            <div className="bg-[#08090C] p-4 rounded-xl border border-cyan-500/30 flex items-center justify-center my-4 shadow-xl shadow-cyan-950/30">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Apex Drift Controller QR" className="rounded-lg w-56 h-56" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-gray-500">
                  Generating QR...
                </div>
              )}
            </div>
          </div>

          {/* Quick Direct Link button */}
          <div className="pt-2">
            <a
              href={`/?mode=controller&room=${roomId}`}
              target="_blank"
              rel="noreferrer"
              className="w-full block text-center py-2.5 bg-white/10 hover:bg-white/20 active:scale-98 rounded-xl text-xs font-bold text-cyan-300 uppercase tracking-wider transition-all border border-cyan-500/30"
            >
              Open Controller In New Tab (Demo)
            </a>
          </div>
        </div>

        {/* Right Column: 3D Vehicle Preview & Telemetry HUD */}
        <div className="lg:col-span-7 flex flex-col glass-panel p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Compass className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-display font-bold uppercase text-white">
                Real-Time Telemetry & Input Visualizer
              </h2>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className={`px-2 py-0.5 rounded font-bold uppercase ${activeInputSource === 'gyro' ? 'bg-purple-600 text-white' : 'bg-cyan-600 text-white'}`}>
                Active: {activeInputSource}
              </span>
            </div>
          </div>

          {/* Three.js 3D Test Canvas */}
          <div className="w-full h-64 rounded-xl overflow-hidden relative border border-white/10 mb-4">
            <canvas ref={threeCanvasRef} className="w-full h-full block" />
            <div className="absolute bottom-2 left-3 text-[11px] text-gray-400 font-mono bg-black/60 px-2 py-1 rounded">
              Rotate phone or press A/D to steer • W/S for gas/brake
            </div>
          </div>

          {/* Live Telemetry Gauges Grid */}
          <div className="grid grid-cols-4 gap-3">
            {/* Steering */}
            <div className="glass-panel p-3 rounded-xl border border-white/10 text-center">
              <span className="text-[10px] text-gray-400 uppercase font-bold">STEER</span>
              <div className="text-xl font-display font-bold text-cyan-400 mt-1">
                {currentInput.angleDegrees}°
              </div>
              <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                {currentInput.steer.toFixed(2)}
              </div>
            </div>

            {/* Throttle */}
            <div className="glass-panel p-3 rounded-xl border border-white/10 text-center">
              <span className="text-[10px] text-gray-400 uppercase font-bold">GAS</span>
              <div className="text-xl font-display font-bold text-emerald-400 mt-1">
                {Math.round(currentInput.throttle * 100)}%
              </div>
              <div className="w-full bg-white/10 h-1 rounded mt-1.5 overflow-hidden">
                <div className="bg-emerald-400 h-full transition-all" style={{ width: `${currentInput.throttle * 100}%` }} />
              </div>
            </div>

            {/* Brake */}
            <div className="glass-panel p-3 rounded-xl border border-white/10 text-center">
              <span className="text-[10px] text-gray-400 uppercase font-bold">BRAKE</span>
              <div className="text-xl font-display font-bold text-rose-400 mt-1">
                {Math.round(currentInput.brake * 100)}%
              </div>
              <div className="w-full bg-white/10 h-1 rounded mt-1.5 overflow-hidden">
                <div className="bg-rose-400 h-full transition-all" style={{ width: `${currentInput.brake * 100}%` }} />
              </div>
            </div>

            {/* Nitro & Drift */}
            <div className="glass-panel p-3 rounded-xl border border-white/10 text-center">
              <span className="text-[10px] text-gray-400 uppercase font-bold">NITRO / E-BRAKE</span>
              <div className="flex items-center justify-center space-x-1 mt-1.5">
                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${currentInput.nitro ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-500'}`}>
                  NITRO
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${currentInput.handbrake ? 'bg-rose-600 text-white' : 'bg-white/10 text-gray-500'}`}>
                  DRIFT
                </span>
              </div>
            </div>
          </div>

          {/* Launch Game CTA */}
          <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              Ready to drive on the scenic highway?
            </div>
            <button
              onClick={onLaunchGame}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-display font-bold text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-500/25 transition-all transform active:scale-95 flex items-center space-x-2"
            >
              <span>LAUNCH RACING TRACK</span>
              <Zap className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
