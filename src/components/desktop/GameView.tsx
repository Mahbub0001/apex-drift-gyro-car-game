import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GameEngine } from '../../game/core/Engine';
import { HUDOverlay } from '../../game/ui/HUDOverlay';
import { SoundEngine } from '../../game/audio/SoundEngine';
import { WebRTCHost } from '../../services/webrtc';
import { MultiplayerRoomManager } from '../../services/multiplayer';
import { ControllerInput, VehicleTelemetry, TrafficCarState, RemotePlayerState, SuperCarConfig, SUPER_CARS } from '../../types';
import QRCode from 'qrcode';
import { QrCode, X, Users, Globe, Volume2, VolumeX, Warehouse } from 'lucide-react';

interface GameViewProps {
  roomId: string;
  onExit?: () => void;
  selectedCar?: SuperCarConfig;
  onOpenGarage?: () => void;
}

export const GameView: React.FC<GameViewProps> = ({
  roomId,
  onExit,
  selectedCar = SUPER_CARS[0],
  onOpenGarage
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const hostRef = useRef<WebRTCHost | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  const mpManagerRef = useRef<MultiplayerRoomManager | null>(null);

  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isMpModalOpen, setIsMpModalOpen] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isPhoneConnected, setIsPhoneConnected] = useState<boolean>(false);
  const [ping, setPing] = useState<number>(0);
  const [activeInputSource, setActiveInputSource] = useState<'gyro' | 'keyboard'>('keyboard');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Multiplayer Room State
  const [mpRoomCode, setMpRoomCode] = useState<string>(roomId);
  const [isMpHost, setIsMpHost] = useState<boolean>(true);
  const [isMpConnected, setIsMpConnected] = useState<boolean>(false);
  const [opponents, setOpponents] = useState<RemotePlayerState[]>([]);

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

  const [playerPos, setPlayerPos] = useState<THREE.Vector3>(new THREE.Vector3(0, 0.45, 10));
  const [playerHeading, setPlayerHeading] = useState<number>(0);
  const [trafficStates, setTrafficStates] = useState<TrafficCarState[]>([]);
  const [isLetterboxed, setIsLetterboxed] = useState<boolean>(false);
  const [nearMissActive, setNearMissActive] = useState<boolean>(false);

  // Initialize Sound Engine
  useEffect(() => {
    const sound = new SoundEngine();
    soundRef.current = sound;
    return () => {
      sound.dispose();
    };
  }, []);

  const toggleSound = () => {
    if (soundRef.current) {
      soundRef.current.init();
      const muted = soundRef.current.toggleMute();
      setIsMuted(muted);
    }
  };

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
        soundRef.current?.init();
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

  // Connect to Multiplayer Room
  const startMultiplayer = (asHost: boolean) => {
    setIsMpHost(asHost);
    const mp = new MultiplayerRoomManager(mpRoomCode);
    mpManagerRef.current = mp;

    mp.init(asHost, {
      onPlayerJoined: () => {
        setOpponents(mp.getOpponentsList());
      },
      onPlayerLeft: () => {
        setOpponents(mp.getOpponentsList());
      },
      onPlayerUpdate: () => {
        const list = mp.getOpponentsList();
        setOpponents(list);
        engineRef.current?.syncOpponents(list);
      },
      onRoomReady: () => {
        setIsMpConnected(true);
      }
    });

    setIsMpConnected(true);
    setIsMpModalOpen(false);
  };

  // Keyboard Listeners
  useEffect(() => {
    const keys: Record<string, boolean> = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      soundRef.current?.init();
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

  // Update Car if changed in Garage
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setCar(selectedCar);
    }
  }, [selectedCar]);

  // Three.js Game Loop
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(canvasRef.current, selectedCar);
    engineRef.current = engine;

    let lastTime = performance.now();
    let animationFrameId: number;
    let mpBroadcastTimer = 0;

    const gameLoop = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(gameLoop);

      const delta = Math.min(0.05, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      // Update Engine & Physics
      const currentTelemetry = engine.update(delta, inputState);
      setTelemetry(currentTelemetry);
      setIsLetterboxed(engine.isLetterboxed);
      setNearMissActive(engine.nearMissActive);

      // Update Procedural Sound Engine
      soundRef.current?.update(
        currentTelemetry.rpm,
        currentTelemetry.speedKmh,
        currentTelemetry.isDrifting,
        inputState.nitro
      );

      // Track positions for Minimap
      setPlayerPos(engine.vehiclePhysics.position.clone());
      setPlayerHeading(engine.vehiclePhysics.rotation.y);
      setTrafficStates(engine.trafficStates);

      // Send telemetry back to connected mobile phone
      hostRef.current?.sendFeedback({
        speedKmh: currentTelemetry.speedKmh,
        gear: currentTelemetry.gear,
        rpm: currentTelemetry.rpm
      });

      // Broadcast position to Multiplayer opponents at 20 Hz
      mpBroadcastTimer += delta;
      if (mpBroadcastTimer >= 0.05 && mpManagerRef.current) {
        mpBroadcastTimer = 0;
        const pos = engine.vehiclePhysics.position;
        const quat = engine.vehiclePhysics.quaternion;
        mpManagerRef.current.broadcastLocalState({
          position: [pos.x, pos.y, pos.z],
          rotation: [quat.x, quat.y, quat.z, quat.w],
          speedKmh: currentTelemetry.speedKmh,
          isDrifting: currentTelemetry.isDrifting,
          isNitro: inputState.nitro
        });
      }
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    const handleResize = () => engine.handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      engine.dispose();
      mpManagerRef.current?.destroy();
    };
  }, [inputState]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0c12]">
      {/* 3D WebGL Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Modern In-Game Racing HUD with Radar Minimap */}
      {engineRef.current && (
        <HUDOverlay
          telemetry={telemetry}
          input={inputState}
          isLetterboxed={isLetterboxed}
          activeInputSource={activeInputSource}
          ping={ping}
          playerPos={playerPos}
          playerHeading={playerHeading}
          splineCurve={engineRef.current.track.splineCurve}
          traffic={trafficStates}
          opponents={opponents}
          nearMissActive={nearMissActive}
        />
      )}

      {/* Floating Header Actions (Top Left) */}
      <div className="absolute top-4 left-4 z-40 flex items-center space-x-2">
        <button
          onClick={() => setIsQrModalOpen(true)}
          className="flex items-center space-x-2 glass-panel px-3 py-2 rounded-xl border border-cyan-500/30 text-xs font-bold font-racing uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/20 active:scale-95 transition-all pointer-events-auto"
        >
          <QrCode className="w-4 h-4 text-cyan-400" />
          <span>{isPhoneConnected ? 'Gyro Connected' : 'Phone Gyro'}</span>
        </button>

        <button
          onClick={onOpenGarage}
          className="flex items-center space-x-2 glass-panel px-3 py-2 rounded-xl border border-amber-500/30 text-xs font-bold font-racing uppercase tracking-wider text-amber-300 hover:bg-amber-500/20 active:scale-95 transition-all pointer-events-auto"
        >
          <Warehouse className="w-4 h-4 text-amber-400" />
          <span>Garage ({selectedCar.name})</span>
        </button>

        <button
          onClick={() => setIsMpModalOpen(true)}
          className="flex items-center space-x-2 glass-panel px-3 py-2 rounded-xl border border-purple-500/30 text-xs font-bold font-racing uppercase tracking-wider text-purple-300 hover:bg-purple-500/20 active:scale-95 transition-all pointer-events-auto"
        >
          <Users className="w-4 h-4 text-purple-400" />
          <span>{isMpConnected ? `Room: ${mpRoomCode} (${opponents.length + 1})` : 'Multiplayer'}</span>
        </button>

        <button
          onClick={toggleSound}
          className="p-2 glass-panel rounded-xl border border-white/10 text-gray-300 hover:text-white active:scale-95 transition-all pointer-events-auto"
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
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

      {/* Multiplayer Lobby Modal */}
      {isMpModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-purple-500/40 max-w-md w-full text-white font-racing relative shadow-2xl shadow-purple-950/50">
            <button
              onClick={() => setIsMpModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2 mb-2">
              <Globe className="w-5 h-5 text-purple-400" />
              <h3 className="text-xl font-display font-bold text-white uppercase">
                Multiplayer Racing Lobby
              </h3>
            </div>
            <p className="text-xs text-gray-400 mb-5">
              Race in real-time against friends on the scenic autumn highway. Opponent positions are mirrored live on the vector minimap.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] uppercase font-bold text-gray-400 block mb-1">
                  Room Code (6 Digits)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={mpRoomCode}
                  onChange={(e) => setMpRoomCode(e.target.value.toUpperCase())}
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2.5 text-lg font-display font-bold text-cyan-300 tracking-wider text-center focus:outline-none focus:border-cyan-400 uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => startMultiplayer(true)}
                  className="py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-display font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-lg shadow-cyan-500/25"
                >
                  Host Room
                </button>
                <button
                  onClick={() => startMultiplayer(false)}
                  className="py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-display font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-lg shadow-purple-500/25"
                >
                  Join Room
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
