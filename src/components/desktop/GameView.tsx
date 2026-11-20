import React, { useState, useEffect, useRef } from 'react';
import { GameEngine } from '../../game/core/Engine';
import { HUDOverlay } from '../../game/ui/HUDOverlay';
import { WebRTCHost } from '../../services/webrtc';
import { ControllerInput, VehicleTelemetry } from '../../types';
import QRCode from 'qrcode';
import { QrCode, X, Wifi } from 'lucide-react';

interface GameViewProps {
  roomId: string;
  onExit?: () => void;
}

export const GameView: React.FC<GameViewProps> = ({ roomId, onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const hostRef = useRef<WebRTCHost | null>(null);

  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isPhoneConnected, setIsPhoneConnected] = useState<boolean>(false);
  const [ping, setPing] = useState<number>(0);
  const [activeInputSource, setActiveInputSource] = useState<'gyro' | 'keyboard'>('keyboard');

  const [inputState, setInputState] = useState<ControllerInput>({
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

  const [telemetry, setTelemetry] = useState<VehicleTelemetry>({
    speedKmh: 0,
    rpm: 850,
    gear: 1,
    nitroFuel: 100,
    isDrifting: false,
    driftScore: 0,
    isAirborne: false,
    isJumping: false,
    health: 100
  });

  const [isLetterboxed, setIsLetterboxed] = useState<boolean>(false);

  // Generate QR Code
  useEffect(() => {
    const controllerUrl = `${window.location.origin}/?mode=controller&room=${roomId}`;
    QRCode.toDataURL(controllerUrl, {
      width: 220,
      margin: 2,
      color: { dark: '#00F2FE', light: '#08090C' }
    }).then(setQrDataUrl);
  }, [roomId]);

  // WebRTC Host Listener
  useEffect(() => {
    const host = new WebRTCHost(roomId);
    hostRef.current = host;

    host.init(
      (incomingInput) => {
        setInputState(incomingInput);
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

  // Keyboard Listeners
  useEffect(() => {
    const keys: Record<string, boolean> = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      updateKeyboard();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
      updateKeyboard();
    };

    const updateKeyboard = () => {
      let steer = 0;
      if (keys['KeyA'] || keys['ArrowLeft']) steer -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) steer += 1;

      let throttle = 0;
      if (keys['KeyW'] || keys['ArrowUp']) throttle = 1;

      let brake = 0;
      if (keys['KeyS'] || keys['ArrowDown']) brake = 1;

      const handbrake = !!keys['Space'];
      const nitro = !!(keys['ShiftLeft'] || keys['ShiftRight']);
      const cameraSwitch = !!keys['KeyC'];
      const reset = !!keys['KeyR'];

      if (steer !== 0 || throttle !== 0 || brake !== 0 || handbrake || nitro || cameraSwitch || reset) {
        setActiveInputSource('keyboard');
        setInputState({
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

  // Three.js Game Loop
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;

    let lastTime = performance.now();
    let animationFrameId: number;

    const gameLoop = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(gameLoop);

      const delta = Math.min(0.05, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      // Update Engine & Physics
      const currentTelemetry = engine.update(delta, inputState);
      setTelemetry(currentTelemetry);
      setIsLetterboxed(engine.isLetterboxed);

      // Send telemetry back to connected mobile phone
      hostRef.current?.sendFeedback({
        speedKmh: currentTelemetry.speedKmh,
        gear: currentTelemetry.gear,
        rpm: currentTelemetry.rpm
      });
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    const handleResize = () => engine.handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      engine.dispose();
    };
  }, [inputState]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0c12]">
      {/* 3D WebGL Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Modern In-Game Racing HUD */}
      <HUDOverlay
        telemetry={telemetry}
        input={inputState}
        isLetterboxed={isLetterboxed}
        activeInputSource={activeInputSource}
        ping={ping}
      />

      {/* Floating Gyro Connect Button (Top Left) */}
      <div className="absolute top-4 left-4 z-40">
        <button
          onClick={() => setIsQrModalOpen(true)}
          className="flex items-center space-x-2 glass-panel px-3 py-2 rounded-xl border border-cyan-500/30 text-xs font-bold font-racing uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/20 active:scale-95 transition-all pointer-events-auto"
        >
          <QrCode className="w-4 h-4 text-cyan-400" />
          <span>{isPhoneConnected ? 'Gyro Connected' : 'Connect Phone Gyro'}</span>
        </button>
      </div>

      {/* QR Code Connect Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-cyan-500/40 max-w-sm w-full text-white text-center font-racing relative shadow-2xl shadow-cyan-950/50">
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-display font-bold text-cyan-300 mb-1">
              PAIR GYRO WHEEL
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Scan with your smartphone camera to steer your car with real-time physical tilt!
            </p>

            <div className="bg-[#08090C] p-3 rounded-xl border border-cyan-500/20 flex items-center justify-center mb-4">
              {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 rounded" />}
            </div>

            <div className="flex items-center justify-center space-x-2 text-xs font-mono text-gray-300 mb-4">
              <span className={`w-2 h-2 rounded-full ${isPhoneConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{isPhoneConnected ? 'CONNECTED & SYNCED' : 'AWAITING SCAN'}</span>
            </div>

            <button
              onClick={() => setIsQrModalOpen(false)}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-bold uppercase text-xs tracking-wider"
            >
              RESUME RACING
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
