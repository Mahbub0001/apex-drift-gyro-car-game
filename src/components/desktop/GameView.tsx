import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GameEngine } from '../../game/core/Engine';
import { HUDOverlay } from '../../game/ui/HUDOverlay';
import { SoundEngine } from '../../game/audio/SoundEngine';
import { WebRTCHost } from '../../services/webrtc';
import { MultiplayerRoomManager } from '../../services/multiplayer';
import { ControllerInput, VehicleTelemetry, TrafficCarState, RemotePlayerState, SuperCarConfig, SUPER_CARS } from '../../types';
import QRCode from 'qrcode';
import { QrCode, X, Users, Globe, Volume2, VolumeX, Warehouse, Copy, Check, ExternalLink, Wifi } from 'lucide-react';

interface GameViewProps {
  roomId: string;
  onExit?: () => void;
  selectedCar?: SuperCarConfig;
  onOpenGarage?: () => void;
  sharedHost?: WebRTCHost | null;
  isInitialPhoneConnected?: boolean;
}

export const GameView: React.FC<GameViewProps> = ({
  roomId,
  onExit,
  selectedCar = SUPER_CARS[0],
  onOpenGarage,
  sharedHost,
  isInitialPhoneConnected = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const hostRef = useRef<WebRTCHost | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  const mpManagerRef = useRef<MultiplayerRoomManager | null>(null);

  // Input Ref (Ensures Game Loop never restarts or re-renders on keypress/gyro)
  const inputRef = useRef<ControllerInput>({
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

  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isMpModalOpen, setIsMpModalOpen] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isPhoneConnected, setIsPhoneConnected] = useState<boolean>(isInitialPhoneConnected);
  const [ping, setPing] = useState<number>(0);
  const [activeInputSource, setActiveInputSource] = useState<'gyro' | 'keyboard'>('keyboard');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Multiplayer Room State
  const [mpRoomCode, setMpRoomCode] = useState<string>(roomId);
  const [isMpConnected, setIsMpConnected] = useState<boolean>(false);
  const [opponents, setOpponents] = useState<RemotePlayerState[]>([]);

  // Throttled UI Telemetry for HUD (Updates at ~25 FPS to prevent React overhead)
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

  const [playerPos, setPlayerPos] = useState<THREE.Vector3>(new THREE.Vector3(0, 0.42, 10));
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

  // LAN IP Detection & Dynamic QR Code URL for Zero-Install Phone Gyro
  const [controllerUrl, setControllerUrl] = useState<string>('');
  const [lanIp, setLanIp] = useState<string>('');
  const [availableIps, setAvailableIps] = useState<string[]>([]);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      fetch('/api/lan-ip')
        .then((res) => res.json())
        .then((data) => {
          if (data?.primary) {
            setLanIp(data.primary);
            setAvailableIps(data.all || [data.primary]);
          }
        })
        .catch(() => {
          setLanIp('192.168.10.230');
        });
    }
  }, []);

  useEffect(() => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const host = isLocal ? (lanIp || '192.168.10.230') : window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;
    const url = `${protocol}//${host}${port}/?mode=controller&room=${roomId}`;
    setControllerUrl(url);

    QRCode.toDataURL(url, {
      width: 320,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrDataUrl);
  }, [roomId, lanIp]);

  // WebRTC Host Listener (Uses shared host from App level if present, or creates fallback)
  useEffect(() => {
    if (sharedHost) {
      hostRef.current = sharedHost;
      sharedHost.setInputCallback((incomingInput) => {
        soundRef.current?.init();
        inputRef.current = incomingInput;
        setActiveInputSource('gyro');
      });
      sharedHost.setConnectionChangeCallback((connected) => {
        setIsPhoneConnected(connected);
      });
      setIsPhoneConnected(sharedHost.isConnected);

      const pingTimer = setInterval(() => {
        setPing(sharedHost.pingMs);
      }, 500);

      return () => {
        clearInterval(pingTimer);
      };
    }

    const host = new WebRTCHost(roomId);
    hostRef.current = host;

    host.init(
      (incomingInput) => {
        soundRef.current?.init();
        inputRef.current = incomingInput;
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
  }, [roomId, sharedHost]);

  // Multiplayer Room Connection
  const startMultiplayer = (asHost: boolean) => {
    const mp = new MultiplayerRoomManager(mpRoomCode);
    mpManagerRef.current = mp;

    mp.init(asHost, {
      onPlayerJoined: () => setOpponents(mp.getOpponentsList()),
      onPlayerLeft: () => setOpponents(mp.getOpponentsList()),
      onPlayerUpdate: () => {
        const list = mp.getOpponentsList();
        setOpponents(list);
        engineRef.current?.syncOpponents(list);
      },
      onRoomReady: () => setIsMpConnected(true)
    });

    setIsMpConnected(true);
    setIsMpModalOpen(false);
  };

  // Smooth Keyboard Controls
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

      setActiveInputSource('keyboard');
      inputRef.current = {
        steer,
        throttle,
        brake,
        handbrake,
        nitro,
        reset,
        cameraSwitch,
        angleDegrees: Math.round(steer * 45),
        timestamp: Date.now()
      };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Update selected car dynamically without destroying engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setCar(selectedCar);
    }
  }, [selectedCar]);

  // Main Persistent Three.js Game Loop
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(canvasRef.current, selectedCar);
    engineRef.current = engine;

    // Connect crash sound effect
    engine.onCrashCallback = (severity) => {
      soundRef.current?.playCrashImpact(severity);
    };

    let lastTime = performance.now();
    let animationFrameId: number;
    let uiUpdateTimer = 0;
    let mpBroadcastTimer = 0;

    const gameLoop = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(gameLoop);

      const delta = Math.min(0.05, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      const currentInput = inputRef.current;

      // 1. Advance Physics & 3D Engine Frame
      const currentTelemetry = engine.update(delta, currentInput);

      // 2. Realistic Procedural Sound Engine
      soundRef.current?.update(
        currentTelemetry.rpm,
        currentTelemetry.speedKmh,
        currentTelemetry.isDrifting,
        currentInput.nitro,
        currentInput.throttle,
        !!currentTelemetry.isOnCurb,
        currentInput.brake > 0.05
      );

      // 3. Throttle React HUD Updates to 25 FPS (prevents page stutter/refresh feel)
      uiUpdateTimer += delta;
      if (uiUpdateTimer >= 0.04) {
        uiUpdateTimer = 0;
        setTelemetry(currentTelemetry);
        setIsLetterboxed(engine.isLetterboxed);
        setNearMissActive(engine.nearMissActive);
        setPlayerPos(engine.vehiclePhysics.position.clone());
        setPlayerHeading(engine.vehiclePhysics.rotation.y);
        setTrafficStates(engine.trafficStates);

        // Send feedback to mobile gyro controller
        hostRef.current?.sendFeedback({
          speedKmh: currentTelemetry.speedKmh,
          gear: currentTelemetry.gear,
          rpm: currentTelemetry.rpm
        });
      }

      // 4. Broadcast Multiplayer Position at 20 Hz
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
          isNitro: currentInput.nitro
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
  }, []); // Run ONCE on mount! NEVER re-runs on input!

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0c12]">
      {/* 3D WebGL Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Modern In-Game Racing HUD with Vector Radar Minimap */}
      {engineRef.current && (
        <HUDOverlay
          telemetry={telemetry}
          input={inputRef.current}
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
        {onExit && (
          <button
            onClick={onExit}
            className="flex items-center space-x-1.5 glass-panel px-3 py-2 rounded-xl border border-white/10 text-xs font-bold font-racing uppercase tracking-wider text-gray-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all pointer-events-auto shadow-lg"
            title="Return to Main Menu"
          >
            <span>← Menu</span>
          </button>
        )}

        <button
          onClick={() => setIsQrModalOpen(true)}
          className="flex items-center space-x-2 glass-panel px-3 py-2 rounded-xl border border-cyan-500/30 text-xs font-bold font-racing uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/20 active:scale-95 transition-all pointer-events-auto shadow-lg"
        >
          <QrCode className="w-4 h-4 text-cyan-400" />
          <span>{isPhoneConnected ? 'Gyro Connected' : 'Phone Gyro'}</span>
        </button>

        <button
          onClick={onOpenGarage}
          className="flex items-center space-x-2 glass-panel px-3 py-2 rounded-xl border border-amber-500/30 text-xs font-bold font-racing uppercase tracking-wider text-amber-300 hover:bg-amber-500/20 active:scale-95 transition-all pointer-events-auto shadow-lg"
        >
          <Warehouse className="w-4 h-4 text-amber-400" />
          <span>Garage ({selectedCar.name})</span>
        </button>

        <button
          onClick={() => setIsMpModalOpen(true)}
          className="flex items-center space-x-2 glass-panel px-3 py-2 rounded-xl border border-purple-500/30 text-xs font-bold font-racing uppercase tracking-wider text-purple-300 hover:bg-purple-500/20 active:scale-95 transition-all pointer-events-auto shadow-lg"
        >
          <Users className="w-4 h-4 text-purple-400" />
          <span>{isMpConnected ? `Room: ${mpRoomCode} (${opponents.length + 1})` : 'Multiplayer'}</span>
        </button>

        <button
          onClick={toggleSound}
          className="p-2 glass-panel rounded-xl border border-white/10 text-gray-300 hover:text-white active:scale-95 transition-all pointer-events-auto shadow-lg"
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
        </button>
      </div>

      {/* QR Code Connect Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-cyan-500/40 max-w-md w-full text-white text-center font-racing relative shadow-2xl shadow-cyan-950/60">
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-display font-bold text-cyan-300 mb-1 flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5 text-cyan-400" /> PAIR GYRO CONTROLLER
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Scan with your phone's camera (same Wi-Fi) to turn your phone into a physical tilt steering wheel!
            </p>

            <div className="bg-white p-3.5 rounded-2xl shadow-xl shadow-cyan-500/10 flex flex-col items-center justify-center mb-3">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="w-52 h-52 rounded-lg select-none block" />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-gray-500 text-xs font-mono">
                  Generating High-Contrast QR...
                </div>
              )}
            </div>

            {/* Room Code Badge */}
            <div className="flex items-center justify-between bg-cyan-950/50 border border-cyan-500/40 p-2.5 rounded-xl mb-3">
              <span className="text-xs text-cyan-200 font-bold uppercase tracking-wider">PAIRING CODE:</span>
              <span className="font-mono font-extrabold text-lg text-cyan-300 tracking-widest bg-black/80 px-3 py-0.5 rounded border border-cyan-500/50">
                {roomId}
              </span>
            </div>

            {/* Connection Link & Copy */}
            <div className="bg-black/40 border border-white/10 rounded-lg p-2.5 mb-3 text-left">
              <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 mb-1">
                <span className="flex items-center gap-1 text-cyan-400"><Wifi className="w-3 h-3" /> Controller Link:</span>
                <button
                  onClick={() => {
                    if (controllerUrl) {
                      navigator.clipboard.writeText(controllerUrl);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }
                  }}
                  className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200 transition-colors"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLink ? 'COPIED!' : 'COPY'}</span>
                </button>
              </div>
              <div className="text-[11px] font-mono text-gray-300 break-all select-all bg-black/60 p-1.5 rounded">
                {controllerUrl || 'Detecting network...'}
              </div>
            </div>

            {/* IP Switcher if multiple LAN adapters */}
            {availableIps.length > 1 && (
              <div className="flex items-center justify-center gap-2 mb-3 text-[11px] font-mono text-gray-400">
                <span>Wi-Fi / LAN IP:</span>
                <select
                  value={lanIp}
                  onChange={(e) => setLanIp(e.target.value)}
                  className="bg-black/60 border border-cyan-500/30 rounded px-2 py-1 text-cyan-300 text-[11px] outline-none"
                >
                  {availableIps.map((ip) => (
                    <option key={ip} value={ip}>{ip}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Status & Test in Tab Button */}
            <div className="flex items-center justify-between text-xs font-mono text-gray-300 mb-4 px-1">
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${isPhoneConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span>{isPhoneConnected ? 'PHONE SYNCED' : 'WAITING FOR SCAN'}</span>
              </div>
              <a
                href={controllerUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 underline"
              >
                <ExternalLink className="w-3 h-3" /> Test in Tab
              </a>
            </div>

            <button
              onClick={() => setIsQrModalOpen(false)}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 rounded-xl font-bold uppercase text-xs tracking-wider transition-all shadow-lg shadow-cyan-500/20"
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
