import React from 'react';
import { VehicleTelemetry, ControllerInput } from '../../types';
import { Flame, Compass, Wifi, Camera } from 'lucide-react';

interface HUDOverlayProps {
  telemetry: VehicleTelemetry;
  input: ControllerInput;
  isLetterboxed: boolean;
  activeInputSource: 'gyro' | 'keyboard';
  ping: number;
}

export const HUDOverlay: React.FC<HUDOverlayProps> = ({
  telemetry,
  input,
  isLetterboxed,
  activeInputSource,
  ping
}) => {
  // Tachometer percentage (0 to 100%) for 800 - 8500 RPM
  const rpmPercent = Math.min(100, Math.max(0, ((telemetry.rpm - 800) / 7700) * 100));
  const isRedline = telemetry.rpm > 7200;

  return (
    <div className="absolute inset-0 pointer-events-none select-none font-racing overflow-hidden z-20">
      {/* 1. Asphalt 9 Cinematic Letterbox Bars */}
      <div
        className={`absolute top-0 left-0 right-0 bg-black transition-all duration-300 z-30 ${
          isLetterboxed ? 'h-16' : 'h-0'
        }`}
      />
      <div
        className={`absolute bottom-0 left-0 right-0 bg-black transition-all duration-300 z-30 ${
          isLetterboxed ? 'h-16' : 'h-0'
        }`}
      />

      {/* 2. Top Info Bar */}
      <div className="absolute top-4 left-6 right-6 flex items-center justify-between">
        <div className="flex items-center space-x-3 glass-panel px-4 py-2 rounded-xl border border-white/10">
          <div className="flex items-center space-x-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${activeInputSource === 'gyro' ? 'bg-purple-400 animate-pulse' : 'bg-cyan-400'}`} />
            <span className="text-xs uppercase font-bold text-gray-300">
              {activeInputSource === 'gyro' ? `PHONE GYRO (${ping}ms)` : 'KEYBOARD (WASD)'}
            </span>
          </div>
          <span className="text-gray-600">|</span>
          <span className="text-xs text-gray-400 font-mono">
            STEER: {input.angleDegrees}°
          </span>
        </div>

        {/* Center Drift Notification */}
        {telemetry.isDrifting && (
          <div className="flex flex-col items-center animate-bounce">
            <span className="text-xs uppercase font-bold tracking-widest text-purple-400 drop-shadow">
              DRIFTING
            </span>
            <span className="text-2xl font-display font-bold text-purple-300 drop-shadow-md">
              +{telemetry.driftScore} PTS
            </span>
          </div>
        )}

        {/* Airborne Jump Banner */}
        {telemetry.isJumping && (
          <div className="flex flex-col items-center animate-pulse">
            <span className="text-xs uppercase font-bold tracking-widest text-cyan-400 drop-shadow">
              ASPHALT JUMP!
            </span>
            <span className="text-2xl font-display font-bold text-cyan-200">
              AIR TIME
            </span>
          </div>
        )}

        <div className="glass-panel px-4 py-2 rounded-xl border border-white/10 flex items-center space-x-2 text-xs font-bold text-gray-400">
          <Camera className="w-3.5 h-3.5 text-cyan-400" />
          <span>VIEW [C]</span>
        </div>
      </div>

      {/* 3. Bottom Right: Tachometer, Speedometer & Nitro */}
      <div className="absolute bottom-6 right-6 flex flex-col items-end">
        {/* Nitro Gauge */}
        <div className="w-56 glass-panel p-2 rounded-xl border border-white/10 mb-3 flex items-center space-x-2">
          <Flame className={`w-4 h-4 ${input.nitro ? 'text-purple-400 animate-pulse' : 'text-cyan-400'}`} />
          <div className="flex-1 bg-white/10 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-75 ${
                input.nitro
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500'
              }`}
              style={{ width: `${telemetry.nitroFuel}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-gray-300">{telemetry.nitroFuel}%</span>
        </div>

        {/* Cockpit Speed & RPM Cluster */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 flex items-baseline space-x-4 shadow-2xl shadow-black/80">
          {/* Gear Indicator */}
          <div className="flex flex-col items-center border-r border-white/10 pr-4">
            <span className="text-[10px] text-gray-400 uppercase font-bold">GEAR</span>
            <span className="text-4xl font-display font-bold text-amber-400">
              {telemetry.gear}
            </span>
          </div>

          {/* Speedometer */}
          <div className="flex flex-col">
            <div className="flex items-baseline space-x-2">
              <span className="text-5xl font-display font-bold text-white tracking-tight">
                {telemetry.speedKmh}
              </span>
              <span className="text-sm font-bold text-gray-400 uppercase">KM/H</span>
            </div>

            {/* RPM Progress Arc */}
            <div className="w-44 mt-2">
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-75 ${
                    isRedline ? 'bg-rose-500' : 'bg-cyan-400'
                  }`}
                  style={{ width: `${rpmPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-gray-500 font-mono mt-0.5">
                <span>0</span>
                <span>4K</span>
                <span className={isRedline ? 'text-rose-400 font-bold' : ''}>8K RPM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
