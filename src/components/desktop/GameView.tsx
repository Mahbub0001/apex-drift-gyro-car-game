import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GameEngine } from '../../game/core/Engine';
import { HUDOverlay } from '../../game/ui/HUDOverlay';
import { SoundEngine } from '../../game/audio/SoundEngine';
import { WebRTCHost } from '../../services/webrtc';
import {
  MultiplayerRoomManager,
  MultiplayerStatus,
  getMultiplayerGridSlot
} from '../../services/multiplayer';
import {
  ControllerInput,
  VehicleTelemetry,
  TrafficCarState,
  RemotePlayerState,
  RaceFinishEntry,
  SuperCarConfig,
  SUPER_CARS,
  GameSettings,
  DEFAULT_GAME_SETTINGS
} from '../../types';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import {
  QrCode,
  X,
  Users,
  Globe,
  Volume2,
  VolumeX,
  Warehouse,
  Copy,
  Check,
  ExternalLink,
  Wifi,
  Play,
  RefreshCw,
  Sliders,
  Home,
  Trophy,
  Flag
} from 'lucide-react';
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
  settings?: GameSettings;
  onUpdateSettings?: (partial: Partial<GameSettings>) => void;
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
  settings = DEFAULT_GAME_SETTINGS,
  onUpdateSettings,
  onSwitchToController
}) => {
  const isMobile = isMobileMode ?? isMobileDevice();
  const [isForceRotated90, setIsForceRotated90] = useState<boolean>(false);

  const {
    steerNormalized: mobileSteer,
    angleDegrees: mobileAngle,
    needsPermissionPrompt,
    hasSensorSignal,
    requestPermission: requestGyroPermission,
    recalibrate: recalibrateMobileGyro
  } = useDeviceOrientation(settings.gyroSensitivity, isForceRotated90);

  useEffect(() => {
    const t = window.setTimeout(() => engineRef.current?.handleResize(), 80);
    return () => window.clearTimeout(t);
  }, [isForceRotated90]);

  const mobileSteerModeRef = useRef<'gyro' | 'touch'>('gyro');
  const lastGyroPacketTimeRef = useRef<number>(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const hostRef = useRef<WebRTCHost | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  const mpManagerRef = useRef<MultiplayerRoomManager | null>(null);

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
  const [isPauseOpen, setIsPauseOpen] = useState<boolean>(false);
  const isPauseRef = useRef<boolean>(false);
  const [mpUsername, setMpUsername] = useState<string>(
    'Racer_' + Math.floor(Math.random() * 900 + 100)
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isPhoneConnected, setIsPhoneConnected] = useState<boolean>(isInitialPhoneConnected);
  const [ping, setPing] = useState<number>(0);
  const [activeInputSource, setActiveInputSource] = useState<'gyro' | 'keyboard'>('keyboard');

  const [mpRoomCode, setMpRoomCode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const mp = new URLSearchParams(window.location.search).get('mp');
      if (mp) return mp.toUpperCase().slice(0, 6);
    }
    return roomId;
  });
  const [isMpConnected, setIsMpConnected] = useState<boolean>(false);
  const [isMpHost, setIsMpHost] = useState<boolean>(true);
  const [mpTargetLaps, setMpTargetLaps] = useState<number>(1);
  const mpTargetLapsRef = useRef<number>(1);
  const [mpStatus, setMpStatus] = useState<MultiplayerStatus>('waiting');
  const [mpStatusMsg, setMpStatusMsg] = useState<string>('');
  const [mpRacePhase, setMpRacePhase] = useState<'idle' | 'waiting_start' | 'countdown' | 'racing'>('idle');
  const mpRacePhaseRef = useRef<'idle' | 'waiting_start' | 'countdown' | 'racing'>('idle');
  const [copiedMpInvite, setCopiedMpInvite] = useState<boolean>(false);
  const [opponents, setOpponents] = useState<RemotePlayerState[]>([]);
  const [raceResults, setRaceResults] = useState<RaceFinishEntry[]>([]);
  const [localRaceFinished, setLocalRaceFinished] = useState<boolean>(false);
  const [dismissedPodium, setDismissedPodium] = useState<boolean>(false);
  const localRaceFinishedRef = useRef<boolean>(false);

  useEffect(() => {
    mpRacePhaseRef.current = mpRacePhase;
  }, [mpRacePhase]);

  useEffect(() => {
    mpTargetLapsRef.current = mpTargetLaps;
  }, [mpTargetLaps]);

  const [telemetry, setTelemetry] = useState<VehicleTelemetry>({
    speedKmh: 0,
    rpm: 850,
    gear: 1,
    nitroFuel: 100,
    isDrifting: false,
    driftScore: 0,
    totalScore: 0,
    lastBankedDrift: 0,
    isAirborne: false,
    isJumping: false,
    health: 100,
    cameraMode: settings.defaultCamera,
    lap: 1,
    lapTimeMs: 0,
    bestLapTimeMs: null,
    isWrongWay: false
  });

  const [playerPos, setPlayerPos] = useState<THREE.Vector3>(new THREE.Vector3(0, 0.42, 10));
  const [playerHeading, setPlayerHeading] = useState<number>(0);
  const [trafficStates, setTrafficStates] = useState<TrafficCarState[]>([]);
  const [isLetterboxed, setIsLetterboxed] = useState<boolean>(false);
  const [nearMissActive, setNearMissActive] = useState<boolean>(false);

  const [countdown, setCountdown] = useState<number | 'GO!' | null>(3);
  const countdownRef = useRef<number | 'GO!' | null>(3);
  const lastHornRef = useRef<boolean>(false);

  useEffect(() => {
    isPauseRef.current = isPauseOpen;
  }, [isPauseOpen]);

  // Initialize Sound Engine respecting persisted mute setting
  useEffect(() => {
    const sound = new SoundEngine();
    if (settings.isMuted) {
      sound.toggleMute();
    }
    soundRef.current = sound;
    return () => {
      sound.dispose();
    };
  }, []);

  // Sync runtime graphics preset changes live into Three.js Engine
  useEffect(() => {
    engineRef.current?.applyGraphicsSettings(settings);
  }, [settings]);

  // Sync mute state cleanly when updated from Pause or Header
  const toggleSound = () => {
    if (!soundRef.current) return;
    soundRef.current.init();
    const muted = soundRef.current.toggleMute();
    onUpdateSettings?.({ isMuted: muted });
  };

  // Realtime Mobile Gyro Tilt Steering (ONLY active when steerMode === 'gyro' — never fights touch arrows!)
  useEffect(() => {
    if (isMobile && mobileSteerModeRef.current === 'gyro') {
      inputRef.current.steer = mobileSteer;
      inputRef.current.angleDegrees = mobileAngle;
      setActiveInputSource('gyro');
    }
  }, [isMobile, mobileSteer, mobileAngle]);

  const countdownTimersRef = useRef<number[]>([]);

  const clearGridCountdown = () => {
    countdownTimersRef.current.forEach((id) => clearTimeout(id));
    countdownTimersRef.current = [];
    countdownRef.current = null;
    setCountdown(null);
  };

  const startGridCountdown = (seconds: number = 3, onGo?: () => void) => {
    countdownTimersRef.current.forEach((id) => clearTimeout(id));
    countdownTimersRef.current = [];
    const totalSec = Math.max(1, Math.round(seconds));
    countdownRef.current = totalSec;
    setCountdown(totalSec);

    countdownTimersRef.current.push(
      window.setTimeout(() => {
        soundRef.current?.init();
        soundRef.current?.playCountdownBeep(false);
      }, 120)
    );

    for (let s = totalSec - 1; s >= 1; s--) {
      const delayMs = (totalSec - s) * 1000;
      countdownTimersRef.current.push(
        window.setTimeout(() => {
          countdownRef.current = s;
          setCountdown(s);
          if (s <= 5) {
            soundRef.current?.init();
            soundRef.current?.playCountdownBeep(false);
          }
        }, delayMs)
      );
    }

    const goDelayMs = totalSec * 1000;
    countdownTimersRef.current.push(
      window.setTimeout(() => {
        countdownRef.current = 'GO!';
        setCountdown('GO!');
        soundRef.current?.init();
        soundRef.current?.playCountdownBeep(true);
        onGo?.();
      }, goDelayMs),
      window.setTimeout(() => {
        countdownRef.current = null;
        setCountdown(null);
      }, goDelayMs + 1050)
    );
  };

  // F1 Starting Grid Countdown Timer
  useEffect(() => {
    startGridCountdown();
    return () => {
      countdownTimersRef.current.forEach((id) => clearTimeout(id));
      countdownTimersRef.current = [];
    };
  }, []);

  // LAN IP Detection & Dynamic QR Code
  const [controllerUrl, setControllerUrl] = useState<string>('');
  const [lanIp, setLanIp] = useState<string>('');
  const [availableIps, setAvailableIps] = useState<string[]>([]);
  const [httpsPort, setHttpsPort] = useState<number | null>(null);
  const [preferHttpsQr, setPreferHttpsQr] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    const isLocal =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal || window.location.protocol === 'http:') {
      fetch('/api/lan-ip')
        .then((res) => res.json())
        .then((data) => {
          if (data?.primary) {
            setLanIp(data.primary);
            setAvailableIps(data.all || [data.primary]);
          }
          if (typeof data?.httpsPort === 'number') {
            setHttpsPort(data.httpsPort);
          }
        })
        .catch(() => {
          setLanIp('localhost');
        });
    }
  }, []);

  useEffect(() => {
    const isLocal =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const host = isLocal ? lanIp || window.location.hostname : window.location.hostname;
    const useHttps = preferHttpsQr && httpsPort !== null && host !== 'localhost' && host !== '127.0.0.1';
    const protocol = useHttps ? 'https:' : window.location.protocol;
    const port = useHttps ? `:${httpsPort}` : window.location.port ? `:${window.location.port}` : '';
    const url = `${protocol}//${host}${port}/?mode=controller&room=${roomId}`;
    setControllerUrl(url);

    QRCode.toDataURL(url, {
      width: 320,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrDataUrl);
  }, [roomId, lanIp, httpsPort, preferHttpsQr]);

  // Attach to App-owned WebRTC Host ONLY in Desktop mode (never spin up a duplicate WebRTCHost if sharedHost !== undefined!)
  useEffect(() => {
    if (isMobileMode) return;

    if (sharedHost) {
      hostRef.current = sharedHost;
      sharedHost.setInputCallback((incomingInput) => {
        soundRef.current?.init();
        lastGyroPacketTimeRef.current = performance.now();
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

    // If sharedHost prop was explicitly passed as null (App is initializing it), wait for sharedHost
    if (sharedHost === null) return;

    const host = new WebRTCHost(roomId);
    hostRef.current = host;

    host.init(
      (incomingInput) => {
        soundRef.current?.init();
        lastGyroPacketTimeRef.current = performance.now();
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
  }, [roomId, sharedHost, isMobileMode]);

  // Multiplayer Room Connection
  const handleResetRaceState = (nextTargetLaps?: number, countdownSeconds: number = 10) => {
    if (typeof nextTargetLaps === 'number') {
      setMpTargetLaps(nextTargetLaps);
      mpTargetLapsRef.current = nextTargetLaps;
    }
    localRaceFinishedRef.current = false;
    setLocalRaceFinished(false);
    setDismissedPodium(false);
    setRaceResults([]);

    const slot = mpManagerRef.current
      ? mpManagerRef.current.getLocalGridPosition()
      : getMultiplayerGridSlot(0);
    const slotVec = new THREE.Vector3(slot[0], slot[1], slot[2]);
    if (engineRef.current) {
      engineRef.current.multiplayerSpawnPos = slotVec.clone();
      engineRef.current.vehiclePhysics.resetRace(slotVec);
    }

    mpRacePhaseRef.current = 'countdown';
    setMpRacePhase('countdown');
    startGridCountdown(countdownSeconds, () => {
      mpRacePhaseRef.current = 'racing';
      setMpRacePhase('racing');
    });
  };

  const handleHostStartRace = () => {
    if (!mpManagerRef.current || !isMpHost) return;
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    mpManagerRef.current.startRaceWithCountdown(10);
  };

  const startMultiplayer = (asHost: boolean) => {
    mpManagerRef.current?.destroy();
    const cleanCode = (mpRoomCode || roomId).toUpperCase().trim() || roomId;
    setMpRoomCode(cleanCode);
    setIsMpHost(asHost);
    setMpStatus('connecting');
    setMpStatusMsg(asHost ? 'Creating room...' : `Joining ${cleanCode}...`);
    localRaceFinishedRef.current = false;
    setLocalRaceFinished(false);
    setDismissedPodium(false);
    setRaceResults([]);

    const initialSlot = getMultiplayerGridSlot(asHost ? 0 : 1);
    const initialVec = new THREE.Vector3(initialSlot[0], initialSlot[1], initialSlot[2]);
    if (engineRef.current) {
      engineRef.current.multiplayerSpawnPos = initialVec.clone();
      engineRef.current.vehiclePhysics.resetRace(initialVec);
    }

    // Lock everyone on the starting grid until the Host clicks START RACE
    clearGridCountdown();
    mpRacePhaseRef.current = 'waiting_start';
    setMpRacePhase('waiting_start');

    const hexColor = '#' + selectedCar.bodyColorHex.toString(16).padStart(6, '0');
    const mp = new MultiplayerRoomManager(
      cleanCode,
      mpUsername.trim() || 'Racer_' + Math.floor(Math.random() * 900 + 100),
      selectedCar.id,
      hexColor,
      mpTargetLapsRef.current
    );
    mpManagerRef.current = mp;

    let lastMpUiSync = 0;
    const syncList = () => {
      const list = mp.getOpponentsList();
      engineRef.current?.syncOpponents(list);
      const now = performance.now();
      if (now - lastMpUiSync > 200) {
        lastMpUiSync = now;
        setOpponents(list);
      }
    };

    const alignLocalGridSlot = () => {
      const slot = mp.getLocalGridPosition();
      const slotVec = new THREE.Vector3(slot[0], slot[1], slot[2]);
      if (engineRef.current) {
        engineRef.current.multiplayerSpawnPos = slotVec.clone();
        if (mpRacePhaseRef.current === 'waiting_start') {
          engineRef.current.vehiclePhysics.resetRace(slotVec);
        }
      }
    };

    mp.init(asHost, {
      onPlayerJoined: () => {
        const list = mp.getOpponentsList();
        engineRef.current?.syncOpponents(list);
        setOpponents(list);
        alignLocalGridSlot();
      },
      onPlayerLeft: () => {
        const list = mp.getOpponentsList();
        engineRef.current?.syncOpponents(list);
        setOpponents(list);
        alignLocalGridSlot();
      },
      onPlayerUpdate: syncList,
      onRoomReady: () => {
        setIsMpConnected(true);
        alignLocalGridSlot();
      },
      onStatusChange: (status, detail) => {
        setMpStatus(status);
        setMpStatusMsg(detail || '');
      },
      onRaceConfig: (targetLaps, _raceEpoch, hasRaceStarted) => {
        setMpTargetLaps(targetLaps);
        mpTargetLapsRef.current = targetLaps;
        if (hasRaceStarted && mpRacePhaseRef.current === 'waiting_start') {
          mpRacePhaseRef.current = 'racing';
          setMpRacePhase('racing');
        }
      },
      onRaceStartCountdown: (durationSec, targetLaps) => {
        setMpTargetLaps(targetLaps);
        mpTargetLapsRef.current = targetLaps;
        localRaceFinishedRef.current = false;
        setLocalRaceFinished(false);
        setDismissedPodium(false);
        setRaceResults([]);
        const slot = mp.getLocalGridPosition();
        const slotVec = new THREE.Vector3(slot[0], slot[1], slot[2]);
        if (engineRef.current) {
          engineRef.current.multiplayerSpawnPos = slotVec.clone();
          engineRef.current.vehiclePhysics.resetRace(slotVec);
        }
        mpRacePhaseRef.current = 'countdown';
        setMpRacePhase('countdown');
        startGridCountdown(durationSec || 10, () => {
          mpRacePhaseRef.current = 'racing';
          setMpRacePhase('racing');
        });
      },
      onRaceFinishUpdate: (results) => {
        setRaceResults(results);
        if (results.length === 1 && results[0].id === mp.localPlayerId) {
          soundRef.current?.playDriftChime();
          try {
            confetti({ particleCount: 95, spread: 75, origin: { y: 0.62 } });
          } catch {}
        }
      },
      onRaceRestart: (targetLaps) => {
        handleResetRaceState(targetLaps, 10);
      }
    });

    setIsMpConnected(true);
    setIsMpModalOpen(false);
  };

  const leaveMultiplayer = () => {
    clearGridCountdown();
    mpRacePhaseRef.current = 'idle';
    setMpRacePhase('idle');
    mpManagerRef.current?.destroy();
    mpManagerRef.current = null;
    if (engineRef.current) {
      engineRef.current.multiplayerSpawnPos = null;
    }
    setIsMpConnected(false);
    setIsMpHost(true);
    setMpStatus('waiting');
    setMpStatusMsg('');
    setRaceResults([]);
    localRaceFinishedRef.current = false;
    setLocalRaceFinished(false);
    setDismissedPodium(false);
    setOpponents([]);
    engineRef.current?.syncOpponents([]);
  };

  const copyMultiplayerInvite = () => {
    const cleanCode = (mpRoomCode || roomId).toUpperCase().trim() || roomId;
    const isLocal =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const host = isLocal && lanIp && lanIp !== 'localhost' ? lanIp : window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    const inviteUrl = `${window.location.protocol}//${host}${port}/?mp=${cleanCode}`;
    navigator.clipboard?.writeText(inviteUrl).catch(() => {});
    setCopiedMpInvite(true);
    setTimeout(() => setCopiedMpInvite(false), 2000);
  };

  // Smooth Keyboard Controls + ESC Pause Shortcut
  useEffect(() => {
    const keys: Record<string, boolean> = {};

    const DRIVING_KEYS = new Set([
      'KeyA', 'KeyD', 'KeyW', 'KeyS',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Space', 'KeyF', 'KeyN', 'KeyH'
    ]);

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') {
          setIsQrModalOpen(false);
          setIsMpModalOpen(false);
          setIsPauseOpen(false);
        }
        return;
      }

      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        if (isQrModalOpen) setIsQrModalOpen(false);
        else if (isMpModalOpen) setIsMpModalOpen(false);
        else setIsPauseOpen((prev) => !prev);
        return;
      }

      soundRef.current?.init();

      if (e.code === 'KeyC' && !e.repeat) {
        engineRef.current?.cycleCamera();
      } else if (e.code === 'KeyR' && !e.repeat) {
        engineRef.current?.resetCar();
      } else if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') && !e.repeat) {
        engineRef.current?.shiftGearUp();
      } else if ((e.code === 'ControlLeft' || e.code === 'ControlRight' || e.code === 'KeyQ') && !e.repeat) {
        engineRef.current?.shiftGearDown();
      }

      keys[e.code] = true;
      if (DRIVING_KEYS.has(e.code)) {
        updateKeyboard();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
      }
      keys[e.code] = false;
      if (DRIVING_KEYS.has(e.code)) {
        updateKeyboard();
      }
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
      const nitro = !!(keys['KeyF'] || keys['KeyN']);
      const horn = !!keys['KeyH'];

      const hasActiveDrivingKey = steer !== 0 || throttle > 0 || brake > 0 || handbrake || nitro || horn;
      const gyroStreamingRecently = performance.now() - lastGyroPacketTimeRef.current < 400;
      if (!hasActiveDrivingKey && gyroStreamingRecently) {
        return;
      }

      setActiveInputSource('keyboard');
      inputRef.current = {
        steer,
        throttle,
        brake,
        handbrake,
        nitro,
        reset: false,
        cameraSwitch: false,
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
  }, [isQrModalOpen, isMpModalOpen]);

  // Update selected car dynamically + propagate to Multiplayer
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setCar(selectedCar);
    }
    const hexColor = '#' + selectedCar.bodyColorHex.toString(16).padStart(6, '0');
    mpManagerRef.current?.updateLocalIdentity(selectedCar.id, hexColor);
  }, [selectedCar]);

  // Main Three.js Game Loop
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(canvasRef.current, selectedCar, settings);
    engineRef.current = engine;

    engine.onCrashCallback = (severity) => {
      soundRef.current?.playCrashImpact(severity);
    };

    engine.onDriftBankCallback = () => {
      soundRef.current?.playDriftChime();
    };

    engine.onGearShiftCallback = (isUpshift) => {
      soundRef.current?.playGearShift(isUpshift);
    };

    let lastTime = performance.now();
    let animationFrameId: number;
    let uiUpdateTimer = 0;
    let mpBroadcastTimer = 0;

    const gameLoop = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(gameLoop);

      const rawDelta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      const delta = isPauseRef.current ? 0.0001 : Math.min(0.05, rawDelta);

      const currentInput = { ...inputRef.current };

      if (isPauseRef.current) {
        engine.renderer.render(engine.scene, engine.camera);
        return;
      }

      if (currentInput.horn && !lastHornRef.current) {
        soundRef.current?.playHorn();
      }
      lastHornRef.current = !!currentInput.horn;

      const isCountdownLocked =
        mpRacePhaseRef.current === 'waiting_start' ||
        (countdownRef.current !== null && countdownRef.current !== 'GO!');

      const currentTelemetry = engine.update(delta, currentInput, isCountdownLocked);

      soundRef.current?.update(
        currentTelemetry.rpm,
        currentTelemetry.speedKmh,
        currentTelemetry.isDrifting,
        !isCountdownLocked && currentInput.nitro,
        currentInput.throttle,
        !!currentTelemetry.isOnCurb,
        currentInput.brake > 0.05
      );

      uiUpdateTimer += delta;
      if (uiUpdateTimer >= 0.04) {
        uiUpdateTimer = 0;
        setTelemetry(currentTelemetry);
        setIsLetterboxed(engine.isLetterboxed);
        setNearMissActive(engine.nearMissActive);
        setPlayerPos(engine.vehiclePhysics.position.clone());
        setPlayerHeading(engine.vehiclePhysics.getHeadingAngle());
        setTrafficStates(engine.trafficStates);

        hostRef.current?.sendFeedback({
          speedKmh: currentTelemetry.speedKmh,
          gear: currentTelemetry.gear,
          rpm: currentTelemetry.rpm
        });
      }

      // Detect Race Finish Line Victory in Multiplayer (when lap exceeds targetLaps!)
      if (
        mpManagerRef.current &&
        !localRaceFinishedRef.current &&
        (currentTelemetry.lap || 1) > mpTargetLapsRef.current
      ) {
        localRaceFinishedRef.current = true;
        setLocalRaceFinished(true);
        mpManagerRef.current.reportLocalFinish(currentTelemetry.raceTimeMs || currentTelemetry.lapTimeMs || 1000);
      }

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
          isNitro: currentInput.nitro,
          lap: currentTelemetry.lap || 1,
          trackProgress: currentTelemetry.trackProgress || 0
        });
      }
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    const handleResize = () => engine.handleResize();
    window.addEventListener('resize', handleResize);
    const resizeTarget = canvasRef.current?.parentElement || canvasRef.current;
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && resizeTarget
        ? new ResizeObserver(() => engine.handleResize())
        : null;
    if (resizeObserver && resizeTarget) {
      resizeObserver.observe(resizeTarget);
    }
    // Guarantee clean resize once layout settles
    const resizeTimer = setTimeout(handleResize, 50);

    return () => {
      clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      engine.dispose();
      mpManagerRef.current?.destroy();
    };
  }, []);

  const content = (
    <div
      className={
        isMobile
          ? 'relative w-full h-full overflow-hidden bg-[#0a0c12]'
          : 'relative w-screen h-[100dvh] overflow-hidden bg-[#0a0c12]'
      }
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* High-Speed Radial Warp */}
      {(telemetry.speedKmh > 155 || (inputRef.current.nitro && telemetry.nitroFuel > 0)) && (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden mix-blend-screen transition-opacity duration-200">
          <svg className="w-full h-full opacity-55" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            <defs>
              <radialGradient id="warpGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="65%" stopColor="rgba(0, 242, 254, 0.06)" />
                <stop offset="100%" stopColor="rgba(0, 242, 254, 0.35)" />
              </radialGradient>
            </defs>
            <rect width="1000" height="1000" fill="url(#warpGrad)" />
            <line x1="500" y1="500" x2="0" y2="80" stroke="#00f2fe" strokeWidth="3" strokeDasharray="50 120" />
            <line x1="500" y1="500" x2="0" y2="920" stroke="#00f2fe" strokeWidth="3" strokeDasharray="50 120" />
            <line x1="500" y1="500" x2="1000" y2="80" stroke="#00f2fe" strokeWidth="3" strokeDasharray="50 120" />
            <line x1="500" y1="500" x2="1000" y2="920" stroke="#00f2fe" strokeWidth="3" strokeDasharray="50 120" />
          </svg>
        </div>
      )}

      {/* Multiplayer Grid Hold — Host START RACE Control / Guest Waiting Status */}
      {isMpConnected && mpRacePhase === 'waiting_start' && !isMpModalOpen && (
        <div className="absolute top-12 sm:top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-auto select-none">
          {isMpHost ? (
            <div className="flex flex-col items-center space-y-2">
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleHostStartRace}
                className="px-7 sm:px-10 py-3 sm:py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 border-2 border-white/40 text-white font-display font-black text-base sm:text-xl uppercase tracking-widest shadow-[0_0_40px_rgba(16,185,129,0.55)] active:scale-95 transition-all flex items-center gap-2.5 animate-pulse"
              >
                <Flag className="w-5 h-5 sm:w-6 sm:h-6" />
                <span>START RACE</span>
              </button>
              <span className="px-3.5 py-1 rounded-full bg-black/75 border border-white/15 text-[10px] sm:text-xs font-mono text-gray-300 tracking-wider">
                {opponents.length > 0
                  ? `${opponents.length + 1} RACERS ON GRID • STARTS 10S COUNTDOWN`
                  : 'SHARE INVITE OR CLICK START FOR 10S COUNTDOWN'}
              </span>
            </div>
          ) : (
            <div className="px-5 py-2.5 rounded-2xl bg-black/80 border border-cyan-400/50 backdrop-blur-md text-center shadow-[0_0_25px_rgba(34,211,238,0.25)]">
              <div className="text-xs sm:text-sm font-display font-black text-cyan-300 tracking-widest uppercase animate-pulse">
                WAITING FOR HOST TO START RACE...
              </div>
              <div className="text-[10px] font-mono text-gray-400 mt-0.5">
                HOLD THROTTLE TO REV ENGINE ON GRID
              </div>
            </div>
          )}
        </div>
      )}

      {/* F1 Starting Gantry Countdown (Supports 3s Solo & 10s Multiplayer!) */}
      {countdown !== null && (
        <div className="absolute top-10 sm:top-16 left-1/2 -translate-x-1/2 scale-75 sm:scale-100 origin-top z-50 flex flex-col items-center pointer-events-none select-none">
          <div className="glass-panel px-6 py-3 rounded-3xl border-2 border-white/20 bg-black/85 shadow-[0_0_50px_rgba(0,0,0,0.95)] flex items-center space-x-3.5">
            {[1, 2, 3, 4, 5].map((lightIdx) => {
              const isGo = countdown === 'GO!';
              const numVal = typeof countdown === 'number' ? countdown : 0;
              const isRed =
                !isGo &&
                (numVal >= 5
                  ? lightIdx <= Math.ceil((11 - numVal) / 2)
                  : numVal === 4
                  ? lightIdx <= 3
                  : numVal === 3
                  ? lightIdx <= 4
                  : numVal === 2 || numVal === 1);
              return (
                <div
                  key={lightIdx}
                  className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 transition-all duration-150 ${
                    isGo
                      ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_35px_#10b981]'
                      : isRed
                      ? 'bg-rose-600 border-rose-400 shadow-[0_0_30px_#ef4444]'
                      : 'bg-zinc-900 border-zinc-700 shadow-inner'
                  }`}
                />
              );
            })}
          </div>

          <div className="mt-2.5 flex items-center gap-3 px-5 py-1.5 rounded-full bg-black/85 border border-white/15 backdrop-blur-md shadow-xl">
            <span
              className={`font-display font-black tracking-widest text-2xl sm:text-3xl uppercase drop-shadow ${
                countdown === 'GO!' ? 'text-emerald-400 animate-pulse' : 'text-amber-300'
              }`}
            >
              {countdown === 'GO!' ? 'GO!' : countdown}
            </span>
            <span
              className={`font-display font-bold tracking-widest text-xs sm:text-base uppercase ${
                countdown === 'GO!' ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {countdown === 'GO!'
                ? 'LIGHTS OUT & AWAY WE GO!'
                : typeof countdown === 'number' && countdown > 5
                ? 'RACE STARTING • WARM UP TIRES'
                : typeof countdown === 'number' && countdown > 1
                ? 'REV ENGINES • GET READY'
                : 'FINAL CHECK • LAUNCH READY'}
            </span>
          </div>
        </div>
      )}

      {/* Racing HUD */}
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
          onCameraClick={() => engineRef.current?.cycleCamera()}
          onPauseClick={() => setIsPauseOpen(true)}
        />
      )}

      {/* Mobile Touch & Gyro Controls */}
      {isMobile && (
        <MobileTouchControls
          onInputChange={(partialInput) => {
            soundRef.current?.init();
            if (partialInput.throttle !== undefined) inputRef.current.throttle = partialInput.throttle;
            if (partialInput.brake !== undefined) inputRef.current.brake = partialInput.brake;
            if (partialInput.handbrake !== undefined) inputRef.current.handbrake = partialInput.handbrake;
            if (partialInput.nitro !== undefined) inputRef.current.nitro = partialInput.nitro;
            if (partialInput.steer !== undefined) {
              inputRef.current.steer = partialInput.steer;
              if (partialInput.angleDegrees !== undefined) {
                inputRef.current.angleDegrees = partialInput.angleDegrees;
              }
              setActiveInputSource('gyro');
            }
          }}
          onCameraSwitch={() => {
            engineRef.current?.cycleCamera();
          }}
          onResetCar={() => {
            engineRef.current?.resetCar();
          }}
          onShiftUp={() => {
            soundRef.current?.init();
            engineRef.current?.shiftGearUp();
          }}
          onShiftDown={() => {
            soundRef.current?.init();
            engineRef.current?.shiftGearDown();
          }}
          gear={telemetry.gear}
          shouldShiftUp={telemetry.shouldShiftUp}
          onRecalibrateGyro={recalibrateMobileGyro}
          onOpenGarage={onOpenGarage}
          onOpenPause={() => setIsPauseOpen(true)}
          onSwitchToControllerMode={onSwitchToController}
          onSteerModeChange={(m) => {
            mobileSteerModeRef.current = m;
            inputRef.current.steer = 0;
            inputRef.current.angleDegrees = 0;
          }}
          needsGyroPermission={needsPermissionPrompt}
          onRequestGyroPermission={requestGyroPermission}
          isMuted={settings.isMuted}
          onToggleMute={toggleSound}
          currentAngleDegrees={mobileAngle}
          speedKmh={telemetry.speedKmh}
          hasGyroSignal={hasSensorSignal}
          isRotated90={isForceRotated90}
        />
      )}

      {/* Desktop Header Action Pills (Never steal Spacebar focus!) */}
      {!isMobile && (
        <div className="absolute top-3.5 left-4 z-40 flex items-center space-x-2">
          {onExit && (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.currentTarget.blur();
                soundRef.current?.playUiClick();
                onExit();
              }}
              onMouseEnter={() => soundRef.current?.playUiHover()}
              className="flex items-center space-x-1.5 hud-glass-capsule px-3 py-2 rounded-xl border border-white/15 text-xs font-bold font-racing uppercase tracking-wider text-gray-200 hover:text-white hover:bg-white/15 active:scale-95 transition-all pointer-events-auto shadow-lg"
              title="Return to Main Menu"
            >
              <span>← Menu</span>
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.currentTarget.blur();
              soundRef.current?.playUiClick();
              setIsQrModalOpen(true);
            }}
            onMouseEnter={() => soundRef.current?.playUiHover()}
            className="flex items-center space-x-1.5 hud-glass-capsule px-3 py-2 rounded-xl border border-cyan-500/35 text-xs font-bold font-racing uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/20 active:scale-95 transition-all pointer-events-auto shadow-lg"
          >
            <QrCode className="w-4 h-4 text-cyan-400" />
            <span>{isPhoneConnected ? 'Gyro Synced' : 'Phone Gyro'}</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.currentTarget.blur();
              soundRef.current?.playUiClick();
              onOpenGarage?.();
            }}
            onMouseEnter={() => soundRef.current?.playUiHover()}
            className="flex items-center space-x-1.5 hud-glass-capsule px-3 py-2 rounded-xl border border-amber-500/35 text-xs font-bold font-racing uppercase tracking-wider text-amber-300 hover:bg-amber-500/20 active:scale-95 transition-all pointer-events-auto shadow-lg"
          >
            <Warehouse className="w-4 h-4 text-amber-400" />
            <span>{selectedCar.name}</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.currentTarget.blur();
              soundRef.current?.playUiClick();
              setIsMpModalOpen(true);
            }}
            onMouseEnter={() => soundRef.current?.playUiHover()}
            className="flex items-center space-x-1.5 hud-glass-capsule px-3 py-2 rounded-xl border border-purple-500/35 text-xs font-bold font-racing uppercase tracking-wider text-purple-300 hover:bg-purple-500/20 active:scale-95 transition-all pointer-events-auto shadow-lg"
          >
            <Users className="w-4 h-4 text-purple-400" />
            <span>{isMpConnected ? `${mpRoomCode} (${opponents.length + 1})` : 'Multiplayer'}</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.currentTarget.blur();
              toggleSound();
            }}
            aria-label={settings.isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="p-2 hud-glass-capsule rounded-xl border border-white/15 text-gray-200 hover:text-white active:scale-95 transition-all pointer-events-auto shadow-lg"
            title={settings.isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {settings.isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>
        </div>
      )}

      {/* Live Multiplayer Race Hub (Rankings, Lap Target & Status) */}
      {isMpConnected && (() => {
        const localId = mpManagerRef.current?.localPlayerId || 'local';
        const localProgressScore = localRaceFinished
          ? 999 - (raceResults.find((r) => r.id === localId)?.rank || 1)
          : (telemetry.lap || 1) - 1 + (telemetry.trackProgress || 0);

        const racers = [
          {
            id: localId,
            label: `YOU (${selectedCar.name})`,
            color: '#22d3ee',
            speedKmh: telemetry.speedKmh,
            lap: telemetry.lap || 1,
            progressPct: Math.min(100, Math.round((telemetry.trackProgress || 0) * 100)),
            score: localProgressScore,
            isLocal: true,
            finishRank: raceResults.find((r) => r.id === localId)?.rank || null
          },
          ...opponents.map((opp) => ({
            id: opp.id,
            label: opp.username,
            color: opp.color || '#a855f7',
            speedKmh: opp.speedKmh,
            lap: opp.lap || 1,
            progressPct: Math.min(100, Math.round((opp.trackProgress || 0) * 100)),
            score:
              opp.finishedAtMs != null
                ? 999 - (raceResults.find((r) => r.id === opp.id)?.rank || 2)
                : (opp.lap || 1) - 1 + (opp.trackProgress || 0),
            isLocal: false,
            finishRank: raceResults.find((r) => r.id === opp.id)?.rank || null
          }))
        ].sort((a, b) => b.score - a.score);

        const winner = raceResults[0];

        return (
          <>
            {/* Opponent Won Banner while local player still finishing */}
            {winner && !localRaceFinished && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 hud-glass-capsule px-5 py-2 rounded-2xl border border-amber-400/60 bg-black/80 text-white font-racing flex items-center space-x-2.5 shadow-[0_0_25px_rgba(251,191,36,0.45)] animate-pulse pointer-events-none">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-display font-black uppercase tracking-wider text-amber-300">
                  {winner.username} WON IN {(winner.finishTimeMs / 1000).toFixed(2)}S! FINISH YOUR LAP!
                </span>
              </div>
            )}

            <div
              className={`absolute z-40 hud-glass-pod rounded-2xl border border-purple-500/40 text-white font-racing shadow-2xl pointer-events-auto ${
                isMobile
                  ? 'top-11 right-2 p-2 min-w-[165px] max-w-[195px]'
                  : 'top-14 right-4 p-3 min-w-[260px]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mb-1 border-b border-white/10 pb-1">
                <span className="flex items-center gap-1 text-purple-300 truncate">
                  <Globe className={`w-3 h-3 shrink-0 ${mpStatus === 'error' ? 'text-rose-400' : 'text-purple-400'}`} />
                  <span>{mpRoomCode} • {mpTargetLaps}L</span>
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={copyMultiplayerInvite}
                    className="text-[9px] sm:text-[10px] text-cyan-300 hover:text-cyan-200 font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30"
                    title="Copy multiplayer invite URL"
                  >
                    {copiedMpInvite ? 'COPIED' : 'INVITE'}
                  </button>
                  <button
                    onClick={leaveMultiplayer}
                    className="text-[9px] sm:text-[10px] text-rose-400 hover:text-rose-300 font-mono px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/30"
                  >
                    LEAVE
                  </button>
                </div>
              </div>

              {mpStatusMsg && (
                <div
                  className={`text-[9px] sm:text-[10px] font-mono mb-1 px-1.5 py-0.5 rounded truncate ${
                    mpStatus === 'error'
                      ? 'bg-rose-500/20 text-rose-300'
                      : mpStatus === 'connected'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-white/5 text-gray-300'
                  }`}
                >
                  {mpStatusMsg}
                </div>
              )}

              <div className="space-y-1">
                {racers.map((r, idx) => (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between text-[10px] sm:text-xs py-0.5 sm:py-1 px-1.5 sm:px-2 rounded-lg border ${
                      r.isLocal
                        ? 'bg-cyan-500/15 border-cyan-500/35'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <span className="font-bold flex items-center gap-1.5 truncate max-w-[115px] sm:max-w-[165px] text-white">
                      <span className="text-[9px] font-mono px-1 rounded bg-black/50 text-amber-300">
                        #{r.finishRank || idx + 1}
                      </span>
                      <span
                        className="w-2 h-2 rounded-full shrink-0 border border-white/40"
                        style={{ backgroundColor: r.color }}
                      />
                      <span className="truncate">{r.label}</span>
                    </span>
                    <span className="font-mono text-[10px] sm:text-[11px] text-gray-200">
                      {r.finishRank ? 'FIN' : `${r.speedKmh} KM/H`}
                    </span>
                  </div>
                ))}

                {opponents.length === 0 && (
                  <div className="text-[9px] sm:text-[10px] text-gray-400 italic pt-0.5 px-1 text-center font-mono">
                    Share INVITE link — waiting for friends...
                  </div>
                )}

                {isMpHost && mpRacePhase === 'racing' && opponents.length > 0 && (
                  <button
                    onClick={() => mpManagerRef.current?.requestRaceRestart(mpTargetLaps)}
                    className="w-full mt-1 py-1 sm:py-1.5 bg-gradient-to-r from-amber-500/25 to-cyan-500/25 hover:from-amber-500/40 hover:to-cyan-500/40 border border-amber-400/50 text-amber-200 rounded-lg text-[9px] sm:text-[10px] font-display font-bold uppercase tracking-wider flex items-center justify-center gap-1"
                    title="Reset all racers to start grid for a synchronized 10s countdown race start"
                  >
                    <Flag className="w-3 h-3" />
                    <span>RESTART 10S RACE</span>
                  </button>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {/* MULTIPLAYER RACE VICTORY / FINISH PODIUM OVERLAY */}
      {isMpConnected && localRaceFinished && !dismissedPodium && (() => {
        const localId = mpManagerRef.current?.localPlayerId || 'local';
        const myEntry = raceResults.find((r) => r.id === localId);
        const myRank = myEntry?.rank || 1;
        const winnerTime = raceResults[0]?.finishTimeMs || myEntry?.finishTimeMs || 0;

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Race Finish Results"
            className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
          >
            <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-amber-400/50 max-w-md w-full max-h-[94%] overflow-y-auto text-white font-racing relative shadow-[0_0_50px_rgba(251,191,36,0.25)] text-center my-auto">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-gradient-to-br from-amber-400/30 to-cyan-500/30 border border-amber-400/50">
                {myRank === 1 ? (
                  <Trophy className="w-9 h-9 text-amber-300 animate-bounce" />
                ) : (
                  <Flag className="w-9 h-9 text-cyan-300" />
                )}
              </div>

              <h3 className="text-3xl font-display font-black uppercase tracking-wider text-white">
                {myRank === 1 ? '1ST PLACE • YOU WIN!' : `${myRank}${myRank === 2 ? 'ND' : myRank === 3 ? 'RD' : 'TH'} PLACE • FINISHED!`}
              </h3>
              <p className="text-xs font-mono text-gray-300 mt-1 mb-4">
                ROOM {mpRoomCode} • {mpTargetLaps} LAP{mpTargetLaps > 1 ? 'S' : ''} • TIME {(myEntry ? myEntry.finishTimeMs / 1000 : 0).toFixed(2)}S
              </p>

              <div className="space-y-2 mb-5 text-left">
                {raceResults.map((entry) => {
                  const isMe = entry.id === localId;
                  const gapSec = ((entry.finishTimeMs - winnerTime) / 1000).toFixed(2);
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
                        isMe
                          ? 'bg-cyan-500/20 border-cyan-400/60'
                          : 'bg-black/45 border-white/10'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className={`font-display font-black text-base ${entry.rank === 1 ? 'text-amber-300' : 'text-gray-300'}`}>
                          #{entry.rank}
                        </span>
                        <span className="text-sm font-bold" style={{ color: isMe ? '#67e8f9' : entry.color }}>
                          {isMe ? `${mpUsername} (YOU)` : entry.username}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-gray-200">
                        {entry.rank === 1 ? `${(entry.finishTimeMs / 1000).toFixed(2)}s` : `+${gapSec}s`}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDismissedPodium(true)}
                  className="py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-xs font-bold uppercase tracking-wider"
                >
                  Continue Driving
                </button>
                <button
                  onClick={() => {
                    if (isMpHost) {
                      mpManagerRef.current?.requestRaceRestart(mpTargetLaps);
                    } else {
                      handleResetRaceState(mpTargetLaps);
                    }
                  }}
                  className="py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 rounded-xl text-xs font-bold uppercase tracking-wider"
                >
                  {isMpHost ? 'New Race (All)' : 'Reset Grid'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PAUSE & LIVE TUNING MENU MODAL */}
      {isPauseOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Race Pause and Settings"
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
        >
          <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-cyan-500/40 max-w-md w-full max-h-[94%] overflow-y-auto text-white font-racing relative shadow-2xl my-auto">
            <button
              onClick={() => setIsPauseOpen(false)}
              aria-label="Resume game"
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-display font-bold text-white mb-1 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" /> RACE PAUSED & SETTINGS
            </h3>
            <p className="text-xs text-gray-400 mb-4 font-mono">
              Lap {telemetry.lap || 1} • Score {(telemetry.totalScore || 0).toLocaleString()} PTS
            </p>

            <div className="space-y-3.5 mb-5">
              {/* Graphics Preset */}
              <div>
                <span className="text-[11px] uppercase font-bold text-gray-300 block mb-1.5 font-mono">
                  GRAPHICS QUALITY
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['ultra', 'high', 'medium'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => onUpdateSettings?.({ graphicsQuality: q })}
                      className={`py-1.5 rounded-xl text-xs font-bold uppercase font-mono border transition-all ${
                        settings.graphicsQuality === q
                          ? 'bg-cyan-500 text-black border-cyan-400'
                          : 'bg-black/40 text-gray-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gyro Sensitivity */}
              <div>
                <div className="flex items-center justify-between text-[11px] uppercase font-bold text-gray-300 mb-1 font-mono">
                  <label htmlFor="pause-gyro-sens">GYRO STEER SENSITIVITY</label>
                  <span className="text-cyan-400">{settings.gyroSensitivity.toFixed(1)}x</span>
                </div>
                <input
                  id="pause-gyro-sens"
                  type="range"
                  min={0.7}
                  max={2.0}
                  step={0.1}
                  value={settings.gyroSensitivity}
                  onChange={(e) =>
                    onUpdateSettings?.({ gyroSensitivity: parseFloat(e.target.value) })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Quick Tools */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    engineRef.current?.resetCar();
                    setIsPauseOpen(false);
                  }}
                  className="py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1.5 border border-white/10"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
                  <span>Reset Car</span>
                </button>
                <button
                  onClick={() => {
                    setIsPauseOpen(false);
                    setIsMpModalOpen(true);
                  }}
                  className="py-2 bg-purple-600/30 hover:bg-purple-600/45 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1.5 border border-purple-500/40 text-purple-200"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Multiplayer</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col space-y-2">
              <button
                onClick={() => setIsPauseOpen(false)}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-display font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" /> RESUME RACE
              </button>

              {!isMobile && onExit && (
                <button
                  onClick={onExit}
                  className="w-full py-2 bg-white/5 hover:bg-rose-500/20 text-gray-300 hover:text-rose-200 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  <Home className="w-3.5 h-3.5" /> EXIT TO MAIN MENU
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Code Connect Modal */}
      {isQrModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pair Gyro Controller"
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
        >
          <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-cyan-500/40 max-w-md w-full max-h-[94%] overflow-y-auto text-white text-center font-racing relative shadow-2xl my-auto">
            <button
              onClick={() => setIsQrModalOpen(false)}
              aria-label="Close QR Modal"
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-display font-bold text-cyan-300 mb-1 flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5 text-cyan-400" /> PAIR GYRO CONTROLLER
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Scan with your phone&apos;s camera (same Wi-Fi) to turn your phone into a physical tilt steering wheel!
            </p>

            <div className="bg-white p-3.5 rounded-2xl shadow-xl flex flex-col items-center justify-center mb-3">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="w-52 h-52 rounded-lg select-none block" />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-gray-500 text-xs font-mono">
                  Generating High-Contrast QR...
                </div>
              )}
            </div>

            <div className="flex items-center justify-between bg-cyan-950/50 border border-cyan-500/40 p-2.5 rounded-xl mb-3">
              <span className="text-xs text-cyan-200 font-bold uppercase tracking-wider">
                PAIRING CODE:
              </span>
              <span className="font-mono font-extrabold text-lg text-cyan-300 tracking-widest bg-black/80 px-3 py-0.5 rounded border border-cyan-500/50">
                {roomId}
              </span>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-lg p-2.5 mb-3 text-left">
              <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 mb-1">
                <span className="flex items-center gap-1 text-cyan-400">
                  <Wifi className="w-3 h-3" /> Controller Link:
                </span>
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
              {httpsPort !== null && (
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/10 text-[10px] font-mono">
                  <span className="text-gray-400">
                    {preferHttpsQr ? 'First open: Advanced → Proceed (for Gyro)' : 'HTTP mode (Drag wheel if gyro blocked)'}
                  </span>
                  <button
                    onClick={() => setPreferHttpsQr((prev) => !prev)}
                    className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold"
                  >
                    {preferHttpsQr ? 'HTTPS (GYRO)' : 'HTTP'}
                  </button>
                </div>
              )}
            </div>

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
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-bold uppercase text-xs tracking-wider"
            >
              RESUME RACING
            </button>
          </div>
        </div>
      )}

      {/* Multiplayer Lobby Modal (Responsive 2-Column Compact Fit for Mobile Landscape!) */}
      {isMpModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Multiplayer Racing Lobby"
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
        >
          <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-purple-500/40 max-w-xl w-full max-h-[94%] overflow-y-auto text-white font-racing relative shadow-2xl my-auto">
            <button
              onClick={() => setIsMpModalOpen(false)}
              aria-label="Close Multiplayer Modal"
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2 mb-1">
              <Globe className="w-5 h-5 text-purple-400 shrink-0" />
              <h3 className="text-lg sm:text-xl font-display font-bold text-white uppercase">
                Multiplayer Racing Lobby
              </h3>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-400 mb-3 sm:mb-4">
              Race side-by-side in real-time on the 12.5 KM Grand Circuit via P2P WebRTC.
            </p>

            <div
              className={`grid ${
                isForceRotated90 ? 'grid-cols-2 gap-2.5' : 'grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'
              } items-start`}
            >
              <div className="space-y-2.5 sm:space-y-3">
                <div>
                  <label htmlFor="mp-username" className="text-[10px] sm:text-[11px] uppercase font-bold text-gray-400 block mb-1">
                    Driver Name
                  </label>
                  <input
                    id="mp-username"
                    type="text"
                    maxLength={16}
                    value={mpUsername}
                    onChange={(e) => setMpUsername(e.target.value)}
                    className="w-full bg-black/50 border border-white/20 rounded-xl px-3.5 py-1.5 sm:py-2 text-sm font-display font-bold text-white tracking-wider focus:outline-none focus:border-purple-400"
                    placeholder="Enter your racer tag"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="mp-roomcode" className="text-[10px] sm:text-[11px] uppercase font-bold text-gray-400">
                      Room Code
                    </label>
                    <button
                      type="button"
                      onClick={() => setMpRoomCode(roomId)}
                      className="text-[10px] text-cyan-400 hover:underline font-mono"
                    >
                      Default ({roomId})
                    </button>
                  </div>
                  <input
                    id="mp-roomcode"
                    type="text"
                    maxLength={6}
                    value={mpRoomCode}
                    onChange={(e) => setMpRoomCode(e.target.value.toUpperCase())}
                    className="w-full bg-black/50 border border-white/20 rounded-xl px-3.5 py-2 text-base sm:text-lg font-display font-bold text-cyan-300 tracking-widest text-center focus:outline-none focus:border-cyan-400 uppercase"
                  />
                </div>
              </div>

              <div className="space-y-2.5 sm:space-y-3">
                <div>
                  <span className="text-[10px] sm:text-[11px] uppercase font-bold text-gray-400 block mb-1">
                    Race Laps (Host)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((laps) => (
                      <button
                        key={laps}
                        type="button"
                        onClick={() => setMpTargetLaps(laps)}
                        className={`py-1.5 rounded-xl text-xs font-bold font-mono uppercase border transition-all ${
                          mpTargetLaps === laps
                            ? 'bg-purple-500 text-white border-purple-300 shadow-lg'
                            : 'bg-black/40 text-gray-400 border-white/10 hover:text-white'
                        }`}
                      >
                        {laps} Lap{laps > 1 ? 's' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => startMultiplayer(true)}
                    className="py-2.5 sm:py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-display font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95"
                  >
                    Host Room
                  </button>
                  <button
                    type="button"
                    onClick={() => startMultiplayer(false)}
                    className="py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-display font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95"
                  >
                    Join Room
                  </button>
                </div>

                <button
                  type="button"
                  onClick={copyMultiplayerInvite}
                  className="w-full py-2 bg-white/10 hover:bg-white/15 border border-cyan-500/30 text-cyan-300 rounded-xl text-[11px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  {copiedMpInvite ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMpInvite ? `INVITE COPIED (${mpRoomCode})!` : `COPY INVITE (${mpRoomCode})`}</span>
                </button>

                {isMpConnected && (
                  <button
                    type="button"
                    onClick={leaveMultiplayer}
                    className="w-full py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-bold uppercase tracking-wider"
                  >
                    Disconnect ({mpRoomCode})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <MobileOrientationGuard
        onSwitchToController={onSwitchToController}
        onRequestGyroPermission={requestGyroPermission}
        onForceRotatedChange={setIsForceRotated90}
        isMultiplayerInvite={initialOpenMultiplayer}
      >
        {content}
      </MobileOrientationGuard>
    );
  }

  return content;
};
