import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';
import { WebRTCController } from '../../services/webrtc';
import { ControllerInput } from '../../types';
import {
  RotateCcw,
  Zap,
  Flame,
  Maximize,
  Compass,
  Smartphone,
  Camera,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  AlertTriangle
} from 'lucide-react';

interface MobileControllerProps {
  roomId: string;
}

interface PhysicalWheelProps {
  angleDegrees: number;
  speedKmh: number;
  gear: number | string;
  rpm: number;
  size?: number;
  onHonk?: () => void;
  isHonking?: boolean;
  isRotated90?: boolean;
  onTouchDragSteer?: (steerNorm: number | null, deg: number | null) => void;
}

const PhysicalWheel: React.FC<PhysicalWheelProps> = ({
  angleDegrees,
  speedKmh,
  gear,
  rpm,
  size = 240,
  onHonk,
  isHonking = false,
  isRotated90 = false,
  onTouchDragSteer
}) => {
  const activeLeds = Math.min(10, Math.max(0, Math.floor(((rpm - 1500) / 7000) * 10)));
  const isRedline = rpm >= 7400;
  const dragPointerRef = useRef<number | null>(null);
  const dragStartAxisRef = useRef<number>(0);
  const didDragRef = useRef<boolean>(false);

  const handleWheelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onTouchDragSteer) return;
    dragPointerRef.current = e.pointerId;
    dragStartAxisRef.current = isRotated90 ? e.clientY : e.clientX;
    didDragRef.current = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleWheelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragPointerRef.current !== e.pointerId || !onTouchDragSteer) return;
    const axis = isRotated90 ? e.clientY : e.clientX;
    const deltaPx = axis - dragStartAxisRef.current;
    if (Math.abs(deltaPx) > 7) {
      didDragRef.current = true;
    }
    if (didDragRef.current) {
      const clampedNorm = Math.max(-1, Math.min(1, deltaPx / (size * 0.48)));
      onTouchDragSteer(Number(clampedNorm.toFixed(3)), Math.round(clampedNorm * 75));
    }
  };

  const handleWheelPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragPointerRef.current === e.pointerId) {
      dragPointerRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      if (didDragRef.current) {
        didDragRef.current = false;
        onTouchDragSteer?.(null, null);
      }
    }
  };

  return (
    <div
      onPointerDown={handleWheelPointerDown}
      onPointerMove={handleWheelPointerMove}
      onPointerUp={handleWheelPointerEnd}
      onPointerCancel={handleWheelPointerEnd}
      className="relative flex items-center justify-center select-none touch-none"
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-full pointer-events-none transition-opacity duration-200"
        style={{
          boxShadow: `0 0 40px ${
            isRedline
              ? 'rgba(244, 63, 94, 0.35)'
              : Math.abs(angleDegrees) > 10
              ? 'rgba(0, 242, 254, 0.28)'
              : 'rgba(255, 255, 255, 0.08)'
          }`
        }}
      />

      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
        viewBox="0 0 240 240"
      >
        <circle
          cx="120"
          cy="120"
          r="112"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="2"
          strokeDasharray="4 8"
        />
        <line x1="120" y1="2" x2="120" y2="12" stroke="#00f2fe" strokeWidth="3" />
        <line x1="38" y1="38" x2="45" y2="45" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
        <line x1="202" y1="38" x2="195" y2="45" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
        <line x1="8" y1="120" x2="18" y2="120" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
        <line x1="232" y1="120" x2="222" y2="120" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
      </svg>

      {/* THE ROTATING GT3 WHEEL */}
      <div
        className="relative w-full h-full rounded-full flex items-center justify-center will-change-transform"
        style={{
          transform: `rotate(${angleDegrees}deg)`,
          transformOrigin: 'center center',
          boxShadow:
            '0 18px 45px rgba(0,0,0,0.95), inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -4px 8px rgba(0,0,0,0.9)'
        }}
      >
        <div
          className="absolute inset-0 rounded-full border-[20px] border-[#181a20]"
          style={{
            boxShadow: 'inset 0 0 12px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.85)'
          }}
        />

        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-[20px] bg-cyan-400 rounded-sm shadow-[0_0_12px_#00f2fe] z-20" />

        <div className="absolute left-[18px] top-1/2 -translate-y-1/2 w-[56px] h-[34px] bg-gradient-to-r from-[#2a2d36] to-[#1c1e24] rounded-l-md border-t border-b border-white/10 flex items-center justify-center shadow-lg">
          <div className="w-7 h-3 rounded-full bg-[#121418] border border-white/5" />
        </div>
        <div className="absolute right-[18px] top-1/2 -translate-y-1/2 w-[56px] h-[34px] bg-gradient-to-l from-[#2a2d36] to-[#1c1e24] rounded-r-md border-t border-b border-white/10 flex items-center justify-center shadow-lg">
          <div className="w-7 h-3 rounded-full bg-[#121418] border border-white/5" />
        </div>
        <div className="absolute bottom-[18px] left-1/2 -translate-x-1/2 w-[34px] h-[54px] bg-gradient-to-t from-[#2a2d36] to-[#1c1e24] rounded-b-md border-l border-r border-white/10 flex flex-col items-center justify-center shadow-lg">
          <div className="w-3 h-7 rounded-full bg-[#121418] border border-white/5" />
        </div>

        {/* Central Horn & Telemetry Hub */}
        <button
          type="button"
          onClick={() => {
            if (!didDragRef.current) onHonk?.();
          }}
          aria-label="Honk Supercar Horn"
          className={`relative rounded-full flex flex-col items-center justify-center border-2 p-2 text-center shadow-2xl z-10 cursor-pointer active:scale-95 transition-all duration-75 ${
            isHonking
              ? 'border-amber-400 ring-4 ring-amber-400/40 shadow-[0_0_25px_#f59e0b]'
              : isRedline
              ? 'border-rose-400/80 ring-2 ring-rose-500/40'
              : 'border-white/20 hover:border-cyan-400/60'
          }`}
          style={{
            width: size * 0.62,
            height: size * 0.62,
            background: isHonking
              ? 'radial-gradient(circle at 40% 40%, #2e2612 0%, #1c1608 75%, #0f0c05 100%)'
              : 'radial-gradient(circle at 40% 40%, #1f232b 0%, #121419 75%, #0a0b0d 100%)'
          }}
        >
          <div className="flex items-center space-x-1 mb-1 px-2 py-0.5 bg-black/60 rounded-full border border-white/10">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => {
              const isActive = idx < activeLeds;
              let color = '#10b981';
              if (idx >= 4 && idx < 7) color = '#f59e0b';
              if (idx >= 7) color = '#ef4444';

              return (
                <div
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-75 ${
                    isRedline && isActive ? 'animate-ping' : ''
                  }`}
                  style={{
                    backgroundColor: isActive ? color : 'rgba(255,255,255,0.08)',
                    boxShadow: isActive ? `0 0 6px ${color}` : 'none'
                  }}
                />
              );
            })}
          </div>

          <div className="text-2xl font-display font-black tracking-tight text-cyan-300 leading-none">
            {speedKmh}
          </div>
          <div className="text-[9px] font-mono tracking-widest text-gray-400 uppercase leading-none mt-0.5">
            KM/H
          </div>

          <div className="flex items-center justify-center space-x-1.5 my-0.5">
            <span className="text-[10px] text-gray-500 font-mono">SEMI</span>
            <span className={`text-lg font-display font-black leading-none ${isRedline ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`}>
              {gear}
            </span>
          </div>

          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400 leading-none">
            {isHonking
              ? 'HORN!'
              : isRedline && gear !== 6 && gear !== 'R'
              ? 'SHIFT UP ▲'
              : angleDegrees === 0
              ? '● CENTER'
              : angleDegrees > 0
              ? `▶ +${Math.abs(angleDegrees)}°`
              : `◀ -${Math.abs(angleDegrees)}°`}
          </div>
          <span className="text-[8px] text-gray-500 uppercase tracking-widest font-mono mt-0.5">
            TAP FOR HORN
          </span>
        </button>
      </div>
    </div>
  );
};

export const MobileController: React.FC<MobileControllerProps> = ({ roomId }) => {
  const [forceLandscapeView, setForceLandscapeView] = useState<boolean>(false);
  const [preferPortraitMode, setPreferPortraitMode] = useState<boolean>(false);
  const [vpSize, setVpSize] = useState<{ w: number; h: number }>(() =>
    typeof window !== 'undefined'
      ? { w: window.innerWidth, h: window.innerHeight }
      : { w: 390, h: 844 }
  );

  useEffect(() => {
    const syncVp = () => setVpSize({ w: window.innerWidth, h: window.innerHeight });
    syncVp();
    window.addEventListener('resize', syncVp);
    window.addEventListener('orientationchange', syncVp);
    document.addEventListener('fullscreenchange', syncVp);
    return () => {
      window.removeEventListener('resize', syncVp);
      window.removeEventListener('orientationchange', syncVp);
      document.removeEventListener('fullscreenchange', syncVp);
    };
  }, []);

  const {
    steerNormalized,
    angleDegrees,
    isPermissionGranted,
    needsPermissionPrompt,
    isLandscape,
    wakeLockActive,
    hasSensorSignal,
    isSecureContext,
    requestPermission,
    recalibrate
  } = useDeviceOrientation(1.2, forceLandscapeView);

  const isRotated90 = forceLandscapeView && !isLandscape;

  // Automatically clear CSS horizontal rotation if device rotates to real hardware landscape
  useEffect(() => {
    if (isLandscape && forceLandscapeView) {
      setForceLandscapeView(false);
    }
  }, [isLandscape, forceLandscapeView]);

  const [currentRoomId] = useState<string>(roomId);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [ping, setPing] = useState<number>(0);
  const [hostTelemetry, setHostTelemetry] = useState<{
    speedKmh: number;
    gear: number | string;
    rpm: number;
  }>({
    speedKmh: 0,
    gear: 1,
    rpm: 850
  });

  const [throttle, setThrottle] = useState<number>(0);
  const [brake, setBrake] = useState<number>(0);
  const [handbrake, setHandbrake] = useState<boolean>(false);
  const [nitro, setNitro] = useState<boolean>(false);
  const [isHonking, setIsHonking] = useState<boolean>(false);
  const [touchSteerOverride, setTouchSteerOverride] = useState<{ norm: number; deg: number } | null>(null);
  const [sensorTimeoutElapsed, setSensorTimeoutElapsed] = useState<boolean>(false);

  const controllerRef = useRef<WebRTCController | null>(null);
  const throttleContainerRef = useRef<HTMLDivElement>(null);
  const brakeContainerRef = useRef<HTMLDivElement>(null);
  const activeThrottlePointerRef = useRef<number | null>(null);
  const activeBrakePointerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const inputRef = useRef<ControllerInput>({
    steer: 0,
    throttle: 0,
    brake: 0,
    handbrake: false,
    nitro: false,
    reset: false,
    cameraSwitch: false,
    horn: false,
    shiftUpSeq: 0,
    shiftDownSeq: 0,
    cameraSeq: 0,
    resetSeq: 0,
    angleDegrees: 0,
    timestamp: Date.now()
  });

  // Detect if hardware gyro isn't sending events within 1.8s (e.g. insecure HTTP origin or no gyro)
  useEffect(() => {
    if (!isPermissionGranted || hasSensorSignal) return;
    const t = setTimeout(() => setSensorTimeoutElapsed(true), 1800);
    return () => clearTimeout(t);
  }, [isPermissionGranted, hasSensorSignal]);

  const effectiveSteer = touchSteerOverride ? touchSteerOverride.norm : steerNormalized;
  const effectiveAngleDeg = touchSteerOverride ? touchSteerOverride.deg : angleDegrees;

  useEffect(() => {
    inputRef.current.steer = effectiveSteer;
    inputRef.current.angleDegrees = effectiveAngleDeg;
  }, [effectiveSteer, effectiveAngleDeg]);

  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  const triggerHaptic = (ms: number = 28) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(ms);
    }
  };

  const dispatchImmediateInput = useCallback(
    (overrides?: Partial<ControllerInput>) => {
      if (!controllerRef.current || !isConnected) return;
      const packet: ControllerInput = {
        ...inputRef.current,
        timestamp: Date.now(),
        ...overrides
      };
      controllerRef.current.sendInput(packet);
    },
    [isConnected]
  );

  // Monotonic WebRTC-safe Manual Paddle Shifts
  const handleShiftUp = useCallback(() => {
    triggerHaptic(32);
    const nextSeq = (inputRef.current.shiftUpSeq || 0) + 1;
    inputRef.current.shiftUpSeq = nextSeq;
    dispatchImmediateInput({ shiftUpSeq: nextSeq });
  }, [dispatchImmediateInput]);

  const handleShiftDown = useCallback(() => {
    triggerHaptic(32);
    const nextSeq = (inputRef.current.shiftDownSeq || 0) + 1;
    inputRef.current.shiftDownSeq = nextSeq;
    dispatchImmediateInput({ shiftDownSeq: nextSeq });
  }, [dispatchImmediateInput]);

  const sendOneShotAction = useCallback(
    (action: 'reset' | 'cameraSwitch') => {
      triggerHaptic(35);
      if (action === 'cameraSwitch') {
        const nextCamSeq = (inputRef.current.cameraSeq || 0) + 1;
        inputRef.current.cameraSeq = nextCamSeq;
        dispatchImmediateInput({ cameraSeq: nextCamSeq, cameraSwitch: true });
      } else {
        const nextResetSeq = (inputRef.current.resetSeq || 0) + 1;
        inputRef.current.resetSeq = nextResetSeq;
        dispatchImmediateInput({ resetSeq: nextResetSeq, reset: true });
      }
    },
    [dispatchImmediateInput]
  );

  const triggerHorn = useCallback(() => {
    setIsHonking(true);
    inputRef.current.horn = true;
    dispatchImmediateInput({ horn: true });
    triggerHaptic(45);

    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }
      const audioCtx = audioCtxRef.current;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(460, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (_) {}

    setTimeout(() => {
      setIsHonking(false);
      inputRef.current.horn = false;
      dispatchImmediateInput({ horn: false });
    }, 300);
  }, [dispatchImmediateInput]);

  useEffect(() => {
    const ctrl = new WebRTCController(currentRoomId);
    controllerRef.current = ctrl;

    ctrl.connect(
      (feedback) => setHostTelemetry(feedback),
      (connected) => setIsConnected(connected)
    );

    const pingCheck = setInterval(() => {
      setPing(ctrl.pingMs);
    }, 500);

    return () => {
      clearInterval(pingCheck);
      ctrl.destroy();
    };
  }, [currentRoomId]);

  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      if (controllerRef.current) {
        inputRef.current.timestamp = Date.now();
        controllerRef.current.sendInput(inputRef.current);
      }
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, [isConnected]);

  // Helper computes vertical pedal fill [0..1] cleanly even inside CSS rotate(90deg) cockpit
  const computePedalRatio = (e: React.PointerEvent<HTMLDivElement>, el: HTMLDivElement): number => {
    const rect = el.getBoundingClientRect();
    if (isRotated90) {
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    }
    return Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / Math.max(1, rect.height)));
  };

  const handleThrottlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    activeThrottlePointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ratio = computePedalRatio(e, e.currentTarget);
    const initial = ratio >= 0.55 ? 1.0 : Number(Math.max(0.15, Math.min(1.0, ratio * 1.15)).toFixed(2));
    setThrottle(initial);
    inputRef.current.throttle = initial;
    dispatchImmediateInput({ throttle: initial });
    triggerHaptic(20);
  };

  const handleThrottlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeThrottlePointerRef.current !== e.pointerId || !throttleContainerRef.current) return;
    const ratio = computePedalRatio(e, throttleContainerRef.current);
    const rounded = Number((ratio >= 0.88 ? 1.0 : Math.min(1.0, Math.max(0.05, ratio * 1.12))).toFixed(2));
    setThrottle(rounded);
    inputRef.current.throttle = rounded;
    dispatchImmediateInput({ throttle: rounded });
  };

  const handleThrottlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeThrottlePointerRef.current === e.pointerId) {
      activeThrottlePointerRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
      setThrottle(0);
      inputRef.current.throttle = 0;
      dispatchImmediateInput({ throttle: 0 });
    }
  };

  const handleBrakePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    activeBrakePointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ratio = computePedalRatio(e, e.currentTarget);
    const initial = ratio >= 0.55 ? 1.0 : Number(Math.max(0.15, Math.min(1.0, ratio * 1.15)).toFixed(2));
    setBrake(initial);
    inputRef.current.brake = initial;
    dispatchImmediateInput({ brake: initial });
    triggerHaptic(20);
  };

  const handleBrakePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeBrakePointerRef.current !== e.pointerId || !brakeContainerRef.current) return;
    const ratio = computePedalRatio(e, brakeContainerRef.current);
    const rounded = Number((ratio >= 0.88 ? 1.0 : Math.min(1.0, Math.max(0.05, ratio * 1.12))).toFixed(2));
    setBrake(rounded);
    inputRef.current.brake = rounded;
    dispatchImmediateInput({ brake: rounded });
  };

  const handleBrakePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeBrakePointerRef.current === e.pointerId) {
      activeBrakePointerRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
      setBrake(0);
      inputRef.current.brake = 0;
      dispatchImmediateInput({ brake: 0 });
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const requestFullscreenLandscape = () => {
    triggerHaptic(40);
    // 1. Grant motion/gyro permissions synchronously within tap gesture
    requestPermission().catch(() => {});

    // 2. IMMEDIATELY enter Horizontal Cockpit synchronously (NEVER block on hanging Promise!)
    // If OS rotates natively to hardware landscape, `useEffect` auto-clears `forceLandscapeView`.
    if (window.innerWidth <= window.innerHeight) {
      setForceLandscapeView(true);
      setPreferPortraitMode(false);
    }

    // 3. Request browser fullscreen + native hardware orientation lock in background
    try {
      const el = document.documentElement as any;
      const fsPromise: Promise<void> | undefined = el.requestFullscreen
        ? el.requestFullscreen({ navigationUI: 'hide' }).catch(() => el.requestFullscreen())
        : el.webkitRequestFullscreen
        ? Promise.resolve(el.webkitRequestFullscreen())
        : undefined;

      Promise.resolve(fsPromise)
        .then(() => {
          const ori = window.screen?.orientation as any;
          if (ori?.lock) {
            return ori.lock('landscape').catch(() => ori.lock('landscape-primary'));
          }
        })
        .catch(() => {});
    } catch (_) {}

    setTimeout(() => recalibrate(), 180);
  };

  const handleWheelDragSteer = useCallback((norm: number | null, deg: number | null) => {
    if (norm === null || deg === null) {
      setTouchSteerOverride(null);
    } else {
      setTouchSteerOverride({ norm, deg });
    }
  }, []);

  const shouldShiftUp = hostTelemetry.rpm >= 7300 && hostTelemetry.gear !== 6 && hostTelemetry.gear !== 'R';

  if (needsPermissionPrompt && !isPermissionGranted) {
    return (
      <div className="fixed inset-0 bg-[#08090C] z-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="glass-panel p-8 rounded-2xl max-w-md w-full border border-cyan-500/30">
          <Zap className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold font-display text-white mb-2">START YOUR ENGINE</h2>
          <p className="text-gray-300 text-sm mb-6">
            Tap below to calibrate and grant access to the phone&apos;s gyroscope motion sensors for steering.
          </p>
          <button
            onClick={requestPermission}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold font-display text-lg rounded-xl shadow-lg shadow-cyan-500/25 transition-all transform active:scale-95"
          >
            ACTIVATE GYRO WHEEL
          </button>
        </div>
      </div>
    );
  }

  if (!isLandscape && !forceLandscapeView && !preferPortraitMode) {
    return (
      <div className="fixed inset-0 bg-[#08090C] z-40 flex flex-col justify-between p-5 text-center select-none text-white font-racing">
        <div className="flex items-center justify-between glass-panel px-4 py-2.5 rounded-xl border border-white/10">
          <div className="flex items-center space-x-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-xs uppercase tracking-wider text-gray-300 font-bold">
              {isConnected ? `${ping}ms SYNCED` : 'CONNECTING...'}
            </span>
          </div>
          <span className="text-xs font-mono text-cyan-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">
            ROOM: {currentRoomId}
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto my-4">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full bg-cyan-500/10 border-2 border-cyan-400/40 flex items-center justify-center animate-pulse">
              <RotateCcw className="w-12 h-12 text-cyan-400 animate-spin-slow" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-[#12151c] p-1.5 rounded-full border border-cyan-400 shadow-lg">
              <Smartphone className="w-5 h-5 text-cyan-300" />
            </div>
          </div>

          <h2 className="text-2xl font-bold font-display tracking-wide text-white mb-2">
            ROTATE TO LANDSCAPE
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed mb-6 px-2">
            Hold your phone horizontally with two hands like a GT3 paddle-shift steering wheel for ultra-low latency control.
          </p>

          <button
            onClick={requestFullscreenLandscape}
            className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 via-sky-500 to-purple-600 text-white font-bold font-display text-base tracking-wider uppercase rounded-2xl shadow-xl shadow-cyan-500/30 transition-all transform active:scale-95 flex items-center justify-center space-x-2 border border-cyan-300/40"
          >
            <Maximize className="w-5 h-5" />
            <span>ENTER LANDSCAPE COCKPIT</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic(25);
              requestPermission().catch(() => {});
              setForceLandscapeView(true);
              setTimeout(() => recalibrate(), 120);
            }}
            className="w-full mt-3 py-3 px-4 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-bold uppercase tracking-wider text-cyan-300 border border-white/10 transition-all"
          >
            FORCE HORIZONTAL VIEW (IF AUTO-ROTATE LOCKED)
          </button>
        </div>

        <div className="pt-2 border-t border-white/10">
          <button
            onClick={() => {
              triggerHaptic(20);
              requestPermission().catch(() => {});
              setPreferPortraitMode(true);
            }}
            className="text-xs text-gray-400 hover:text-white underline underline-offset-4 tracking-wider"
          >
            Or tap here to drive in Portrait Wheel mode
          </button>
        </div>
      </div>
    );
  }

  // PORTRAIT MODE CONTROLLER WITH F1 PADDLE SHIFTERS
  if (!isLandscape && !forceLandscapeView && preferPortraitMode) {
    return (
      <div className="fixed inset-0 bg-[#08090C] flex flex-col justify-between p-3 select-none overflow-hidden text-white font-racing touch-none">
        <div className="flex items-center justify-between glass-panel px-3 py-2 rounded-xl border border-white/10">
          <div className="flex items-center space-x-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-xs uppercase tracking-wider text-gray-300 font-bold">
              {isConnected ? `${ping}ms SYNCED` : 'CONNECTING...'}
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={recalibrate}
              className="flex items-center space-x-1 px-2.5 py-1 bg-white/10 active:bg-cyan-500/30 rounded-lg text-[11px] font-bold uppercase tracking-wider"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>Center</span>
            </button>

            <button
              onClick={() => {
                setPreferPortraitMode(false);
                setForceLandscapeView(true);
              }}
              className="flex items-center space-x-1 px-2.5 py-1 bg-cyan-500/20 border border-cyan-500/40 rounded-lg text-[11px] font-bold text-cyan-300 uppercase tracking-wider"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Landscape</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-around glass-panel py-2 px-4 rounded-xl border border-white/5 my-1 text-center">
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-mono">Speed</div>
            <div className="text-2xl font-display font-black text-cyan-300">
              {hostTelemetry.speedKmh} <span className="text-xs font-normal text-gray-400">KM/H</span>
            </div>
          </div>
          <div className="w-[1px] h-8 bg-white/10" />
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-mono">Gear</div>
            <div className={`text-2xl font-display font-black ${shouldShiftUp ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`}>
              {hostTelemetry.gear}
            </div>
          </div>
          <div className="w-[1px] h-8 bg-white/10" />
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-mono">Steering</div>
            <div className="text-2xl font-display font-black text-purple-300">{Math.abs(effectiveAngleDeg)}°</div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center my-1 relative">
          <PhysicalWheel
            angleDegrees={effectiveAngleDeg}
            speedKmh={hostTelemetry.speedKmh}
            gear={hostTelemetry.gear}
            rpm={hostTelemetry.rpm}
            size={215}
            onHonk={triggerHorn}
            isHonking={isHonking}
            isRotated90={false}
            onTouchDragSteer={handleWheelDragSteer}
          />

          {/* Ergonomic Portrait Paddle Shifters + Nitro */}
          <div className="w-full flex items-center justify-between space-x-2 mt-2.5 px-1">
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                handleShiftDown();
              }}
              className="px-3.5 py-2.5 bg-amber-500/20 active:bg-amber-500/45 border border-amber-400/50 rounded-xl text-xs font-black text-amber-300 uppercase flex items-center space-x-1 touch-none"
            >
              <ChevronDown className="w-4 h-4" />
              <span>GEAR -</span>
            </button>

            <button
              onClick={() => sendOneShotAction('cameraSwitch')}
              className="p-2.5 bg-white/10 active:bg-white/20 rounded-xl text-gray-200 border border-white/10"
              aria-label="Switch Camera"
            >
              <Camera className="w-4 h-4" />
            </button>

            <button
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                setNitro(true);
                inputRef.current.nitro = true;
                dispatchImmediateInput({ nitro: true });
                triggerHaptic(50);
              }}
              onPointerUp={() => {
                setNitro(false);
                inputRef.current.nitro = false;
                dispatchImmediateInput({ nitro: false });
              }}
              onPointerCancel={() => {
                setNitro(false);
                inputRef.current.nitro = false;
                dispatchImmediateInput({ nitro: false });
              }}
              className={`flex-1 py-2.5 rounded-xl font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-1 transition-all transform active:scale-95 border touch-none ${
                nitro
                  ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-xl border-cyan-300'
                  : 'bg-gradient-to-r from-purple-900/60 to-cyan-900/60 text-cyan-300 border-purple-500/40'
              }`}
            >
              <Flame className="w-4 h-4 text-cyan-300 animate-pulse" />
              <span>NITRO</span>
            </button>

            <button
              onPointerDown={(e) => {
                e.preventDefault();
                handleShiftUp();
              }}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center space-x-1 border touch-none transition-all ${
                shouldShiftUp
                  ? 'bg-rose-600 border-cyan-300 text-white animate-pulse shadow-[0_0_20px_#00f2fe]'
                  : 'bg-cyan-500/20 active:bg-cyan-500/45 border-cyan-400/50 text-cyan-300'
              }`}
            >
              <ChevronUp className="w-4 h-4" />
              <span>GEAR +</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between space-x-2 my-1 px-1">
          <div
            ref={brakeContainerRef}
            onPointerDown={handleBrakePointerDown}
            onPointerMove={handleBrakePointerMove}
            onPointerUp={handleBrakePointerUp}
            onPointerCancel={handleBrakePointerUp}
            className="flex-1 h-28 glass-panel rounded-2xl relative overflow-hidden flex flex-col justify-end p-1 border border-rose-500/40 cursor-pointer shadow-lg touch-none"
          >
            <div
              className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-xl transition-all duration-75"
              style={{ height: `${Math.round(brake * 100)}%` }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs uppercase font-black tracking-widest text-white drop-shadow">BRAKE</span>
              <span className="text-sm font-display font-bold text-rose-300">{Math.round(brake * 100)}%</span>
            </div>
          </div>

          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              setHandbrake(true);
              inputRef.current.handbrake = true;
              dispatchImmediateInput({ handbrake: true });
              triggerHaptic(40);
            }}
            onPointerUp={() => {
              setHandbrake(false);
              inputRef.current.handbrake = false;
              dispatchImmediateInput({ handbrake: false });
            }}
            onPointerCancel={() => {
              setHandbrake(false);
              inputRef.current.handbrake = false;
              dispatchImmediateInput({ handbrake: false });
            }}
            className={`w-20 h-28 rounded-2xl font-display font-bold text-xs uppercase tracking-wider transition-all transform active:scale-95 border flex flex-col items-center justify-center touch-none ${
              handbrake
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/50 border-rose-300'
                : 'bg-white/10 text-gray-300 border-white/10'
            }`}
          >
            <span className="text-[10px] text-gray-400">DRIFT</span>
            <span className="font-black text-sm">
              HAND
              <br />
              BRAKE
            </span>
          </button>

          <div
            ref={throttleContainerRef}
            onPointerDown={handleThrottlePointerDown}
            onPointerMove={handleThrottlePointerMove}
            onPointerUp={handleThrottlePointerUp}
            onPointerCancel={handleThrottlePointerUp}
            className="flex-1 h-28 glass-panel rounded-2xl relative overflow-hidden flex flex-col justify-end p-1 border border-cyan-500/40 cursor-pointer shadow-lg touch-none"
          >
            <div
              className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-xl transition-all duration-75"
              style={{ height: `${Math.round(throttle * 100)}%` }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs uppercase font-black tracking-widest text-white drop-shadow">GAS</span>
              <span className="text-sm font-display font-bold text-cyan-200">{Math.round(throttle * 100)}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // FULL-SCREEN LANDSCAPE COCKPIT WITH F1 CARBON PADDLE SHIFTERS FLANKING THE WHEEL
  const containerStyle: React.CSSProperties = isRotated90
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: `${vpSize.h}px`,
        height: `${vpSize.w}px`,
        transform: 'rotate(90deg) translateY(-100%)',
        transformOrigin: 'top left',
        overflow: 'hidden',
        zIndex: 50
      }
    : {};

  return (
    <div
      style={containerStyle}
      className={`${isRotated90 ? '' : 'fixed inset-0 z-50 '}bg-[#08090C] flex flex-col justify-between p-3 select-none overflow-hidden text-white font-racing touch-none`}
    >
      <div className="flex items-center justify-between glass-panel px-4 py-2 rounded-xl border border-white/10 z-20">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-xs uppercase tracking-wider text-gray-300 font-bold">
              {isConnected ? `${ping}ms SYNCED` : 'CONNECTING...'}
            </span>
          </div>
          <span className="text-[11px] text-cyan-300 font-mono bg-white/10 px-2 py-0.5 rounded border border-white/10">
            ROOM: {currentRoomId}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {!hasSensorSignal && sensorTimeoutElapsed && (
            <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono text-amber-300">
              <AlertTriangle className="w-3 h-3" />
              <span>{isSecureContext ? 'NO GYRO SENSOR • DRAG WHEEL' : 'HTTPS REQ FOR GYRO • DRAG WHEEL'}</span>
            </span>
          )}

          <button
            onClick={recalibrate}
            className="flex items-center space-x-1 px-3 py-1 bg-white/10 active:bg-cyan-500/30 rounded-lg text-xs font-bold uppercase tracking-wider"
            title="Recalibrate Neutral Wheel Position"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Center</span>
          </button>

          {forceLandscapeView && (
            <button
              onClick={() => setForceLandscapeView(false)}
              className="px-2.5 py-1 bg-white/10 active:bg-white/20 rounded-lg text-xs text-gray-300 uppercase tracking-wider"
            >
              Reset Rot
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            aria-label="Toggle Fullscreen"
            className="p-1.5 bg-white/10 active:bg-white/20 rounded-lg"
          >
            <Maximize className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-between my-2 relative px-2 z-10">
        {/* Left Hand: Brake + Handbrake */}
        <div className="flex flex-col items-center justify-between h-full w-24 sm:w-28 py-1">
          <div
            ref={brakeContainerRef}
            onPointerDown={handleBrakePointerDown}
            onPointerMove={handleBrakePointerMove}
            onPointerUp={handleBrakePointerUp}
            onPointerCancel={handleBrakePointerUp}
            className="w-24 h-40 sm:h-44 glass-panel rounded-2xl relative overflow-hidden flex flex-col justify-end p-1 border border-rose-500/40 cursor-pointer shadow-lg touch-none"
          >
            <div
              className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-xl transition-all duration-75"
              style={{ height: `${Math.round(brake * 100)}%` }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs uppercase font-bold tracking-widest text-white/90 drop-shadow">BRAKE</span>
              <span className="text-lg font-display font-bold text-rose-300">{Math.round(brake * 100)}%</span>
            </div>
          </div>

          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              setHandbrake(true);
              inputRef.current.handbrake = true;
              dispatchImmediateInput({ handbrake: true });
              triggerHaptic(40);
            }}
            onPointerUp={() => {
              setHandbrake(false);
              inputRef.current.handbrake = false;
              dispatchImmediateInput({ handbrake: false });
            }}
            onPointerCancel={() => {
              setHandbrake(false);
              inputRef.current.handbrake = false;
              dispatchImmediateInput({ handbrake: false });
            }}
            className={`w-24 py-3 mt-2 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-all transform active:scale-95 border touch-none ${
              handbrake
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/50 border-rose-300'
                : 'bg-white/10 text-gray-300 border-white/10'
            }`}
          >
            HANDBRAKE
          </button>
        </div>

        {/* Center Cockpit: LEFT F1 PADDLE (-)  +  STEERING WHEEL  +  RIGHT F1 PADDLE (+) */}
        <div className="flex-1 flex flex-col items-center justify-center px-2">
          <div className="flex items-center justify-center space-x-3 sm:space-x-5">
            {/* Authentic Left Reverse/Downshift Paddle */}
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                handleShiftDown();
              }}
              aria-label="Paddle Shift Down"
              className="w-16 sm:w-20 h-32 rounded-2xl border border-amber-500/45 bg-gradient-to-b from-zinc-900/90 to-black/90 active:bg-amber-500/35 active:scale-95 transition-all flex flex-col items-center justify-center shadow-xl touch-none"
            >
              <ChevronDown className="w-7 h-7 text-amber-400" />
              <span className="text-[11px] font-display font-black text-amber-300 tracking-wider mt-1">
                GEAR -
              </span>
              <span className="text-[9px] font-mono text-gray-400">
                {hostTelemetry.gear === 'N' ? '→ R' : hostTelemetry.gear === 1 ? '→ N/R' : 'AUTO ▼'}
              </span>
            </button>

            <PhysicalWheel
              angleDegrees={effectiveAngleDeg}
              speedKmh={hostTelemetry.speedKmh}
              gear={hostTelemetry.gear}
              rpm={hostTelemetry.rpm}
              size={215}
              onHonk={triggerHorn}
              isHonking={isHonking}
              isRotated90={isRotated90}
              onTouchDragSteer={handleWheelDragSteer}
            />

            {/* Authentic Right Upshift Paddle */}
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                handleShiftUp();
              }}
              aria-label="Paddle Shift Up"
              className={`w-16 sm:w-20 h-32 rounded-2xl border active:scale-95 transition-all flex flex-col items-center justify-center shadow-xl touch-none ${
                shouldShiftUp
                  ? 'bg-gradient-to-b from-rose-600/90 to-cyan-600/80 border-cyan-300 text-white animate-pulse shadow-[0_0_25px_rgba(0,242,254,0.85)]'
                  : 'border-cyan-500/45 bg-gradient-to-b from-zinc-900/90 to-black/90 active:bg-cyan-500/35 text-cyan-300'
              }`}
            >
              <ChevronUp className={`w-7 h-7 ${shouldShiftUp ? 'text-white' : 'text-cyan-400'}`} />
              <span className="text-[11px] font-display font-black tracking-wider mt-1">
                GEAR +
              </span>
              <span className="text-[9px] font-mono opacity-80">
                {shouldShiftUp ? 'SHIFT!' : 'UP'}
              </span>
            </button>
          </div>

          <div className="flex items-center space-x-3 mt-2">
            <button
              onClick={() => sendOneShotAction('cameraSwitch')}
              className="px-3.5 py-1.5 bg-white/10 active:bg-white/20 rounded-lg text-xs font-bold text-gray-300 uppercase tracking-wider border border-white/10 flex items-center space-x-1"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>CAM (C)</span>
            </button>
            <button
              onClick={() => sendOneShotAction('reset')}
              className="px-3.5 py-1.5 bg-white/10 active:bg-rose-500/30 rounded-lg text-xs font-bold text-rose-300 uppercase tracking-wider border border-white/10 flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>RESET (R)</span>
            </button>
          </div>
        </div>

        {/* Right Hand: Gas + Nitro */}
        <div className="flex flex-col items-center justify-between h-full w-24 sm:w-28 py-1">
          <div
            ref={throttleContainerRef}
            onPointerDown={handleThrottlePointerDown}
            onPointerMove={handleThrottlePointerMove}
            onPointerUp={handleThrottlePointerUp}
            onPointerCancel={handleThrottlePointerUp}
            className="w-24 h-40 sm:h-44 glass-panel rounded-2xl relative overflow-hidden flex flex-col justify-end p-1 border border-cyan-500/40 cursor-pointer shadow-lg touch-none"
          >
            <div
              className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-xl transition-all duration-75"
              style={{ height: `${Math.round(throttle * 100)}%` }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs uppercase font-bold tracking-widest text-white/90 drop-shadow">GAS</span>
              <span className="text-lg font-display font-bold text-cyan-200">{Math.round(throttle * 100)}%</span>
            </div>
          </div>

          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              setNitro(true);
              inputRef.current.nitro = true;
              dispatchImmediateInput({ nitro: true });
              triggerHaptic(50);
            }}
            onPointerUp={() => {
              setNitro(false);
              inputRef.current.nitro = false;
              dispatchImmediateInput({ nitro: false });
            }}
            onPointerCancel={() => {
              setNitro(false);
              inputRef.current.nitro = false;
              dispatchImmediateInput({ nitro: false });
            }}
            className={`w-24 py-3 mt-2 rounded-xl font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-1 transition-all transform active:scale-95 border touch-none ${
              nitro
                ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-xl shadow-purple-500/60 border-cyan-300'
                : 'bg-gradient-to-r from-purple-900/60 to-cyan-900/60 text-cyan-300 border-purple-500/40'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
            <span>NITRO</span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500 px-2 font-mono z-10">
        <span className={hasSensorSignal ? 'text-emerald-400' : 'text-amber-400'}>
          {hasSensorSignal
            ? `GYRO: LIVE${wakeLockActive ? ' • WAKELOCK' : ''}`
            : !isSecureContext && sensorTimeoutElapsed
            ? 'GYRO LOCKED ON HTTP (USE HTTPS QR OR DRAG WHEEL)'
            : 'GYRO: READY (TILT OR DRAG WHEEL)'}
        </span>
        <span>STEER: {effectiveSteer.toFixed(2)}</span>
      </div>
    </div>
  );
};
