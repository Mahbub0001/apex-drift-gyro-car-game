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
  Gamepad2
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

  const throttleContainerRef = useRef<HTMLDivElement>(null);
  const brakeContainerRef = useRef<HTMLDivElement>(null);

  const triggerHaptic = (ms: number = 25) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(ms);
    }
  };

  // Gas / Throttle Slider Handlers
  const handleThrottleTouch = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!throttleContainerRef.current) return;
      const rect = throttleContainerRef.current.getBoundingClientRect();
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const relativeY = clientY - rect.top;
      const value = Math.max(0, Math.min(1, 1 - relativeY / rect.height));
      const rounded = Number(value.toFixed(2));
      setThrottle(rounded);
      onInputChange({ throttle: rounded });
    },
    [onInputChange]
  );

  const handleThrottleEnd = useCallback(() => {
    setThrottle(0);
    onInputChange({ throttle: 0 });
  }, [onInputChange]);

  // Brake Slider Handlers
  const handleBrakeTouch = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!brakeContainerRef.current) return;
      const rect = brakeContainerRef.current.getBoundingClientRect();
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const relativeY = clientY - rect.top;
      const value = Math.max(0, Math.min(1, 1 - relativeY / rect.height));
      const rounded = Number(value.toFixed(2));
      setBrake(rounded);
      onInputChange({ brake: rounded });
    },
    [onInputChange]
  );

  const handleBrakeEnd = useCallback(() => {
    setBrake(0);
    onInputChange({ brake: 0 });
  }, [onInputChange]);

  const toggleFullscreen = () => {
    triggerHaptic(30);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-30 font-racing flex flex-col justify-between p-3">
      {/* Top Mobile Quick Actions Header */}
      <div className="flex items-center justify-between pointer-events-auto">
        <div className="flex items-center space-x-1.5">
          {onOpenGarage && (
            <button
              onClick={() => {
                triggerHaptic(30);
                onOpenGarage();
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/15 text-xs text-white/90 active:bg-cyan-500/30 transition-all shadow-lg"
              title="Change Car"
            >
              <Warehouse className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold tracking-wider">GARAGE</span>
            </button>
          )}

          <button
            onClick={() => {
              triggerHaptic(30);
              onRecalibrateGyro();
            }}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/15 text-xs text-cyan-300 active:bg-cyan-500/30 transition-all shadow-lg"
            title="Center Steering Wheel"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold tracking-wider">CENTER</span>
          </button>
        </div>

        {/* Center Steering Angle Readout */}
        <div className="px-3 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/10 text-[11px] font-mono tracking-wider text-purple-300 flex items-center space-x-1.5 shadow-md">
          <span className="text-gray-400 uppercase text-[9px]">STEER</span>
          <span className="font-bold">
            {currentAngleDegrees === 0
              ? '● CENTER'
              : currentAngleDegrees > 0
              ? `▶ +${Math.abs(currentAngleDegrees)}°`
              : `◀ -${Math.abs(currentAngleDegrees)}°`}
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => {
              triggerHaptic(30);
              onCameraSwitch();
            }}
            className="p-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/15 text-white active:bg-white/20 transition-all shadow-lg"
            title="Switch Camera (Cockpit / Chase)"
          >
            <Camera className="w-4 h-4 text-cyan-300" />
          </button>

          <button
            onClick={() => {
              triggerHaptic(30);
              onResetCar();
            }}
            className="p-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/15 text-white active:bg-rose-500/30 transition-all shadow-lg"
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
              className="p-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/15 text-white active:bg-white/20 transition-all shadow-lg"
              title="Toggle Audio"
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
            className="p-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/15 text-white active:bg-white/20 transition-all shadow-lg"
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
              className="p-1.5 rounded-xl bg-cyan-500/20 backdrop-blur-md border border-cyan-400/40 text-cyan-300 active:bg-cyan-500/40 transition-all shadow-lg"
              title="Switch to PC Gamepad Controller Mode"
            >
              <Gamepad2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Main Cockpit: Transparent On-Screen Pedals (Left: Brake & Drift, Right: Gas & Nitro) */}
      <div className="flex items-end justify-between pointer-events-none pb-2 px-1">
        {/* Left Side: Transparent Brake Pedal & Drift Handbrake */}
        <div className="flex items-end space-x-2.5 pointer-events-auto">
          {/* Transparent Glass Brake Pedal */}
          <div
            ref={brakeContainerRef}
            onTouchStart={(e) => {
              handleBrakeTouch(e);
              triggerHaptic(20);
            }}
            onTouchMove={handleBrakeTouch}
            onTouchEnd={handleBrakeEnd}
            onMouseDown={(e) => handleBrakeTouch(e)}
            onMouseMove={(e) => e.buttons === 1 && handleBrakeTouch(e)}
            onMouseUp={handleBrakeEnd}
            className={`w-24 h-44 rounded-3xl relative overflow-hidden flex flex-col justify-end p-1.5 border transition-all duration-100 cursor-pointer shadow-2xl backdrop-blur-md ${
              brake > 0.05
                ? 'bg-rose-950/30 border-rose-400/80 shadow-[0_0_25px_rgba(244,63,94,0.4)]'
                : 'bg-black/25 border-white/20 hover:border-white/35'
            }`}
          >
            {/* Dynamic Fill Level */}
            <div
              className="w-full bg-gradient-to-t from-rose-600/70 via-rose-500/45 to-amber-400/30 rounded-2xl transition-all duration-75"
              style={{ height: `${Math.round(brake * 100)}%` }}
            />

            {/* Glass Pedal Overlay Graphics */}
            <div className="absolute inset-0 flex flex-col items-center justify-between py-3 pointer-events-none">
              <div className="w-8 h-1 rounded-full bg-white/25" />
              <div className="flex flex-col items-center">
                <span className="text-xs uppercase font-black tracking-widest text-white/95 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  BRAKE
                </span>
                <span className="text-base font-display font-black text-rose-300 drop-shadow">
                  {Math.round(brake * 100)}%
                </span>
              </div>
              <div className="w-8 h-1 rounded-full bg-white/25" />
            </div>
          </div>

          {/* Transparent Drift / Handbrake Button */}
          <button
            onTouchStart={() => {
              setHandbrake(true);
              onInputChange({ handbrake: true });
              triggerHaptic(45);
            }}
            onTouchEnd={() => {
              setHandbrake(false);
              onInputChange({ handbrake: false });
            }}
            onMouseDown={() => {
              setHandbrake(true);
              onInputChange({ handbrake: true });
            }}
            onMouseUp={() => {
              setHandbrake(false);
              onInputChange({ handbrake: false });
            }}
            className={`w-20 h-28 rounded-2xl font-display font-black text-xs uppercase tracking-wider transition-all transform active:scale-95 border flex flex-col items-center justify-center backdrop-blur-md shadow-xl ${
              handbrake
                ? 'bg-rose-600/60 text-white shadow-[0_0_25px_rgba(244,63,94,0.6)] border-rose-300'
                : 'bg-black/30 text-rose-200/90 border-rose-500/30 active:bg-rose-500/40'
            }`}
          >
            <span className="text-[10px] text-rose-300/80 font-mono">SLIDE</span>
            <span className="text-sm tracking-widest font-black leading-tight">DRIFT</span>
          </button>
        </div>

        {/* Center Prompt Guidance (Subtle) */}
        <div className="pointer-events-none pb-2 text-center">
          <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm border border-white/5">
            TILT PHONE TO STEER
          </span>
        </div>

        {/* Right Side: Transparent Nitro & Gas Accelerator Pedal */}
        <div className="flex items-end space-x-2.5 pointer-events-auto">
          {/* Transparent Nitro Boost Button */}
          <button
            onTouchStart={() => {
              setNitro(true);
              onInputChange({ nitro: true });
              triggerHaptic(60);
            }}
            onTouchEnd={() => {
              setNitro(false);
              onInputChange({ nitro: false });
            }}
            onMouseDown={() => {
              setNitro(true);
              onInputChange({ nitro: true });
            }}
            onMouseUp={() => {
              setNitro(false);
              onInputChange({ nitro: false });
            }}
            className={`w-20 h-28 rounded-2xl font-display font-black text-xs uppercase tracking-wider transition-all transform active:scale-95 border flex flex-col items-center justify-center backdrop-blur-md shadow-xl ${
              nitro
                ? 'bg-gradient-to-r from-purple-600/70 to-cyan-500/70 text-white shadow-[0_0_30px_rgba(168,85,247,0.7)] border-cyan-300'
                : 'bg-black/30 text-cyan-200/90 border-purple-500/30 active:bg-purple-600/40'
            }`}
          >
            <Flame className="w-5 h-5 text-cyan-300 animate-pulse mb-0.5" />
            <span className="text-sm tracking-widest font-black leading-tight">NITRO</span>
          </button>

          {/* Transparent Glass Gas / Accel Pedal */}
          <div
            ref={throttleContainerRef}
            onTouchStart={(e) => {
              handleThrottleTouch(e);
              triggerHaptic(20);
            }}
            onTouchMove={handleThrottleTouch}
            onTouchEnd={handleThrottleEnd}
            onMouseDown={(e) => handleThrottleTouch(e)}
            onMouseMove={(e) => e.buttons === 1 && handleThrottleTouch(e)}
            onMouseUp={handleThrottleEnd}
            className={`w-24 h-44 rounded-3xl relative overflow-hidden flex flex-col justify-end p-1.5 border transition-all duration-100 cursor-pointer shadow-2xl backdrop-blur-md ${
              throttle > 0.05
                ? 'bg-cyan-950/30 border-cyan-400/80 shadow-[0_0_25px_rgba(0,242,254,0.4)]'
                : 'bg-black/25 border-white/20 hover:border-white/35'
            }`}
          >
            {/* Dynamic Fill Level */}
            <div
              className="w-full bg-gradient-to-t from-cyan-600/70 via-cyan-400/45 to-emerald-400/30 rounded-2xl transition-all duration-75"
              style={{ height: `${Math.round(throttle * 100)}%` }}
            />

            {/* Glass Pedal Overlay Graphics */}
            <div className="absolute inset-0 flex flex-col items-center justify-between py-3 pointer-events-none">
              <div className="w-8 h-1 rounded-full bg-white/25" />
              <div className="flex flex-col items-center">
                <span className="text-xs uppercase font-black tracking-widest text-white/95 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  GAS
                </span>
                <span className="text-base font-display font-black text-cyan-200 drop-shadow">
                  {Math.round(throttle * 100)}%
                </span>
              </div>
              <div className="w-8 h-1 rounded-full bg-white/25" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
