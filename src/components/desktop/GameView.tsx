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
import { MobileTouchControls } from '../mobile/MobileTouchControls';
import { MobileOrientationGuard } from '../mobile/MobileOrientationGuard';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';
import { isMobileDevice } from '../../utils/device';

interface GameViewProps {
  roomId: string;
  onExit?: () => void;
  selectedCar?: SuperCarConfig;
  onOpenGarage?: () => void;
  sharedHost?: WebRTCHost | null;
  isInitialPhoneConnected?: boolean;
  initialOpenMultiplayer?: boolean;
  isMobileMode?: boolean;
  onSwitchToController?: () => void;
}

export const GameView: React.FC<GameViewProps> = ({
  roomId,
  onExit,
  selectedCar = SUPER_CARS[0],
  onOpenGarage,
  sharedHost,
  isInitialPhoneConnected = false,
  initialOpenMultiplayer = false,
  isMobileMode,
  onSwitchToController
}) => {
  const isMobile = isMobileMode ?? isMobileDevice();

  const {
    steerNormalized: mobileSteer,
    angleDegrees: mobileAngle,
    recalibrate: recalibrateMobileGyro
  } = useDeviceOrientation();
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
  const [isMpModalOpen, setIsMpModalOpen] = useState<boolean>(initialOpenMultiplayer);
  const [mpUsername, setMpUsername] = useState<string>('Racer_' + Math.floor(Math.random() * 900 + 100));
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

  // F1 Starting Countdown (3... 2... 1... GO!)
  const [countdown, setCountdown] = useState<number | 'GO!' | null>(3);
  const countdownRef = useRef<number | 'GO!' | null>(3);
  const lastHornRef = useRef<boolean>(false);

  // Initialize Sound Engine
  useEffect(() => {
    const sound = new SoundEngine();
    soundRef.current = sound;
    return () => {
      sound.dispose();
    };
  }, []);

  // Realtime Mobile Gyro Tilt Steering (when game runs directly on phone)
  useEffect(() => {
    if (isMobile) {
      inputRef.current.steer = mobileSteer;
      inputRef.current.angleDegrees = mobileAngle;
      setActiveInputSource('gyro');
    }
  }, [isMobile, mobileSteer, mobileAngle]);

  // F1 Starting Grid Countdown Timer
  useEffect(() => {
    countdownRef.current = 3;
    setCountdown(3);

    // Initial beep at 3
    const t0 = setTimeout(() => {
      soundRef.current?.init();
      soundRef.current?.playCountdownBeep(false);
    }, 150);

    const t1 = setTimeout(() => {
      countdownRef.current = 2;
      setCountdown(2);
      soundRef.current?.playCountdownBeep(false);
    }, 1150);

    const t2 = setTimeout(() => {
      countdownRef.current = 1;
      setCountdown(1);
      soundRef.current?.playCountdownBeep(false);
    }, 2150);

    const t3 = setTimeout(() => {
      countdownRef.current = 'GO!';
      setCountdown('GO!');
      soundRef.current?.playCountdownBeep(true);
    }, 3150);

    const t4 = setTimeout(() => {
      countdownRef.current = null;
      setCountdown(null);
    }, 4200);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
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
    const hexColor = '#' + selectedCar.bodyColorHex.toString(16).padStart(6, '0');
    const mp = new MultiplayerRoomManager(
      mpRoomCode,
      mpUsername.trim() || ('Racer_' + Math.floor(Math.random() * 900 + 100)),
      selectedCar.id,
      hexColor
    );
    mpManagerRef.current = mp;

    mp.init(asHost, {
      onPlayerJoined: (player) => {
        const list = mp.getOpponentsList();
        setOpponents(list);
        engineRef.current?.syncOpponents(list);
      },
      onPlayerLeft: () => {
        const list = mp.getOpponentsList();
        setOpponents(list);
        engineRef.current?.syncOpponents(list);
      },
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

  const leaveMultiplayer = () => {
    mpManagerRef.current?.destroy();
    mpManagerRef.current = null;
    setIsMpConnected(false);
    setOpponents([]);
    engineRef.current?.syncOpponents([]);
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
      const horn = !!keys['KeyH'];

      setActiveInputSource('keyboard');
      inputRef.current = {
        steer,
        throttle,
        brake,
        handbrake,
        nitro,
        reset,
        cameraSwitch,
        horn,
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

      const rawInput = inputRef.current;
      const currentInput = { ...rawInput };

      // Handle supercar horn
      if (rawInput.horn && !lastHornRef.current) {
        soundRef.current?.playHorn();
      }
      lastHornRef.current = !!rawInput.horn;

      // Lock car at starting line during F1 countdown (3... 2... 1...)
      if (countdownRef.current !== null && countdownRef.current !== 'GO!') {
        currentInput.throttle = 0;
        currentInput.nitro = false;
      }

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

  const content = (
    <div className="relative w-full h-full overflow-hidden bg-[#0a0c12]">
      {/* 3D WebGL Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* High-Speed Radial Warp / Speed Streaks Effect (> 150 KM/H or Nitro) */}
      {(telemetry.speedKmh > 150 || inputRef.current.nitro) && (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden mix-blend-screen transition-opacity duration-200">
          <svg className="w-full h-full opacity-65" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            <defs>
              <radialGradient id="warpGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="65%" stopColor="rgba(0, 242, 254, 0.08)" />
                <stop offset="100%" stopColor="rgba(0, 242, 254, 0.4)" />
              </radialGradient>
            </defs>
            <rect width="1000" height="1000" fill="url(#warpGrad)" />
            <line x1="500" y1="500" x2="0" y2="80" stroke="#00f2fe" strokeWidth="3" strokeDasharray="50 120" />
            <line x1="500" y1="500" x2="0" y2="920" stroke="#00f2fe" strokeWidth="3" strokeDasharray="50 120" />
            <line x1="500" y1="500" x2="1000" y2="80" stroke="#00f2fe" strokeWidth="3" strokeDasharray="50 120" />
            <line x1="500" y1="500" x2="1000" y2="920" stroke="#00f2fe" strokeWidth="3" strokeDasharray="50 120" />
            <line x1="500" y1="500" x2="150" y2="0" stroke="#c084fc" strokeWidth="2.5" strokeDasharray="60 90" />
            <line x1="500" y1="500" x2="850" y2="0" stroke="#c084fc" strokeWidth="2.5" strokeDasharray="60 90" />
            <line x1="500" y1="500" x2="150" y2="1000" stroke="#c084fc" strokeWidth="2.5" strokeDasharray="60 90" />
            <line x1="500" y1="500" x2="850" y2="1000" stroke="#c084fc" strokeWidth="2.5" strokeDasharray="60 90" />
          </svg>
          <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,242,254,0.35)]" />
        </div>
      )}

      {/* F1 5-Light Starting Gantry Countdown (3... 2... 1... GO!) */}
      {countdown !== null && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none select-none">
          {/* Carbon Fiber Gantry Light Housing */}
          <div className="glass-panel px-7 py-3.5 rounded-3xl border-2 border-white/20 bg-black/85 shadow-[0_0_50px_rgba(0,0,0,0.95)] flex items-center space-x-4">
            {[1, 2, 3, 4, 5].map((lightIdx) => {
              const isRed = countdown === 3 ? lightIdx <= 2 : countdown === 2 ? lightIdx <= 4 : countdown === 1 ? true : false;
              const isGo = countdown === 'GO!';
              return (
                <div key={lightIdx} className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full border-2 transition-all duration-150 ${
                      isGo
                        ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_35px_#10b981]'
                        : isRed
                        ? 'bg-rose-600 border-rose-400 shadow-[0_0_30px_#ef4444]'
                        : 'bg-zinc-900 border-zinc-700 shadow-inner'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Sub-label banner */}
          <div className="mt-3 px-6 py-1.5 rounded-full bg-black/80 border border-white/10 backdrop-blur-md">
            <span className={`font-display font-black tracking-widest text-2xl uppercase drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] ${
              countdown === 'GO!' ? 'text-emerald-400 animate-pulse text-3xl' : 'text-rose-400'
            }`}>
              {countdown === 'GO!'
                ? 'LIGHTS OUT & AWAY WE GO!'
                : countdown === 3
                ? 'STAGE 3 • GET READY'
                : countdown === 2
                ? 'STAGE 2 • REV ENGINES'
                : 'STAGE 1 • HOLD BRAKE'}
            </span>
          </div>
        </div>
      )}

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
          isMobile={isMobile}
        />
      )}

      {/* On-Screen Mobile Transparent Controls Overlay (Asphalt / Real Racing 3 Style) */}
      {isMobile && (
        <MobileTouchControls
          onInputChange={(partialInput) => {
            soundRef.current?.init();
            if (partialInput.throttle !== undefined) inputRef.current.throttle = partialInput.throttle;
            if (partialInput.brake !== undefined) inputRef.current.brake = partialInput.brake;
            if (partialInput.handbrake !== undefined) inputRef.current.handbrake = partialInput.handbrake;
            if (partialInput.nitro !== undefined) inputRef.current.nitro = partialInput.nitro;
          }}
          onCameraSwitch={() => {
            inputRef.current.cameraSwitch = true;
            setTimeout(() => {
              inputRef.current.cameraSwitch = false;
            }, 100);
          }}
          onResetCar={() => {
            inputRef.current.reset = true;
            setTimeout(() => {
              inputRef.current.reset = false;
            }, 100);
          }}
          onRecalibrateGyro={recalibrateMobileGyro}
          onOpenGarage={onOpenGarage}
          onSwitchToControllerMode={onSwitchToController}
          isMuted={isMuted}
          onToggleMute={toggleSound}
          currentAngleDegrees={mobileAngle}
        />
      )}

      {/* Floating Header Actions (Top Left - Desktop Only) */}
      {!isMobile && (
        <div className="absolute top-4 left-4 z-40 flex items-center space-x-2">
        {onExit && (
          <button
            onClick={() => {
              soundRef.current?.playUiClick();
              onExit();
            }}
            onMouseEnter={() => soundRef.current?.playUiHover()}
            className="flex items-center space-x-1.5 glass-panel px-3 py-2 rounded-xl border border-white/10 text-xs font-bold font-racing uppercase tracking-wider text-gray-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all pointer-events-auto shadow-lg"
            title="Return to Main Menu"
          >
            <span>← Menu</span>
          </button>
        )}

        <button
          onClick={() => {
            soundRef.current?.playUiClick();
            setIsQrModalOpen(true);
          }}
          onMouseEnter={() => soundRef.current?.playUiHover()}
          className="flex items-center space-x-2 glass-panel px-3 py-2 rounded-xl border border-cyan-500/30 text-xs font-bold font-racing uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/20 active:scale-95 transition-all pointer-events-auto shadow-lg"
        >
          <QrCode className="w-4 h-4 text-cyan-400" />
          <span>{isPhoneConnected ? 'Gyro Connected' : 'Phone Gyro'}</span>
        </button>

        <button
          onClick={() => {
            soundRef.current?.playUiClick();
            onOpenGarage?.();
          }}
          onMouseEnter={() => soundRef.current?.playUiHover()}
          className="flex items-center space-x-2 glass-panel px-3 py-2 rounded-xl border border-amber-500/30 text-xs font-bold font-racing uppercase tracking-wider text-amber-300 hover:bg-amber-500/20 active:scale-95 transition-all pointer-events-auto shadow-lg"
        >
          <Warehouse className="w-4 h-4 text-amber-400" />
          <span>Garage ({selectedCar.name})</span>
        </button>

        <button
          onClick={() => {
            soundRef.current?.playUiClick();
            setIsMpModalOpen(true);
          }}
          onMouseEnter={() => soundRef.current?.playUiHover()}
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
      )}

      {/* Live Multiplayer Race Hub (Top Right) */}
      {isMpConnected && (
        <div className="absolute top-16 right-4 z-40 glass-panel p-3 rounded-2xl border border-purple-500/40 text-white font-racing shadow-2xl shadow-purple-950/40 pointer-events-auto min-w-[220px]">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-2 border-b border-white/10 pb-1.5">
            <span className="flex items-center gap-1.5 text-purple-300">
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              <span>ROOM: {mpRoomCode}</span>
            </span>
            <button
              onClick={leaveMultiplayer}
              className="text-[10px] text-rose-400 hover:text-rose-300 font-mono px-2 py-0.5 rounded bg-rose-500/20 active:bg-rose-500/40 border border-rose-500/30"
              title="Leave Multiplayer Room"
            >
              LEAVE
            </button>
          </div>

          <div className="space-y-1.5">
            {/* Local Player */}
            <div className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                YOU ({selectedCar.name})
              </span>
              <span className="font-mono text-cyan-200">{telemetry.speedKmh} KM/H</span>
            </div>

            {/* Remote Competitors */}
            {opponents.length === 0 ? (
              <div className="text-[11px] text-gray-400 italic py-1 px-2 text-center font-mono">
                Waiting for competitors to join...
              </div>
            ) : (
              opponents.map((opp) => (
                <div
                  key={opp.id}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white/5 border border-white/10"
                >
                  <span className="font-bold flex items-center gap-1.5" style={{ color: opp.color || '#a855f7' }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: opp.color || '#a855f7' }} />
                    {opp.username}
                  </span>
                  <span className="font-mono text-gray-300">{opp.speedKmh} KM/H</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

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
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-purple-500/40 max-w-md w-full text-white font-racing relative shadow-2xl shadow-purple-950/60">
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
              Race in real-time against friends on the 7.6 KM Grand Alpine highway via zero-server P2P WebRTC.
            </p>

            <div className="space-y-4">
              {/* Driver Handle */}
              <div>
                <label className="text-[11px] uppercase font-bold text-gray-400 block mb-1">
                  Driver Name
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={mpUsername}
                  onChange={(e) => setMpUsername(e.target.value)}
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-sm font-display font-bold text-white tracking-wider focus:outline-none focus:border-purple-400"
                  placeholder="Enter your racer tag"
                />
              </div>

              {/* Room Code */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] uppercase font-bold text-gray-400">
                    Room Code (6 Characters)
                  </label>
                  <button
                    onClick={() => setMpRoomCode(roomId)}
                    className="text-[10px] text-cyan-400 hover:underline font-mono"
                  >
                    Use Gyro Room ({roomId})
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={mpRoomCode}
                  onChange={(e) => setMpRoomCode(e.target.value.toUpperCase())}
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2.5 text-lg font-display font-bold text-cyan-300 tracking-widest text-center focus:outline-none focus:border-cyan-400 uppercase"
                />
              </div>

              {/* Action Buttons */}
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

              {isMpConnected && (
                <div className="pt-2 border-t border-white/10">
                  <button
                    onClick={leaveMultiplayer}
                    className="w-full py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-bold uppercase tracking-wider"
                  >
                    Disconnect from {mpRoomCode}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <MobileOrientationGuard onSwitchToController={onSwitchToController}>
        {content}
      </MobileOrientationGuard>
    );
  }

  return content;
};
