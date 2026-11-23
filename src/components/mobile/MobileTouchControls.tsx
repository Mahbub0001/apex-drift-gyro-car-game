import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Smartphone
} from 'lucide-react';
import { ControllerInput } from '../../types';

interface MobileTouchControlsProps {
  onInputChange: (input: Partial<ControllerInput>) => void;
  onCameraSwitch: () => void;
  onResetCar: () => void;
  onRecalibrateGyro: () => void;
  onOpenGarage?: () => void;
  onSwitchToControllerMode?: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  currentAngleDegrees?: number;
}

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  onInputChange,
  onCameraSwitch,
  onResetCar,
  onRecalibrateGyro,
  onOpenGarage,
  onSwitchToControllerMode,
  isMuted = false,
  onToggleMute,
  currentAngleDegrees = 0
}) => {
  const [throttle, setThrottle] = useState<number>(0);
  const [brake, setBrake] = useState<number>(0);
  const [handbrake, setHandbrake] = useState<boolean>(false);
  const [nitro, setNitro] = useState<boolean>(false);

  // Steering Mode: 'gyro' (phone tilt) or 'touch' (on-screen arrows)
  const [steerMode, setSteerMode] = useState<'gyro' | 'touch'>('gyro');
  const [touchSteerDirection, setTouchSteerDirection] = useState<'left' | 'right' | 'center'>('center');

  // Multi-Touch Pointer Capture IDs
  const activeThrottlePointerId = useRef<number | null>(null);
  const activeBrakePointerId = useRef<number | null>(null);

  const throttleContainerRef = useRef<HTMLDivElement>(null);
  const brakeContainerRef = useRef<HTMLDivElement>(null);

  const triggerHaptic = (ms: number = 25) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(ms);
    }
  };

  // 1. Gas Pedal Pointer Handlers (Multi-Touch Safe with setPointerCapture)
  const handleThrottlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    activeThrottlePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);

    // Instant 100% full throttle on press
    setThrottle(1.0);
    onInputChange({ throttle: 1.0 });
    triggerHaptic(25);
  };

  const handleThrottlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeThrottlePointerId.current !== e.pointerId || !throttleContainerRef.current) return;
    const rect = throttleContainerRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    // Allow modulating by sliding down: bottom half still gives high power
    const ratio = Math.max(0, Math.min(1, 1 - relativeY / rect.height));
    const scaled = Math.min(1.0, Math.max(0.2, ratio * 1.25));
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

  // 2. Brake Pedal Pointer Handlers (Multi-Touch Safe)
  const handleBrakePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    activeBrakePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);

    // Instant 100% brake on press
    setBrake(1.0);
    onInputChange({ brake: 1.0 });
    triggerHaptic(25);
  };

  const handleBrakePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeBrakePointerId.current !== e.pointerId || !brakeContainerRef.current) return;
    const rect = brakeContainerRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const ratio = Math.max(0, Math.min(1, 1 - relativeY / rect.height));
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

  // 3. Touch Steering Handlers (for players who prefer touch arrows over gyro)
  const handleTouchSteer = (direction: 'left' | 'right' | 'center') => {
    setTouchSteerDirection(direction);
    if (direction === 'left') {
      onInputChange({ steer: -1.0, angleDegrees: -45 });
      triggerHaptic(20);
    } else if (direction === 'right') {
      onInputChange({ steer: 1.0, angleDegrees: 45 });
      triggerHaptic(20);
    } else {
      onInputChange({ steer: 0, angleDegrees: 0 });
    }
  };

  const toggleFullscreen = () => {
    triggerHaptic(30);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-30 font-racing flex flex-col justify-between p-3 touch-none">
      {/* Top Mobile Quick Actions Bar */}
      <div className="flex items-center justify-between pointer-events-auto">
        {/* Left Actions: Garage & Steer Mode */}
        <div className="flex items-center space-x-1.5">
          {onOpenGarage && (
            <button
              onClick={() => {
                triggerHaptic(30);
                onOpenGarage();
              }}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-black/50 backdrop-blur-md border border-white/20 text-xs text-white active:bg-cyan-500/30 transition-all shadow-lg"
              title="Change Car"
            >
              <Warehouse className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold tracking-wider">GARAGE</span>
            </button>
          )}

          {/* Steer Mode Toggle: Gyro vs Touch Arrows */}
          <button
            onClick={() => {
              triggerHaptic(30);
              const nextMode = steerMode === 'gyro' ? 'touch' : 'gyro';
              setSteerMode(nextMode);
              if (nextMode === 'gyro') {
                handleTouchSteer('center');
              }
            }}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl backdrop-blur-md border text-xs font-bold transition-all shadow-lg ${
              steerMode === 'gyro'
                ? 'bg-purple-900/40 border-purple-400/50 text-purple-300'
                : 'bg-cyan-900/40 border-cyan-400/50 text-cyan-300'
            }`}
            title="Toggle Gyro Tilt vs Touch Steering"
          >
            {steerMode === 'gyro' ? (
              <>
                <Smartphone className="w-3.5 h-3.5 text-purple-400" />
                <span>GYRO</span>
              </>
            ) : (
              <>
                <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>TOUCH</span>
              </>
            )}
          </button>

          {/* Center Recalibrate Button (Only for Gyro mode) */}
          {steerMode === 'gyro' && (
            <button
              onClick={() => {
                triggerHaptic(30);
                onRecalibrateGyro();
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-black/50 backdrop-blur-md border border-white/20 text-xs text-cyan-300 active:bg-cyan-500/30 transition-all shadow-lg"
              title="Recalibrate Neutral Wheel Position"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-bold tracking-wider">CENTER</span>
            </button>
          )}
        </div>

        {/* Center Steering Angle Readout */}
        <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[11px] font-mono tracking-wider text-purple-300 flex items-center space-x-1.5 shadow-md">
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

        {/* Right Actions: Camera, Reset, Mute, Fullscreen, PC Gamepad */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => {
              triggerHaptic(30);
              onCameraSwitch();
            }}
            className="p-1.5 rounded-xl bg-black/50 backdrop-blur-md border border-white/20 text-white active:bg-white/25 transition-all shadow-lg"
            title="Switch Camera (Chase / Hood / Cockpit)"
          >
            <Camera className="w-4 h-4 text-cyan-300" />
          </button>

          <button
            onClick={() => {
              triggerHaptic(30);
              onResetCar();
            }}
            className="p-1.5 rounded-xl bg-black/50 backdrop-blur-md border border-white/20 text-white active:bg-rose-500/30 transition-all shadow-lg"
            title="Reset Car on Track"
          >
            <RefreshCw className="w-4 h-4 text-rose-300" />
          </button>

          {onToggleMute && (
            <button
              onClick={() => {
                triggerHaptic(25);
                onToggleMute();
              }}
              className="p-1.5 rounded-xl bg-black/50 backdrop-blur-md border border-white/20 text-white active:bg-white/25 transition-all shadow-lg"
              title="Toggle Audio Mute"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-xl bg-black/50 backdrop-blur-md border border-white/20 text-white active:bg-white/25 transition-all shadow-lg"
            title="Toggle Fullscreen"
          >
            <Maximize className="w-4 h-4 text-gray-300" />
          </button>

          {onSwitchToControllerMode && (
            <button
              onClick={() => {
                triggerHaptic(30);
                onSwitchToControllerMode();
              }}
              className="p-1.5 rounded-xl bg-cyan-500/20 backdrop-blur-md border border-cyan-400/50 text-cyan-300 active:bg-cyan-500/40 transition-all shadow-lg"
              title="Switch to PC Gamepad Controller Mode"
            >
              <Gamepad2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Main Cockpit: Transparent On-Screen Pedals (Left: Brake & Drift, Right: Gas & Nitro) */}
      <div className="flex items-end justify-between pointer-events-none pb-2 px-1">
        {/* Left Side: Transparent Brake Pedal & Drift Handbrake + Optional Touch Steer Arrows */}
        <div className="flex items-end space-x-2.5 pointer-events-auto">
          {/* Optional Touch Steering Buttons (if in Touch Steer mode) */}
          {steerMode === 'touch' && (
            <div className="flex items-center space-x-1.5 mr-1">
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleTouchSteer('left');
                }}
                onPointerUp={() => handleTouchSteer('center')}
                onPointerCancel={() => handleTouchSteer('center')}
                className={`w-16 h-28 rounded-2xl border flex flex-col items-center justify-center backdrop-blur-md transition-all active:scale-95 shadow-xl ${
                  touchSteerDirection === 'left'
                    ? 'bg-cyan-500/60 border-cyan-300 shadow-[0_0_25px_#00f2fe]'
                    : 'bg-black/40 border-white/20 text-white'
                }`}
              >
                <ChevronLeft className="w-8 h-8 text-cyan-300" />
                <span className="text-[10px] font-bold">LEFT</span>
              </button>

              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleTouchSteer('right');
                }}
                onPointerUp={() => handleTouchSteer('center')}
                onPointerCancel={() => handleTouchSteer('center')}
                className={`w-16 h-28 rounded-2xl border flex flex-col items-center justify-center backdrop-blur-md transition-all active:scale-95 shadow-xl ${
                  touchSteerDirection === 'right'
                    ? 'bg-cyan-500/60 border-cyan-300 shadow-[0_0_25px_#00f2fe]'
                    : 'bg-black/40 border-white/20 text-white'
                }`}
              >
                <ChevronRight className="w-8 h-8 text-cyan-300" />
                <span className="text-[10px] font-bold">RIGHT</span>
              </button>
            </div>
          )}

          {/* Transparent Glass Brake Pedal (Large ergonomic touch area with PointerCapture) */}
          <div
            ref={brakeContainerRef}
            onPointerDown={handleBrakePointerDown}
            onPointerMove={handleBrakePointerMove}
            onPointerUp={handleBrakePointerUp}
            onPointerCancel={handleBrakePointerUp}
            className={`w-28 h-48 rounded-3xl relative overflow-hidden flex flex-col justify-end p-2 border transition-all duration-100 cursor-pointer shadow-2xl backdrop-blur-lg touch-none ${
              brake > 0.05
                ? 'bg-rose-950/40 border-rose-400 shadow-[0_0_35px_rgba(244,63,94,0.5)]'
                : 'bg-black/40 border-white/25 hover:border-white/40'
            }`}
          >
            {/* Dynamic Fill Level */}
            <div
              className="w-full bg-gradient-to-t from-rose-600/80 via-rose-500/55 to-amber-400/40 rounded-2xl transition-all duration-75"
              style={{ height: `${Math.max(12, Math.round(brake * 100))}%` }}
            />

            {/* Glass Pedal Overlay Graphics */}
            <div className="absolute inset-0 flex flex-col items-center justify-between py-3.5 pointer-events-none">
              <div className="w-10 h-1 rounded-full bg-white/30" />
              <div className="flex flex-col items-center">
                <span className="text-xs uppercase font-black tracking-widest text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  BRAKE
                </span>
                <span className="text-lg font-display font-black text-rose-300 drop-shadow">
                  {Math.round(brake * 100)}%
                </span>
              </div>
              <div className="w-10 h-1 rounded-full bg-white/30" />
            </div>
          </div>

          {/* Transparent Drift / Handbrake Button */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              setHandbrake(true);
              onInputChange({ handbrake: true });
              triggerHaptic(45);
            }}
            onPointerUp={() => {
              setHandbrake(false);
              onInputChange({ handbrake: false });
            }}
            onPointerCancel={() => {
              setHandbrake(false);
              onInputChange({ handbrake: false });
            }}
            className={`w-22 h-32 rounded-2xl font-display font-black text-xs uppercase tracking-wider transition-all transform active:scale-95 border flex flex-col items-center justify-center backdrop-blur-lg shadow-xl touch-none ${
              handbrake
                ? 'bg-rose-600/70 text-white shadow-[0_0_30px_rgba(244,63,94,0.7)] border-rose-300'
                : 'bg-black/40 text-rose-200 border-rose-500/40 active:bg-rose-500/50'
            }`}
          >
            <span className="text-[10px] text-rose-300 font-mono">SLIDE</span>
            <span className="text-sm tracking-widest font-black leading-tight">DRIFT</span>
          </button>
        </div>

        {/* Center Guidance Bar (Subtle, elevated above the bottom-center speedometer) */}
        <div className="pointer-events-none mb-20 text-center">
          <span className="text-[10px] font-mono tracking-widest text-white/50 uppercase bg-black/40 px-3.5 py-1 rounded-full backdrop-blur-md border border-white/10 shadow">
            {steerMode === 'gyro' ? 'TILT PHONE TO STEER' : 'USE TOUCH ARROWS TO STEER'}
          </span>
        </div>

        {/* Right Side: Transparent Nitro & Gas Accelerator Pedal */}
        <div className="flex items-end space-x-2.5 pointer-events-auto">
          {/* Transparent Nitro Boost Button */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              setNitro(true);
              onInputChange({ nitro: true });
              triggerHaptic(60);
            }}
            onPointerUp={() => {
              setNitro(false);
              onInputChange({ nitro: false });
            }}
            onPointerCancel={() => {
              setNitro(false);
              onInputChange({ nitro: false });
            }}
            className={`w-22 h-32 rounded-2xl font-display font-black text-xs uppercase tracking-wider transition-all transform active:scale-95 border flex flex-col items-center justify-center backdrop-blur-lg shadow-xl touch-none ${
              nitro
                ? 'bg-gradient-to-r from-purple-600/80 to-cyan-500/80 text-white shadow-[0_0_35px_rgba(168,85,247,0.8)] border-cyan-300'
                : 'bg-black/40 text-cyan-200 border-purple-500/40 active:bg-purple-600/50'
            }`}
          >
            <Flame className="w-6 h-6 text-cyan-300 animate-pulse mb-0.5" />
            <span className="text-sm tracking-widest font-black leading-tight">NITRO</span>
          </button>

          {/* Transparent Glass Gas / Accel Pedal (Large ergonomic touch area with PointerCapture) */}
          <div
            ref={throttleContainerRef}
            onPointerDown={handleThrottlePointerDown}
            onPointerMove={handleThrottlePointerMove}
            onPointerUp={handleThrottlePointerUp}
            onPointerCancel={handleThrottlePointerUp}
            className={`w-28 h-48 rounded-3xl relative overflow-hidden flex flex-col justify-end p-2 border transition-all duration-100 cursor-pointer shadow-2xl backdrop-blur-lg touch-none ${
              throttle > 0.05
                ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_35px_rgba(0,242,254,0.5)]'
                : 'bg-black/40 border-white/25 hover:border-white/40'
            }`}
          >
            {/* Dynamic Fill Level */}
            <div
              className="w-full bg-gradient-to-t from-cyan-600/80 via-cyan-400/55 to-emerald-400/40 rounded-2xl transition-all duration-75"
              style={{ height: `${Math.max(12, Math.round(throttle * 100))}%` }}
            />

            {/* Glass Pedal Overlay Graphics */}
            <div className="absolute inset-0 flex flex-col items-center justify-between py-3.5 pointer-events-none">
              <div className="w-10 h-1 rounded-full bg-white/30" />
              <div className="flex flex-col items-center">
                <span className="text-xs uppercase font-black tracking-widest text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  GAS
                </span>
                <span className="text-lg font-display font-black text-cyan-200 drop-shadow">
                  {Math.round(throttle * 100)}%
                </span>
              </div>
              <div className="w-10 h-1 rounded-full bg-white/30" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
