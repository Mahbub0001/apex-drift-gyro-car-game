import React from 'react';
import * as THREE from 'three';
import { VehicleTelemetry, ControllerInput, TrafficCarState, RemotePlayerState } from '../../types';
import { Minimap } from './Minimap';
import { Flame, Camera, Zap, ShieldAlert } from 'lucide-react';

interface HUDOverlayProps {
  telemetry: VehicleTelemetry;
  input: ControllerInput;
  isLetterboxed: boolean;
  activeInputSource: 'gyro' | 'keyboard';
  ping: number;
  playerPos: THREE.Vector3;
  playerHeading: number;
  splineCurve: THREE.CatmullRomCurve3;
  traffic: TrafficCarState[];
  opponents?: RemotePlayerState[];
  nearMissActive?: boolean;
  isMobile?: boolean;
}

export const HUDOverlay: React.FC<HUDOverlayProps> = ({
  telemetry,
  input,
  isLetterboxed,
  activeInputSource,
  ping,
  playerPos,
  playerHeading,
  splineCurve,
  traffic,
  opponents = [],
  nearMissActive = false,
  isMobile = false
}) => {
  const rpmPercent = Math.min(100, Math.max(0, ((telemetry.rpm - 800) / 7700) * 100));
  const isRedline = telemetry.rpm > 7200;

  // Format gear label
  const gearLabel =
    telemetry.gear === 0
      ? 'N'
      : typeof telemetry.gear === 'number' && telemetry.gear < 0
      ? 'R'
      : `${telemetry.gear}`;

  return (
    <div className="absolute inset-0 pointer-events-none select-none font-racing overflow-hidden z-20">
      {/* 1. Cinematic Letterbox Bars */}
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

      {/* 2. Top Bar (Desktop Only) */}
      {!isMobile && (
        <div className="absolute top-4 left-6 right-6 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center space-x-3 hud-glass-capsule px-4 py-2 rounded-xl border border-white/10">
            <div className="flex items-center space-x-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  activeInputSource === 'gyro' ? 'bg-purple-400 animate-pulse' : 'bg-cyan-400'
                }`}
              />
              <span className="text-xs uppercase font-bold text-gray-300 tracking-wider">
                {activeInputSource === 'gyro' ? `PHONE GYRO (${ping}ms)` : 'KEYBOARD (WASD)'}
              </span>
            </div>
            <span className="text-gray-600">|</span>
            <span className="text-xs text-cyan-300 font-mono font-bold">
              STEER: {input.angleDegrees}°
            </span>
          </div>

          <div className="hud-glass-capsule px-4 py-2 rounded-xl border border-white/10 flex items-center space-x-2 text-xs font-bold text-gray-300">
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span className="tracking-wider">CAMERA [C]</span>
          </div>
        </div>
      )}

      {/* 3. Center Dynamic Event Alerts (Near Miss, Drift Combo, Jump) */}
      <div
        className={`absolute left-0 right-0 flex flex-col items-center pointer-events-none z-20 ${
          isMobile ? 'top-12' : 'top-6'
        }`}
      >
        {nearMissActive && (
          <div className="flex items-center space-x-1.5 px-3.5 py-1 bg-amber-500/25 border border-amber-400/60 rounded-xl animate-bounce mb-1 backdrop-blur-md shadow-lg shadow-amber-500/20">
            <Zap className="w-4 h-4 text-amber-300 animate-pulse" />
            <span className="text-xs font-display font-black text-amber-200 uppercase tracking-widest">
              NEAR MISS! +150 NITRO
            </span>
          </div>
        )}

        {telemetry.isDrifting && (
          <div className="flex flex-col items-center animate-bounce">
            <div className="flex items-center space-x-1.5 px-3.5 py-0.5 rounded-full bg-purple-500/30 border border-purple-400/60 shadow-[0_0_20px_rgba(168,85,247,0.6)] backdrop-blur-md">
              <Flame className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
              <span className="text-xs uppercase font-black tracking-widest text-purple-200">
                DRIFT COMBO {Math.min(4.0, 1.0 + (telemetry.driftScore / 3000) * 0.5).toFixed(1)}x
              </span>
            </div>
            <span className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-400 drop-shadow-[0_2px_14px_rgba(168,85,247,0.85)] mt-0.5 tracking-wider">
              +{telemetry.driftScore} PTS
            </span>
          </div>
        )}

        {telemetry.isJumping && (
          <div className="flex flex-col items-center animate-pulse">
            <span className="text-xs uppercase font-black tracking-widest text-cyan-400 drop-shadow">
              ASPHALT AIR JUMP!
            </span>
            <span className="text-2xl font-display font-black text-cyan-200 tracking-wider">
              AIR TIME
            </span>
          </div>
        )}
      </div>

      {/* 4. Desktop Bottom-Left Tactical Radar Pod (Minimap + G-Force Meter Unified) */}
      {!isMobile && (
        <div className="absolute bottom-6 left-6 hud-glass-pod p-3.5 rounded-3xl flex items-center space-x-3.5 pointer-events-auto border border-white/12 shadow-2xl shadow-black/80">
          <Minimap
            playerPos={playerPos}
            playerHeading={playerHeading}
            splineCurve={splineCurve}
            traffic={traffic}
            opponents={opponents}
            standalone={false}
          />

          {/* Vertical Separator */}
          <div className="w-px h-32 bg-white/10" />

          {/* Circular Telemetry G-Force Meter */}
          <div className="flex flex-col items-center justify-between h-32 w-20 py-0.5 text-center">
            <span className="text-[9px] uppercase font-extrabold tracking-widest text-gray-400">
              G-FORCE
            </span>
            <div className="relative w-16 h-16 rounded-full border border-white/20 flex items-center justify-center bg-black/40 shadow-inner">
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
              <div className="w-9 h-9 rounded-full border border-dashed border-white/15" />
              <div
                className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#00f2fe] transition-transform duration-75"
                style={{
                  transform: `translate(${Math.max(
                    -22,
                    Math.min(22, -input.steer * (telemetry.speedKmh / 160) * 22)
                  )}px, ${Math.max(-22, Math.min(22, (input.brake - input.throttle) * 18))}px)`
                }}
              />
            </div>
            <span className="text-[11px] font-mono font-bold text-cyan-300">
              {(
                Math.sqrt(
                  Math.pow(input.steer * (telemetry.speedKmh / 160) * 1.25, 2) +
                    Math.pow((input.throttle - input.brake) * 0.85, 2)
                )
              ).toFixed(2)}{' '}
              G
            </span>
          </div>
        </div>
      )}

      {/* 5. Mobile Radar Minimap (Top-Left, Compact & Clean) */}
      {isMobile && (
        <div className="absolute top-12 left-3 pointer-events-auto z-20">
          <Minimap
            playerPos={playerPos}
            playerHeading={playerHeading}
            splineCurve={splineCurve}
            traffic={traffic}
            opponents={opponents}
            isMobile={true}
          />
        </div>
      )}

      {/* 6. Desktop Speedometer & Cockpit Telemetry Pod (Bottom-Right) */}
      {!isMobile && (
        <div className="absolute bottom-6 right-6 hud-glass-pod p-4 rounded-3xl border border-white/12 shadow-2xl shadow-black/80 flex flex-col pointer-events-auto min-w-[280px]">
          {/* Top Row: Dual Telemetry Strips (Car Integrity HP & Nitro Fuel) */}
          <div className="grid grid-cols-2 gap-3 pb-2.5 mb-2.5 border-b border-white/10">
            {/* HP Integrity */}
            <div className="flex items-center space-x-1.5">
              <ShieldAlert
                className={`w-3.5 h-3.5 shrink-0 ${
                  telemetry.health < 40
                    ? 'text-rose-400 animate-pulse'
                    : telemetry.health < 75
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              />
              <div className="flex-1 bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    telemetry.health < 40
                      ? 'bg-rose-500'
                      : telemetry.health < 75
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${telemetry.health}%` }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-gray-300 shrink-0">
                {telemetry.health}%
              </span>
            </div>

            {/* Nitro Gauge */}
            <div className="flex items-center space-x-1.5">
              <Flame
                className={`w-3.5 h-3.5 shrink-0 ${
                  input.nitro ? 'text-purple-400 animate-pulse' : 'text-cyan-400'
                }`}
              />
              <div className="flex-1 bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${
                    input.nitro
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_8px_#c084fc]'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                  }`}
                  style={{ width: `${telemetry.nitroFuel}%` }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-gray-300 shrink-0">
                {Math.round(telemetry.nitroFuel)}%
              </span>
            </div>
          </div>

          {/* Main Row: Athletic Gear Badge & High-Contrast Digital Speed */}
          <div className="flex items-center justify-between mb-2 px-1">
            {/* Gear Indicator */}
            <div
              className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center backdrop-blur-md shadow-inner transition-all ${
                gearLabel === 'R'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                  : gearLabel === 'N'
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400 shadow-[0_0_12px_rgba(0,242,254,0.3)]'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.3)]'
              }`}
            >
              <span className="text-[9px] uppercase font-extrabold tracking-wider text-gray-400 leading-none mb-0.5">
                GEAR
              </span>
              <span className="text-3xl font-display font-black leading-none drop-shadow">
                {gearLabel}
              </span>
            </div>

            {/* Speed KM/H Digital Readout */}
            <div className="flex items-baseline space-x-2 pl-4">
              <span className="text-6xl font-display font-black tracking-tighter text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] italic leading-none font-mono">
                {Math.round(telemetry.speedKmh)}
              </span>
              <div className="flex flex-col">
                <span className="text-xs uppercase font-extrabold tracking-widest text-cyan-400 drop-shadow">
                  KM/H
                </span>
                <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider">
                  SPEED
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Row: Dynamic Segmented Racing Tachometer (RPM) */}
          <div className="w-full mt-1">
            <div className="flex items-center justify-between space-x-1 mb-1">
              {Array.from({ length: 18 }).map((_, i) => {
                const isActive = i < Math.round((rpmPercent / 100) * 18);
                let segColor = 'bg-white/10';
                if (isActive) {
                  if (i >= 15) {
                    segColor = isRedline
                      ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e] animate-pulse'
                      : 'bg-rose-500';
                  } else if (i >= 11) {
                    segColor = 'bg-amber-400 shadow-[0_0_8px_#fbbf24]';
                  } else if (i >= 6) {
                    segColor = 'bg-cyan-400 shadow-[0_0_8px_#00f2fe]';
                  } else {
                    segColor = 'bg-cyan-200';
                  }
                }
                return (
                  <div
                    key={i}
                    className={`flex-1 h-2 rounded-xs transform -skew-x-12 transition-all duration-75 ${segColor}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between items-center text-[9px] text-gray-400 font-mono px-0.5">
              <span>0</span>
              <span>4K</span>
              <span>6.5K</span>
              <span
                className={
                  isRedline ? 'text-rose-400 font-bold animate-pulse' : 'text-gray-400'
                }
              >
                {isRedline ? 'SHIFT ⇧' : '8.5K RPM'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 7. Mobile Speedometer & Cockpit Telemetry Capsule (Bottom-Center Ergonomic Float) */}
      {isMobile && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 hud-glass-capsule px-4 py-2 rounded-2xl border border-white/15 flex flex-col items-center pointer-events-none z-20 shadow-2xl min-w-[240px] max-w-[270px]">
          {/* Top Segmented RPM Bar */}
          <div className="flex items-center space-x-1 w-full mb-1">
            {Array.from({ length: 14 }).map((_, i) => {
              const isActive = i < Math.round((rpmPercent / 100) * 14);
              let segColor = 'bg-white/10';
              if (isActive) {
                if (i >= 12) segColor = isRedline ? 'bg-rose-500 animate-pulse' : 'bg-rose-500';
                else if (i >= 9) segColor = 'bg-amber-400';
                else segColor = 'bg-cyan-400';
              }
              return (
                <div
                  key={i}
                  className={`flex-1 h-1.5 rounded-xs transform -skew-x-12 transition-all duration-75 ${segColor}`}
                />
              );
            })}
          </div>

          {/* Main Telemetry: Gear + Speed KM/H */}
          <div className="flex items-center justify-between w-full space-x-3 px-1">
            {/* Gear Badge */}
            <div
              className={`px-2.5 py-0.5 rounded-lg border font-mono flex items-center space-x-1 ${
                gearLabel === 'R'
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                  : gearLabel === 'N'
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              }`}
            >
              <span className="text-[8px] font-bold text-gray-400 uppercase">G</span>
              <span className="text-lg font-display font-black leading-none">{gearLabel}</span>
            </div>

            {/* Speed KM/H */}
            <div className="flex items-baseline space-x-1.5">
              <span className="text-4xl font-display font-black tracking-tight text-white font-mono leading-none drop-shadow">
                {Math.round(telemetry.speedKmh)}
              </span>
              <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                KM/H
              </span>
            </div>

            {/* Redline / Shift badge or RPM */}
            <div className="text-right">
              <span
                className={`text-[9px] font-mono font-bold ${
                  isRedline ? 'text-rose-400 animate-pulse' : 'text-gray-400'
                }`}
              >
                {isRedline ? 'SHIFT!' : `${Math.round(telemetry.rpm)}`}
              </span>
            </div>
          </div>

          {/* Bottom Dual HP & Nitro Micro Strips */}
          <div className="flex items-center space-x-3 w-full mt-1 pt-1 border-t border-white/10 text-[9px] font-mono">
            <div className="flex items-center space-x-1 flex-1">
              <ShieldAlert className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
              <div className="flex-1 bg-white/10 h-1 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    telemetry.health < 40
                      ? 'bg-rose-500'
                      : telemetry.health < 75
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${telemetry.health}%` }}
                />
              </div>
              <span className="text-gray-300">{telemetry.health}%</span>
            </div>
            <div className="flex items-center space-x-1 flex-1">
              <Flame className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
              <div className="flex-1 bg-white/10 h-1 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-75"
                  style={{ width: `${telemetry.nitroFuel}%` }}
                />
              </div>
              <span className="text-gray-300">{Math.round(telemetry.nitroFuel)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
