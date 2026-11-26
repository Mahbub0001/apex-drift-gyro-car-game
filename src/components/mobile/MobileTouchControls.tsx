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
import { ControllerInput, TransmissionMode } from '../../types';

interface MobileTouchControlsProps {
  onInputChange: (input: Partial<ControllerInput>) => void;
  onCameraSwitch: () => void;
  onResetCar: () => void;
  onShiftUp?: () => void;
  onShiftDown?: () => void;
  gear?: number | string;
  shouldShiftUp?: boolean;
  transmissionMode?: TransmissionMode;
  onToggleTransmission?: () => void;
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
  transmissionMode = 'auto',
  onToggleTransmission,
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

  const computePedalRatio = (e: React.PointerEvent<HTMLDivElement>, el: HTMLDivElement): number => {
    const rect = el.getBoundingClientRect();
    if (isRotated90) {
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    }
    return Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / Math.max(1, rect.height)));
  };

  const handleThrottlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    activeThrottlePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ratio = computePedalRatio(e, e.currentTarget);
    // Upper half tap snaps cleanly to full throttle; sliding anywhere modulates 0.05..1.00 smoothly
    const initial = ratio >= 0.55 ? 1.0 : Number(Math.max(0.15, Math.min(1.0, ratio * 1.15)).toFixed(2));
    setThrottle(initial);
    onInputChange({ throttle: initial });
    triggerHaptic(22);
  };

  const handleThrottlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeThrottlePointerId.current !== e.pointerId || !throttleContainerRef.current) return;
    const ratio = computePedalRatio(e, throttleContainerRef.current);
    const scaled = ratio >= 0.88 ? 1.0 : Math.min(1.0, Math.max(0.05, ratio * 1.12));
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
    const ratio = computePedalRatio(e, e.currentTarget);
    const initial = ratio >= 0.55 ? 1.0 : Number(Math.max(0.15, Math.min(1.0, ratio * 1.15)).toFixed(2));
    setBrake(initial);
    onInputChange({ brake: initial });
    triggerHaptic(22);
  };

  const handleBrakePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeBrakePointerId.current !== e.pointerId || !brakeContainerRef.current) return;
    const ratio = computePedalRatio(e, brakeContainerRef.current);
    const scaled = ratio >= 0.88 ? 1.0 : Math.min(1.0, Math.max(0.05, ratio * 1.12));
    const rounded = Number(scaled.toFixed(2));
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
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#090A0D]/80 backdrop-blur-md border border-white/20 text-[11px] text-white active:bg-white/15 transition-colors"
            >
              <Warehouse className="w-3.5 h-3.5 text-[#F5A623]" />
              <span className="font-semibold">Garage</span>
            </button>
          )}

          {onToggleTransmission && (
            <button
              onClick={() => {
                triggerHaptic(22);
                onToggleTransmission();
              }}
              aria-label="Toggle Auto or Manual Gearbox"
              className={`px-2.5 py-1.5 rounded-lg backdrop-blur-md border text-[11px] font-mono font-bold transition-colors ${
                transmissionMode === 'auto'
                  ? 'bg-[#00E5FF]/15 border-[#00E5FF]/55 text-[#00E5FF]'
                  : 'bg-[#F5A623]/15 border-[#F5A623]/55 text-[#F5A623]'
              }`}
            >
              {transmissionMode === 'auto' ? 'AUTO' : 'MANUAL'}
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
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg backdrop-blur-md border text-[11px] font-semibold transition-colors ${
              steerMode === 'gyro'
                ? 'bg-[#12141A]/85 border-[#00E5FF]/45 text-[#00E5FF]'
                : 'bg-[#12141A]/85 border-white/25 text-white'
            }`}
          >
            {steerMode === 'gyro' ? (
              <>
                <Smartphone className="w-3.5 h-3.5" />
                <span>Gyro</span>
              </>
            ) : (
              <>
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>Arrows</span>
              </>
            )}
          </button>

          {steerMode === 'gyro' && needsGyroPermission && onRequestGyroPermission && (
            <button
              onClick={() => {
                triggerHaptic(30);
                onRequestGyroPermission();
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#00E5FF] text-[#090A0D] font-bold text-[11px] animate-pulse"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Enable Gyro</span>
            </button>
          )}

          {steerMode === 'gyro' && !needsGyroPermission && gyroTimeoutWarn && !hasGyroSignal && (
            <button
              onClick={() => {
                triggerHaptic(25);
                setSteerMode('touch');
                onSteerModeChange?.('touch');
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#F5A623]/20 border border-[#F5A623]/60 text-[#F5A623] font-bold text-[10px]"
            >
              <span>Use Touch</span>
            </button>
          )}

          {steerMode === 'gyro' && !needsGyroPermission && (!gyroTimeoutWarn || hasGyroSignal) && (
            <button
              onClick={() => {
                triggerHaptic(25);
                onRecalibrateGyro();
              }}
              aria-label="Recalibrate Gyro Center"
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#090A0D]/80 backdrop-blur-md border border-white/20 text-[11px] text-gray-200 active:bg-white/15 transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span className="font-semibold">Zero</span>
            </button>
          )}
        </div>

        {/* Center Live Steering Angle Indicator */}
        <div className="hidden sm:flex px-3 py-1 rounded-md bg-[#090A0D]/80 backdrop-blur-md border border-white/15 text-[11px] font-mono tabular-nums text-gray-200 items-center space-x-1.5">
          <span className="text-gray-400 text-[9px]">STEER</span>
          <span className="font-bold text-[#00E5FF]">
            {steerMode === 'touch'
              ? touchSteerDirection === 'left'
                ? '◀ LEFT'
                : touchSteerDirection === 'right'
                ? 'RIGHT ▶'
                : 'CENTER'
              : currentAngleDegrees === 0
              ? '0°'
              : currentAngleDegrees > 0
              ? `+${Math.abs(currentAngleDegrees)}°`
              : `-${Math.abs(currentAngleDegrees)}°`}
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
            className="p-1.5 rounded-lg bg-[#090A0D]/80 backdrop-blur-md border border-white/20 text-white active:bg-white/20 transition-colors"
          >
            <Camera className="w-4 h-4 text-[#00E5FF]" />
          </button>

          <button
            onClick={() => {
              triggerHaptic(22);
              onResetCar();
            }}
            aria-label="Reset Car on Track"
            className="p-1.5 rounded-lg bg-[#090A0D]/80 backdrop-blur-md border border-white/20 text-white active:bg-[#FF3B30]/30 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-[#FF3B30]" />
          </button>

          {onToggleMute && (
            <button
              onClick={() => {
                triggerHaptic(20);
                onToggleMute();
              }}
              aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              className="p-1.5 rounded-lg bg-[#090A0D]/80 backdrop-blur-md border border-white/20 text-white active:bg-white/20 transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-[#FF3B30]" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            aria-label="Toggle Fullscreen"
            className="p-1.5 rounded-lg bg-[#090A0D]/80 backdrop-blur-md border border-white/20 text-white active:bg-white/20 transition-colors"
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
              className="p-1.5 rounded-lg bg-[#090A0D]/80 backdrop-blur-md border border-white/20 text-[#00E5FF] active:bg-white/20 transition-colors"
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
              className="p-1.5 rounded-lg bg-[#00E5FF]/15 backdrop-blur-md border border-[#00E5FF]/45 text-[#00E5FF] active:bg-[#00E5FF]/35 transition-colors"
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
          <span className="text-[11px] font-medium text-white bg-[#090A0D]/85 px-3 py-1 rounded-md backdrop-blur-md border border-white/15">
            {steerMode === 'gyro'
              ? transmissionMode === 'auto'
                ? 'Tilt phone to steer • Slide pedals for throttle & brake'
                : 'Tilt phone to steer • Tap Gear + / - paddles to shift'
              : transmissionMode === 'auto'
              ? 'Use left/right arrows to steer • Slide pedals to modulate speed'
              : 'Use arrows to steer • Tap Gear + / - paddles to shift'}
          </span>
        </div>
      )}

      {/* Bottom Pedals + Contextual Paddles Cockpit */}
      <div className="flex items-end justify-between pointer-events-none pb-1 px-0.5 mt-auto">
        {/* Left: Optional Touch Arrows + Brake + Drift (+ Gear - when Manual) */}
        <div className="flex items-end space-x-1.5 md:space-x-2 pointer-events-auto">
          {steerMode === 'touch' && (
            <div className="flex items-center space-x-1 mr-0.5">
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  handleTouchSteer('left');
                }}
                onPointerUp={() => handleTouchSteer('center')}
                onPointerCancel={() => handleTouchSteer('center')}
                aria-label="Steer Left"
                className={`w-11 md:w-14 h-20 md:h-24 rounded-xl border flex flex-col items-center justify-center backdrop-blur-md transition-all active:scale-95 touch-none ${
                  touchSteerDirection === 'left'
                    ? 'bg-[#00E5FF]/75 border-[#00E5FF] text-[#090A0D]'
                    : 'bg-[#090A0D]/70 border-white/20 text-white'
                }`}
              >
                <ChevronLeft className="w-6 h-6 md:w-7 md:h-7" />
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
                className={`w-11 md:w-14 h-20 md:h-24 rounded-xl border flex flex-col items-center justify-center backdrop-blur-md transition-all active:scale-95 touch-none ${
                  touchSteerDirection === 'right'
                    ? 'bg-[#00E5FF]/75 border-[#00E5FF] text-[#090A0D]'
                    : 'bg-[#090A0D]/70 border-white/20 text-white'
                }`}
              >
                <ChevronRight className="w-6 h-6 md:w-7 md:h-7" />
              </button>
            </div>
          )}

          {/* Tactile Brake Pedal */}
          <div
            ref={brakeContainerRef}
            onPointerDown={handleBrakePointerDown}
            onPointerMove={handleBrakePointerMove}
            onPointerUp={handleBrakePointerUp}
            onPointerCancel={handleBrakePointerUp}
            role="button"
            aria-label="Brake Pedal"
            className={`${
              steerMode === 'touch' ? 'w-14 md:w-20 lg:w-24' : 'w-[72px] md:w-24 lg:w-28'
            } h-28 md:h-36 lg:h-40 rounded-xl relative overflow-hidden flex flex-col justify-end p-1 border transition-colors cursor-pointer backdrop-blur-md touch-none pedal-tread ${
              brake > 0.05
                ? 'bg-[#FF3B30]/20 border-[#FF3B30]'
                : 'bg-[#090A0D]/60 border-white/25'
            }`}
          >
            <div
              className="w-full bg-[#FF3B30]/80 rounded-lg transition-all duration-75"
              style={{ height: `${Math.max(8, Math.round(brake * 100))}%` }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-between py-2.5 pointer-events-none">
              <div className="w-7 h-1 rounded-sm bg-white/25" />
              <div className="flex flex-col items-center">
                <span className="text-[11px] uppercase font-bold tracking-widest text-white">
                  Brake
                </span>
                <span className="text-sm font-mono tabular-nums font-bold text-[#FF3B30]">
                  {Math.round(brake * 100)}%
                </span>
              </div>
              <div className="w-7 h-1 rounded-sm bg-white/25" />
            </div>
          </div>

          <div className="flex flex-col items-center space-y-1.5">
            {transmissionMode === 'manual' && onShiftDown && (
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  triggerHaptic(28);
                  onShiftDown();
                }}
                aria-label="Shift Gear Down"
                className={`${
                  steerMode === 'touch' ? 'w-12 md:w-16 lg:w-20' : 'w-14 md:w-[72px] lg:w-20'
                } h-11 md:h-12 rounded-xl font-display font-bold uppercase transition-transform active:scale-95 border border-[#F5A623]/60 bg-[#090A0D]/80 text-[#F5A623] flex flex-col items-center justify-center backdrop-blur-md touch-none`}
              >
                <div className="flex items-center space-x-0.5 leading-none">
                  <span className="text-[10px] font-mono">G-</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
                <span className="text-[9px] font-mono text-gray-300 leading-tight">
                  {gear === 'N' || gear === 1 ? 'N/R' : 'DOWN'}
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
              className={`${
                steerMode === 'touch' ? 'w-12 md:w-16 lg:w-20' : 'w-14 md:w-[72px] lg:w-20'
              } ${
                transmissionMode === 'manual' ? 'h-16 md:h-20' : 'h-24 md:h-28'
              } rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-all active:scale-95 border flex flex-col items-center justify-center backdrop-blur-md touch-none px-1 ${
                handbrake
                  ? 'bg-[#FF3B30] text-white border-white/60'
                  : 'bg-[#090A0D]/65 text-gray-200 border-[#FF3B30]/50'
              }`}
            >
              <span className="text-[11px] md:text-xs font-bold leading-tight">Drift</span>
            </button>
          </div>
        </div>

        {/* Right: (Gear + when Manual) + Nitro + Gas Pedal */}
        <div className="flex items-end space-x-1.5 md:space-x-2 pointer-events-auto">
          <div className="flex flex-col items-center space-y-1.5">
            {transmissionMode === 'manual' && onShiftUp && (
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  triggerHaptic(28);
                  onShiftUp();
                }}
                aria-label="Shift Gear Up"
                className={`${
                  steerMode === 'touch' ? 'w-12 md:w-16 lg:w-20' : 'w-14 md:w-[72px] lg:w-20'
                } h-11 md:h-12 rounded-xl font-display font-bold uppercase transition-transform active:scale-95 border flex flex-col items-center justify-center backdrop-blur-md touch-none ${
                  shouldShiftUp
                    ? 'bg-[#FF3B30] border-white text-white animate-pulse'
                    : 'bg-[#090A0D]/80 border-[#00E5FF]/60 text-[#00E5FF]'
                }`}
              >
                <div className="flex items-center space-x-0.5 leading-none">
                  <span className="text-[10px] font-mono">G+</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </div>
                <span className="text-[9px] font-mono leading-tight">
                  {shouldShiftUp ? 'SHIFT' : 'UP'}
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
              className={`${
                steerMode === 'touch' ? 'w-12 md:w-16 lg:w-20' : 'w-14 md:w-[72px] lg:w-20'
              } ${
                transmissionMode === 'manual' ? 'h-16 md:h-20' : 'h-24 md:h-28'
              } rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-all active:scale-95 border flex flex-col items-center justify-center backdrop-blur-md touch-none px-1 ${
                nitro
                  ? 'bg-[#00E5FF] text-[#090A0D] border-white'
                  : 'bg-[#090A0D]/65 text-[#00E5FF] border-[#00E5FF]/50'
              }`}
            >
              <Flame className="w-4 h-4 md:w-5 md:h-5 mb-0.5" />
              <span className="text-[11px] md:text-xs font-bold leading-tight">Nitro</span>
            </button>
          </div>

          {/* Tactile Gas Pedal */}
          <div
            ref={throttleContainerRef}
            onPointerDown={handleThrottlePointerDown}
            onPointerMove={handleThrottlePointerMove}
            onPointerUp={handleThrottlePointerUp}
            onPointerCancel={handleThrottlePointerUp}
            role="button"
            aria-label="Gas Accelerator Pedal"
            className={`${
              steerMode === 'touch' ? 'w-14 md:w-20 lg:w-24' : 'w-[72px] md:w-24 lg:w-28'
            } h-28 md:h-36 lg:h-40 rounded-xl relative overflow-hidden flex flex-col justify-end p-1 border transition-colors cursor-pointer backdrop-blur-md touch-none pedal-tread ${
              throttle > 0.05
                ? 'bg-[#00E5FF]/20 border-[#00E5FF]'
                : 'bg-[#090A0D]/60 border-white/25'
            }`}
          >
            <div
              className="w-full bg-[#00E5FF]/80 rounded-lg transition-all duration-75"
              style={{ height: `${Math.max(8, Math.round(throttle * 100))}%` }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-between py-2.5 pointer-events-none">
              <div className="w-7 h-1 rounded-sm bg-white/25" />
              <div className="flex flex-col items-center">
                <span className="text-[11px] uppercase font-bold tracking-widest text-white">
                  Gas
                </span>
                <span className="text-sm font-mono tabular-nums font-bold text-[#00E5FF]">
                  {Math.round(throttle * 100)}%
                </span>
              </div>
              <div className="w-7 h-1 rounded-sm bg-white/25" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
