import React, { useState, useEffect, useRef } from 'react';
import {
  Flame,
  Camera,
  RefreshCw,
  Compass,
  Maximize,
  Volume2,
  VolumeX,
  Warehouse,
  Gamepad2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Smartphone,
  Sliders,
  Zap
} from 'lucide-react';
import { ControllerInput } from '../../types';

interface MobileTouchControlsProps {
  onInputChange: (input: Partial<ControllerInput>) => void;
  onCameraSwitch: () => void;
  onResetCar: () => void;
  onShiftUp?: () => void;
  onShiftDown?: () => void;
  gear?: number | string;
  shouldShiftUp?: boolean;
  onRecalibrateGyro: () => void;
  onOpenGarage?: () => void;
  onOpenPause?: () => void;
  onSwitchToControllerMode?: () => void;
  onSteerModeChange?: (mode: 'gyro' | 'touch') => void;
  needsGyroPermission?: boolean;
  onRequestGyroPermission?: () => Promise<boolean>;
  isMuted?: boolean;
  onToggleMute?: () => void;
  currentAngleDegrees?: number;
  speedKmh?: number;
  hasGyroSignal?: boolean;
  isRotated90?: boolean;
}

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  onInputChange,
  onCameraSwitch,
  onResetCar,
  onShiftUp,
  onShiftDown,
  gear = 1,
  shouldShiftUp = false,
  onRecalibrateGyro,
  onOpenGarage,
  onOpenPause,
  onSwitchToControllerMode,
  onSteerModeChange,
  needsGyroPermission = false,
  onRequestGyroPermission,
  isMuted = false,
  onToggleMute,
  currentAngleDegrees = 0,
  speedKmh = 0,
  hasGyroSignal = true,
  isRotated90 = false
}) => {
  const [throttle, setThrottle] = useState<number>(0);
  const [brake, setBrake] = useState<number>(0);
  const [handbrake, setHandbrake] = useState<boolean>(false);
  const [nitro, setNitro] = useState<boolean>(false);

  const [steerMode, setSteerMode] = useState<'gyro' | 'touch'>('gyro');
  const [touchSteerDirection, setTouchSteerDirection] = useState<'left' | 'right' | 'center'>('center');
  const [showSteerTip, setShowSteerTip] = useState<boolean>(true);
  const [gyroTimeoutWarn, setGyroTimeoutWarn] = useState<boolean>(false);

  useEffect(() => {
    if (hasGyroSignal) {
      setGyroTimeoutWarn(false);
      return;
    }
    const t = setTimeout(() => setGyroTimeoutWarn(true), 1800);
    return () => clearTimeout(t);
  }, [hasGyroSignal]);

  const activeThrottlePointerId = useRef<number | null>(null);
  const activeBrakePointerId = useRef<number | null>(null);
  const throttleContainerRef = useRef<HTMLDivElement>(null);
  const brakeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowSteerTip(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (speedKmh > 10 && showSteerTip) {
      setShowSteerTip(false);
    }
  }, [speedKmh, showSteerTip]);

  const triggerHaptic = (ms: number = 22) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(ms);
    }
  };

  const handleThrottlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    activeThrottlePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setThrottle(1.0);
    onInputChange({ throttle: 1.0 });
    triggerHaptic(22);
  };

  const handleThrottlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeThrottlePointerId.current !== e.pointerId || !throttleContainerRef.current) return;
    const rect = throttleContainerRef.current.getBoundingClientRect();
    const ratio = isRotated90
      ? Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)))
      : Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / Math.max(1, rect.height)));
    const scaled = Math.min(1.0, Math.max(0.25, ratio * 1.25));
    const rounded = Number(scaled.toFixed(2));
    setThrottle(rounded);
    onInputChange({ throttle: rounded });
  };

  const handleThrottlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeThrottlePointerId.current === e.pointerId) {
      activeThrottlePointerId.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
      setThrottle(0);
      onInputChange({ throttle: 0 });
    }
  };

  const handleBrakePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    activeBrakePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setBrake(1.0);
    onInputChange({ brake: 1.0 });
    triggerHaptic(22);
  };

  const handleBrakePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeBrakePointerId.current !== e.pointerId || !brakeContainerRef.current) return;
    const rect = brakeContainerRef.current.getBoundingClientRect();
    const ratio = isRotated90
      ? Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)))
      : Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / Math.max(1, rect.height)));
    const rounded = Number(ratio.toFixed(2));
    setBrake(rounded);
    onInputChange({ brake: rounded });
  };

  const handleBrakePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeBrakePointerId.current === e.pointerId) {
      activeBrakePointerId.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
      setBrake(0);
      onInputChange({ brake: 0 });
    }
  };

  const handleTouchSteer = (direction: 'left' | 'right' | 'center') => {
    setTouchSteerDirection(direction);
    if (direction === 'left') {
      onInputChange({ steer: -1.0, angleDegrees: -45 });
      triggerHaptic(18);
    } else if (direction === 'right') {
      onInputChange({ steer: 1.0, angleDegrees: 45 });
      triggerHaptic(18);
    } else {
      onInputChange({ steer: 0, angleDegrees: 0 });
    }
  };

  const toggleFullscreen = () => {
    triggerHaptic(25);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-30 font-racing flex flex-col justify-between p-2.5 sm:p-3 touch-none">
      {/* Top Mobile Quick Actions Bar */}
      <div className="flex items-center justify-between pointer-events-auto">
        <div className="flex items-center space-x-1.5">
          {onOpenGarage && (
            <button
              onClick={() => {
                triggerHaptic(25);
                onOpenGarage();
              }}
              aria-label="Open Car Garage"
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-950/75 backdrop-blur-md border border-white/25 text-[11px] text-white active:bg-cyan-500/30 transition-all shadow-lg"
            >
              <Warehouse className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold tracking-wider">GARAGE</span>
            </button>
          )}

          <button
            onClick={() => {
              triggerHaptic(25);
              const nextMode = steerMode === 'gyro' ? 'touch' : 'gyro';
              setSteerMode(nextMode);
              onSteerModeChange?.(nextMode);
              handleTouchSteer('center');
              setShowSteerTip(true);
              setTimeout(() => setShowSteerTip(false), 3000);
            }}
            aria-label="Toggle Gyro Tilt or Touch Arrows"
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl backdrop-blur-md border text-[11px] font-bold transition-all shadow-lg ${
              steerMode === 'gyro'
                ? 'bg-purple-950/80 border-purple-400/60 text-purple-200'
                : 'bg-cyan-950/80 border-cyan-400/60 text-cyan-200'
            }`}
          >
            {steerMode === 'gyro' ? (
              <>
                <Smartphone className="w-3.5 h-3.5 text-purple-300" />
                <span>GYRO</span>
              </>
            ) : (
              <>
                <Gamepad2 className="w-3.5 h-3.5 text-cyan-300" />
                <span>TOUCH</span>
              </>
            )}
          </button>

          {steerMode === 'gyro' && needsGyroPermission && onRequestGyroPermission && (
            <button
              onClick={() => {
                triggerHaptic(30);
                onRequestGyroPermission();
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-cyan-500 text-black font-black text-[11px] animate-pulse shadow-lg"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>ENABLE GYRO</span>
            </button>
          )}

          {steerMode === 'gyro' && !needsGyroPermission && gyroTimeoutWarn && !hasGyroSignal && (
            <button
              onClick={() => {
                triggerHaptic(25);
                setSteerMode('touch');
                onSteerModeChange?.('touch');
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-amber-500/25 border border-amber-400/60 text-amber-200 font-bold text-[10px] shadow-lg"
            >
              <span>NO GYRO → TOUCH</span>
            </button>
          )}

          {steerMode === 'gyro' && !needsGyroPermission && (!gyroTimeoutWarn || hasGyroSignal) && (
            <button
              onClick={() => {
                triggerHaptic(25);
                onRecalibrateGyro();
              }}
              aria-label="Recalibrate Gyro Center"
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-950/75 backdrop-blur-md border border-white/25 text-[11px] text-cyan-300 active:bg-cyan-500/30 transition-all shadow-lg"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-bold tracking-wider">CENTER</span>
            </button>
          )}
        </div>

        {/* Center Live Steering Angle Indicator */}
        <div className="px-3 py-1 rounded-full bg-slate-950/75 backdrop-blur-md border border-white/20 text-[11px] font-mono tracking-wider text-purple-200 flex items-center space-x-1.5 shadow-md">
          <span className="text-gray-400 uppercase text-[9px]">STEER</span>
          <span className="font-bold">
            {steerMode === 'touch'
              ? touchSteerDirection === 'left'
                ? '◀ LEFT'
                : touchSteerDirection === 'right'
                ? 'RIGHT ▶'
                : '● CENTER'
              : currentAngleDegrees === 0
              ? '● CENTER'
              : currentAngleDegrees > 0
              ? `▶ +${Math.abs(currentAngleDegrees)}°`
              : `◀ -${Math.abs(currentAngleDegrees)}°`}
          </span>
        </div>

        {/* Right Utility Icons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => {
              triggerHaptic(22);
              onCameraSwitch();
            }}
            aria-label="Switch Camera"
            className="p-1.5 rounded-xl bg-slate-950/75 backdrop-blur-md border border-white/25 text-white active:bg-white/25 transition-all shadow-lg"
          >
            <Camera className="w-4 h-4 text-cyan-300" />
          </button>

          <button
            onClick={() => {
              triggerHaptic(22);
              onResetCar();
            }}
            aria-label="Reset Car on Track"
            className="p-1.5 rounded-xl bg-slate-950/75 backdrop-blur-md border border-white/25 text-white active:bg-rose-500/30 transition-all shadow-lg"
          >
            <RefreshCw className="w-4 h-4 text-rose-300" />
          </button>

          {onToggleMute && (
            <button
              onClick={() => {
                triggerHaptic(20);
                onToggleMute();
              }}
              aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              className="p-1.5 rounded-xl bg-slate-950/75 backdrop-blur-md border border-white/25 text-white active:bg-white/25 transition-all shadow-lg"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            aria-label="Toggle Fullscreen"
            className="p-1.5 rounded-xl bg-slate-950/75 backdrop-blur-md border border-white/25 text-white active:bg-white/25 transition-all shadow-lg"
          >
            <Maximize className="w-4 h-4 text-gray-200" />
          </button>

          {onOpenPause && (
            <button
              onClick={() => {
                triggerHaptic(25);
                onOpenPause();
              }}
              aria-label="Open Settings & Multiplayer Menu"
              className="p-1.5 rounded-xl bg-slate-950/75 backdrop-blur-md border border-white/25 text-cyan-300 active:bg-white/25 transition-all shadow-lg"
            >
              <Sliders className="w-4 h-4" />
            </button>
          )}

          {onSwitchToControllerMode && (
            <button
              onClick={() => {
                triggerHaptic(25);
                onSwitchToControllerMode();
              }}
              aria-label="Switch to PC Controller Mode"
              className="p-1.5 rounded-xl bg-cyan-950/80 backdrop-blur-md border border-cyan-400/50 text-cyan-300 active:bg-cyan-500/40 transition-all shadow-lg"
              title="Pair with PC"
            >
              <Gamepad2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Transient Steering Tip */}
      {showSteerTip && (
        <div className="self-center pointer-events-none mt-1">
          <span className="text-[10px] font-mono tracking-widest text-cyan-200 uppercase bg-slate-950/70 px-3 py-1 rounded-full backdrop-blur-md border border-cyan-500/30 shadow">
            {steerMode === 'gyro'
              ? 'TILT TO STEER • TAP GEAR + TO UPSHIFT (AUTO DOWN)'
              : 'ARROWS TO STEER • TAP GEAR + TO UPSHIFT (AUTO DOWN)'}
          </span>
        </div>
      )}

      {/* Bottom Pedals + Integrated Manual Paddle Shifters Cockpit */}
      <div className="flex items-end justify-between pointer-events-none pb-1 px-0.5 mt-auto">
        {/* Left: Optional Touch Arrows + Brake + (Gear Down Paddle stacked directly above Slide Drift) */}
        <div className="flex items-end space-x-2 pointer-events-auto">
          {steerMode === 'touch' && (
            <div className="flex items-center space-x-1.5 mr-0.5">
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  handleTouchSteer('left');
                }}
                onPointerUp={() => handleTouchSteer('center')}
                onPointerCancel={() => handleTouchSteer('center')}
                aria-label="Steer Left"
                className={`w-14 h-24 rounded-2xl border flex flex-col items-center justify-center backdrop-blur-md transition-all active:scale-95 shadow-xl touch-none ${
                  touchSteerDirection === 'left'
                    ? 'bg-cyan-500/70 border-cyan-300 shadow-[0_0_25px_#00f2fe]'
                    : 'bg-slate-950/55 border-white/25 text-white'
                }`}
              >
                <ChevronLeft className="w-7 h-7 text-cyan-300" />
                <span className="text-[9px] font-bold">LEFT</span>
              </button>

              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  handleTouchSteer('right');
                }}
                onPointerUp={() => handleTouchSteer('center')}
                onPointerCancel={() => handleTouchSteer('center')}
                aria-label="Steer Right"
                className={`w-14 h-24 rounded-2xl border flex flex-col items-center justify-center backdrop-blur-md transition-all active:scale-95 shadow-xl touch-none ${
                  touchSteerDirection === 'right'
                    ? 'bg-cyan-500/70 border-cyan-300 shadow-[0_0_25px_#00f2fe]'
                    : 'bg-slate-950/55 border-white/25 text-white'
                }`}
              >
                <ChevronRight className="w-7 h-7 text-cyan-300" />
                <span className="text-[9px] font-bold">RIGHT</span>
              </button>
            </div>
          )}

          {/* Brake Pedal */}
          <div
            ref={brakeContainerRef}
            onPointerDown={handleBrakePointerDown}
            onPointerMove={handleBrakePointerMove}
            onPointerUp={handleBrakePointerUp}
            onPointerCancel={handleBrakePointerUp}
            role="button"
            aria-label="Brake Pedal"
            className={`w-20 sm:w-24 md:w-28 h-32 sm:h-36 md:h-44 rounded-3xl relative overflow-hidden flex flex-col justify-end p-2 border transition-all duration-100 cursor-pointer shadow-2xl backdrop-blur-md touch-none ${
              brake > 0.05
                ? 'bg-rose-950/60 border-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.55)]'
                : 'bg-slate-950/40 border-white/25 hover:border-white/40'
            }`}
          >
            <div
              className="w-full bg-gradient-to-t from-rose-600/85 via-rose-500/60 to-amber-400/40 rounded-2xl transition-all duration-75"
              style={{ height: `${Math.max(10, Math.round(brake * 100))}%` }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-between py-3 pointer-events-none">
              <div className="w-8 h-1 rounded-full bg-white/30" />
              <div className="flex flex-col items-center">
                <span className="text-xs uppercase font-black tracking-widest text-white drop-shadow">
                  BRAKE
                </span>
                <span className="text-base font-display font-black text-rose-300 drop-shadow">
                  {Math.round(brake * 100)}%
                </span>
              </div>
              <div className="w-8 h-1 rounded-full bg-white/30" />
            </div>
          </div>

          {/* Left Column: GEAR DOWN Paddle stacked cleanly above SLIDE DRIFT */}
          <div className="flex flex-col items-center space-y-1.5">
            {onShiftDown && (
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  triggerHaptic(28);
                  onShiftDown();
                }}
                aria-label="Shift Gear Down"
                className="w-16 sm:w-[72px] md:w-20 h-12 sm:h-14 rounded-2xl font-display font-black uppercase tracking-wider transition-all transform active:scale-95 border border-amber-400/50 bg-slate-950/65 hover:bg-amber-500/25 active:bg-amber-500/45 text-amber-300 flex flex-col items-center justify-center backdrop-blur-md shadow-xl touch-none"
              >
                <div className="flex items-center space-x-0.5 leading-none">
                  <span className="text-[10px] font-mono">GEAR</span>
                  <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="text-[10px] font-mono text-gray-300 leading-tight">
                  {gear === 'N' ? '→ R' : gear === 1 ? '→ N/R' : 'AUTO ▼'}
                </span>
              </button>
            )}

            <button
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                setHandbrake(true);
                onInputChange({ handbrake: true });
                triggerHaptic(35);
              }}
              onPointerUp={() => {
                setHandbrake(false);
                onInputChange({ handbrake: false });
              }}
              onPointerCancel={() => {
                setHandbrake(false);
                onInputChange({ handbrake: false });
              }}
              className={`w-16 sm:w-[72px] md:w-20 h-20 sm:h-24 rounded-2xl font-display font-black text-xs uppercase tracking-wider transition-all transform active:scale-95 border flex flex-col items-center justify-center backdrop-blur-md shadow-xl touch-none px-1.5 sm:px-2 ${
                handbrake
                  ? 'bg-rose-600/80 text-white shadow-[0_0_28px_rgba(244,63,94,0.7)] border-rose-300'
                  : 'bg-slate-950/45 text-rose-200 border-rose-500/45 active:bg-rose-500/50'
              }`}
            >
              <span className="text-[9px] text-rose-300 font-mono">SLIDE</span>
              <span className="text-xs tracking-widest font-black leading-tight">DRIFT</span>
            </button>
          </div>
        </div>

        {/* Right: (Gear Up Paddle stacked directly above NITRO) + Gas Pedal */}
        <div className="flex items-end space-x-2 pointer-events-auto">
          <div className="flex flex-col items-center space-y-1.5">
            {onShiftUp && (
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  triggerHaptic(28);
                  onShiftUp();
                }}
                aria-label="Shift Gear Up"
                className={`w-16 sm:w-[72px] md:w-20 h-12 sm:h-14 rounded-2xl font-display font-black uppercase tracking-wider transition-all transform active:scale-95 border flex flex-col items-center justify-center backdrop-blur-md shadow-xl touch-none ${
                  shouldShiftUp
                    ? 'bg-rose-600/85 border-cyan-300 text-white shadow-[0_0_24px_rgba(0,242,254,0.85)] animate-pulse'
                    : 'bg-slate-950/65 border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/25 active:bg-cyan-500/45'
                }`}
              >
                <div className="flex items-center space-x-0.5 leading-none">
                  <span className="text-[10px] font-mono">GEAR</span>
                  <ChevronUp className="w-3.5 h-3.5 text-cyan-300" />
                </div>
                <span className="text-[10px] font-mono text-gray-200 leading-tight">
                  {shouldShiftUp ? 'SHIFT NOW!' : 'SHIFT +'}
                </span>
              </button>
            )}

            <button
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                setNitro(true);
                onInputChange({ nitro: true });
                triggerHaptic(45);
              }}
              onPointerUp={() => {
                setNitro(false);
                onInputChange({ nitro: false });
              }}
              onPointerCancel={() => {
                setNitro(false);
                onInputChange({ nitro: false });
              }}
              className={`w-16 sm:w-[72px] md:w-20 h-20 sm:h-24 rounded-2xl font-display font-black text-xs uppercase tracking-wider transition-all transform active:scale-95 border flex flex-col items-center justify-center backdrop-blur-md shadow-xl touch-none px-1.5 sm:px-2 ${
                nitro
                  ? 'bg-gradient-to-r from-purple-600/85 to-cyan-500/85 text-white shadow-[0_0_30px_rgba(168,85,247,0.8)] border-cyan-300'
                  : 'bg-slate-950/45 text-cyan-200 border-purple-500/45 active:bg-purple-600/50'
              }`}
            >
              <Flame className="w-5 h-5 text-cyan-300 animate-pulse mb-0.5" />
              <span className="text-xs tracking-widest font-black leading-tight">NITRO</span>
            </button>
          </div>

          {/* Gas Pedal */}
          <div
            ref={throttleContainerRef}
            onPointerDown={handleThrottlePointerDown}
            onPointerMove={handleThrottlePointerMove}
            onPointerUp={handleThrottlePointerUp}
            onPointerCancel={handleThrottlePointerUp}
            role="button"
            aria-label="Gas Accelerator Pedal"
            className={`w-20 sm:w-24 md:w-28 h-32 sm:h-36 md:h-44 rounded-3xl relative overflow-hidden flex flex-col justify-end p-2 border transition-all duration-100 cursor-pointer shadow-2xl backdrop-blur-md touch-none ${
              throttle > 0.05
                ? 'bg-cyan-950/60 border-cyan-400 shadow-[0_0_30px_rgba(0,242,254,0.55)]'
                : 'bg-slate-950/40 border-white/25 hover:border-white/40'
            }`}
          >
            <div
              className="w-full bg-gradient-to-t from-cyan-600/85 via-cyan-400/60 to-emerald-400/40 rounded-2xl transition-all duration-75"
              style={{ height: `${Math.max(10, Math.round(throttle * 100))}%` }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-between py-3 pointer-events-none">
              <div className="w-8 h-1 rounded-full bg-white/30" />
              <div className="flex flex-col items-center">
                <span className="text-xs uppercase font-black tracking-widest text-white drop-shadow">
                  GAS
                </span>
                <span className="text-base font-display font-black text-cyan-200 drop-shadow">
                  {Math.round(throttle * 100)}%
                </span>
              </div>
              <div className="w-8 h-1 rounded-full bg-white/30" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
