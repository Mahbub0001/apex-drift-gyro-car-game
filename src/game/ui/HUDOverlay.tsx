import React from 'react';
import * as THREE from 'three';
import {
  VehicleTelemetry,
  ControllerInput,
  TrafficCarState,
  RemotePlayerState,
  TransmissionMode
} from '../../types';
import { Minimap } from './Minimap';
import { Flame, Camera, Zap, ShieldAlert, AlertTriangle, Pause, Trophy, ArrowUp } from 'lucide-react';

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
  transmissionMode?: TransmissionMode;
  onToggleTransmission?: () => void;
  onCameraClick?: () => void;
  onPauseClick?: () => void;
}

function formatStopwatch(ms: number): string {
  const totalSeconds = Math.max(0, ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((ms % 1000) / 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
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
  isMobile = false,
  transmissionMode = telemetry.transmissionMode || 'auto',
  onToggleTransmission,
  onCameraClick,
  onPauseClick
}) => {
  const rpmPercent = Math.min(100, Math.max(0, ((telemetry.rpm - 800) / 7700) * 100));
  const isRedline = telemetry.rpm > 7200;
  const isAuto = transmissionMode === 'auto';

  const gearLabel =
    telemetry.gear === 'R'
      ? 'R'
      : telemetry.gear === 'N' || telemetry.gear === 0
      ? 'N'
      : `${telemetry.gear}`;

  const gearBoxStyle =
    gearLabel === 'R'
      ? 'bg-[#FF3B30]/20 border-[#FF3B30] text-[#FF3B30]'
      : gearLabel === 'N'
      ? 'bg-[#00E5FF]/15 border-[#00E5FF]/60 text-[#00E5FF]'
      : telemetry.shouldShiftUp
      ? 'bg-[#FF3B30]/35 border-[#FF3B30] text-white animate-pulse'
      : isAuto
      ? 'bg-[#00E5FF]/15 border-[#00E5FF]/55 text-[#00E5FF]'
      : 'bg-[#F5A623]/15 border-[#F5A623]/55 text-[#F5A623]';

  return (
    <div className="absolute inset-0 pointer-events-none select-none font-racing overflow-hidden z-20 text-[#F4F5F7]">
      {/* 1. Cinematic Letterbox Bars for Jumps */}
      <div
        className={`absolute top-0 left-0 right-0 bg-[#090A0D] transition-all duration-300 z-30 ${
          isLetterboxed ? 'h-12 sm:h-16' : 'h-0'
        }`}
      />
      <div
        className={`absolute bottom-0 left-0 right-0 bg-[#090A0D] transition-all duration-300 z-30 ${
          isLetterboxed ? 'h-12 sm:h-16' : 'h-0'
        }`}
      />

      {/* 2. Desktop Top Bar: Timing Telemetry Strip + View Controls */}
      {!isMobile && (
        <>
          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 flex items-center space-x-2 md:space-x-3 pit-hud-capsule px-3 md:px-4 py-1.5 rounded-lg border border-white/15 whitespace-nowrap">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-semibold uppercase text-gray-400">LAP</span>
              <span className="text-sm font-display font-bold tabular-nums text-[#00E5FF]">
                {telemetry.lap || 1}
              </span>
            </div>
            <span className="text-white/15">|</span>
            <div className="flex items-center space-x-1.5 font-mono text-xs tabular-nums">
              <span className="text-gray-400">TIME</span>
              <span className="text-white font-bold">{formatStopwatch(telemetry.lapTimeMs || 0)}</span>
            </div>
            {telemetry.bestLapTimeMs != null && (
              <>
                <span className="text-white/15">|</span>
                <div className="flex items-center space-x-1 font-mono text-xs tabular-nums">
                  <span className="text-[#F5A623]">BEST</span>
                  <span className="text-[#F4F5F7] font-bold">{formatStopwatch(telemetry.bestLapTimeMs)}</span>
                </div>
              </>
            )}
            <span className="text-white/15">|</span>
            <div className="flex items-center space-x-1.5 font-mono text-xs tabular-nums">
              <Trophy className="w-3.5 h-3.5 text-[#F5A623]" />
              <span className="text-[#F5A623] font-bold">{(telemetry.totalScore || 0).toLocaleString()}</span>
            </div>
          </div>

          <div className="absolute top-3.5 right-4 flex items-center space-x-2 pointer-events-auto">
            <div className="hidden xl:flex items-center space-x-2 pit-hud-capsule px-3 py-1.5 rounded-lg border border-white/15">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  activeInputSource === 'gyro' ? 'bg-emerald-400 animate-pulse' : 'bg-[#00E5FF]'
                }`}
              />
              <span className="text-[11px] font-semibold text-gray-200">
                {activeInputSource === 'gyro' ? `Gyro (${ping}ms)` : 'Keyboard'}
              </span>
              <span className="text-white/20">|</span>
              <span className="text-[11px] text-[#00E5FF] font-mono tabular-nums font-bold">
                {input.angleDegrees}°
              </span>
            </div>

            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.currentTarget.blur();
                onCameraClick?.();
              }}
              className="pit-hud-capsule hover:bg-white/15 active:scale-95 transition-all px-3 py-1.5 rounded-lg border border-white/15 flex items-center space-x-1.5 text-xs font-semibold text-gray-200"
              title="Switch Camera View (C Key)"
            >
              <Camera className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>{telemetry.cameraMode === 'hood' ? 'Hood [C]' : 'Chase [C]'}</span>
            </button>

            {onPauseClick && (
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPauseClick();
                }}
                aria-label="Open pause menu"
                className="pit-hud-capsule hover:bg-white/15 active:scale-95 transition-all p-2 rounded-lg border border-white/15 text-gray-200"
                title="Pause & Settings (Esc)"
              >
                <Pause className="w-4 h-4 text-[#00E5FF]" />
              </button>
            )}
          </div>
        </>
      )}

      {/* 3. Center Kinetic Event Callouts */}
      <div
        className={`absolute left-0 right-0 flex flex-col items-center pointer-events-none z-20 ${
          isMobile ? 'top-12' : 'top-14'
        }`}
      >
        {telemetry.isWrongWay && (
          <div className="flex items-center space-x-2 px-4 py-1.5 bg-[#FF3B30] border border-white/40 rounded-lg mb-1.5 shadow-[0_0_24px_rgba(255,59,48,0.65)]">
            <AlertTriangle className="w-4 h-4 text-white" />
            <span className="text-xs sm:text-sm font-display font-bold text-white uppercase tracking-widest">
              Wrong Way — Turn Around
            </span>
          </div>
        )}

        {telemetry.isNewBestLap && (
          <div className="flex items-center space-x-2 px-4 py-1.5 bg-[#12141A]/90 border border-[#F5A623] rounded-lg mb-1.5 shadow-lg">
            <Trophy className="w-4 h-4 text-[#F5A623]" />
            <span className="text-xs sm:text-sm font-display font-bold text-[#F5A623] tracking-wider">
              New Best Lap • {telemetry.bestLapTimeMs != null ? formatStopwatch(telemetry.bestLapTimeMs) : ''}
            </span>
          </div>
        )}

        {nearMissActive && (
          <div className="flex items-center space-x-1.5 px-3.5 py-1 bg-[#12141A]/90 border border-[#00E5FF] rounded-lg mb-1">
            <Zap className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span className="text-xs font-display font-bold text-[#00E5FF] tracking-wider">
              Near Miss +30 Nitro
            </span>
          </div>
        )}

        {telemetry.isDrifting && (
          <div className="flex flex-col items-center">
            <div className="flex items-center space-x-1.5 px-3 py-0.5 rounded bg-[#12141A]/90 border border-[#F5A623]/70">
              <Flame className="w-3.5 h-3.5 text-[#F5A623]" />
              <span className="text-[11px] font-bold tracking-wider text-[#F5A623] tabular-nums">
                DRIFT x{Math.min(4.0, 1.0 + (telemetry.driftScore / 3000) * 0.5).toFixed(1)}
              </span>
            </div>
            <span className="text-2xl sm:text-3xl font-display font-bold tabular-nums text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] mt-0.5">
              +{telemetry.driftScore}
            </span>
          </div>
        )}

        {!telemetry.isDrifting && (telemetry.lastBankedDrift || 0) > 0 && (
          <div className="px-3 py-1 rounded bg-emerald-500/20 border border-emerald-400/60 text-xs font-display font-bold text-emerald-300 tabular-nums">
            +{telemetry.lastBankedDrift} Drift Banked
          </div>
        )}

        {telemetry.isJumping && (
          <div className="px-3.5 py-1 rounded bg-[#090A0D]/80 border border-[#00E5FF]/60 text-xs font-display font-bold tracking-widest text-[#00E5FF] uppercase">
            Air Time
          </div>
        )}
      </div>

      {/* 4. Desktop Bottom-Left GPS Radar + G-Meter */}
      {!isMobile && (
        <div className="absolute bottom-5 left-5 pit-hud-pod p-3.5 rounded-xl flex items-center space-x-3.5 pointer-events-auto border border-white/15">
          <Minimap
            playerPos={playerPos}
            playerHeading={playerHeading}
            splineCurve={splineCurve}
            traffic={traffic}
            opponents={opponents}
            standalone={false}
          />

          <div className="w-px h-32 bg-white/10" />

          <div className="flex flex-col items-center justify-between h-32 w-20 py-0.5 text-center">
            <span className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
              G-Force
            </span>
            <div className="relative w-16 h-16 rounded-full border border-white/20 flex items-center justify-center bg-[#090A0D]">
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/10 pointer-events-none" />
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/10 pointer-events-none" />
              <div className="absolute w-8 h-8 rounded-full border border-dashed border-white/15 pointer-events-none" />
              <div
                className="relative z-10 w-2.5 h-2.5 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF] transition-transform duration-75"
                style={{
                  transform: `translate(${Math.max(
                    -22,
                    Math.min(22, -input.steer * (telemetry.speedKmh / 160) * 22)
                  )}px, ${Math.max(-22, Math.min(22, (input.brake - input.throttle) * 18))}px)`
                }}
              />
            </div>
            <span className="text-[11px] font-mono tabular-nums font-bold text-[#00E5FF]">
              {Math.sqrt(
                Math.pow(input.steer * (telemetry.speedKmh / 160) * 1.25, 2) +
                  Math.pow((input.throttle - input.brake) * 0.85, 2)
              ).toFixed(2)}{' '}
              G
            </span>
          </div>
        </div>
      )}

      {/* 5. Mobile Compact Radar + Lap/Score */}
      {isMobile && (
        <div className="absolute top-12 left-2.5 pointer-events-auto z-20 flex flex-col space-y-1">
          <Minimap
            playerPos={playerPos}
            playerHeading={playerHeading}
            splineCurve={splineCurve}
            traffic={traffic}
            opponents={opponents}
            isMobile={true}
          />
          <div className="pit-hud-capsule px-2 py-0.5 rounded-md border border-white/15 flex items-center justify-between text-[9px] font-mono tabular-nums text-gray-200">
            <span>L{telemetry.lap || 1}</span>
            <span className="text-[#F5A623] font-bold">{(telemetry.totalScore || 0).toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* 6. Desktop Bottom-Right Motorsport Tachometer Cluster */}
      {!isMobile && (
        <div className="absolute bottom-5 right-5 pit-hud-pod p-4 rounded-xl border border-white/15 flex flex-col pointer-events-auto min-w-[300px]">
          {/* Health & Nitro Bars */}
          <div className="grid grid-cols-2 gap-3 pb-2.5 mb-2.5 border-b border-white/10">
            <div className="flex items-center space-x-1.5">
              <ShieldAlert
                className={`w-3.5 h-3.5 shrink-0 ${
                  telemetry.health < 40
                    ? 'text-[#FF3B30] animate-pulse'
                    : telemetry.health < 75
                    ? 'text-[#F5A623]'
                    : 'text-emerald-400'
                }`}
              />
              <div className="flex-1 bg-white/10 h-1.5 rounded-sm overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    telemetry.health < 40
                      ? 'bg-[#FF3B30]'
                      : telemetry.health < 75
                      ? 'bg-[#F5A623]'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${telemetry.health}%` }}
                />
              </div>
              <span className="text-[10px] font-mono tabular-nums font-bold text-gray-200 shrink-0">
                {telemetry.health}%
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              <Flame
                className={`w-3.5 h-3.5 shrink-0 ${
                  input.nitro ? 'text-[#00E5FF] animate-pulse' : 'text-gray-400'
                }`}
              />
              <div className="flex-1 bg-white/10 h-1.5 rounded-sm overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${
                    input.nitro ? 'bg-[#00E5FF]' : 'bg-[#00E5FF]/80'
                  }`}
                  style={{ width: `${telemetry.nitroFuel}%` }}
                />
              </div>
              <span className="text-[10px] font-mono tabular-nums font-bold text-gray-200 shrink-0">
                {Math.round(telemetry.nitroFuel)}%
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-2.5">
            {/* Gearbox Square + Clickable Auto/Manual Mode Toggle */}
            <div className="flex flex-col items-center space-y-1">
              <div
                className={`w-14 h-12 rounded-lg border flex flex-col items-center justify-center transition-colors ${gearBoxStyle}`}
              >
                <span className="text-3xl font-display font-bold leading-none tabular-nums">
                  {gearLabel}
                </span>
              </div>

              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleTransmission?.();
                }}
                title="Switch between Automatic and Manual Gearbox (G)"
                className={`w-14 py-0.5 rounded border text-[9px] font-mono font-bold tracking-wider transition-colors ${
                  isAuto
                    ? 'bg-[#00E5FF]/15 border-[#00E5FF]/45 text-[#00E5FF] hover:bg-[#00E5FF]/25'
                    : 'bg-[#F5A623]/15 border-[#F5A623]/55 text-[#F5A623] hover:bg-[#F5A623]/25'
                }`}
              >
                {isAuto ? 'AUTO [G]' : 'MAN [G]'}
              </button>
            </div>

            {/* Digital Speedometer */}
            <div className="flex flex-col items-end pl-4">
              {telemetry.shouldShiftUp && (
                <div className="flex items-center space-x-1 text-[10px] font-mono font-bold text-white bg-[#FF3B30] px-2 py-0.5 rounded mb-1 animate-pulse">
                  <ArrowUp className="w-3 h-3" />
                  <span>SHIFT UP</span>
                </div>
              )}
              <div className="flex items-baseline space-x-2">
                <span className="text-6xl font-display font-bold tracking-tight text-white tabular-nums italic leading-none">
                  {Math.round(telemetry.speedKmh)}
                </span>
                <span className="text-xs font-bold tracking-widest text-[#00E5FF]">KM/H</span>
              </div>
            </div>
          </div>

          {/* 20-Segment High-Contrast Tachometer Bar */}
          <div className="w-full">
            <div className="flex items-center justify-between space-x-1 mb-1.5">
              {Array.from({ length: 20 }).map((_, i) => {
                const isActive = i < Math.round((rpmPercent / 100) * 20);
                let segColor = 'bg-white/10';
                if (isActive) {
                  if (i >= 17) {
                    segColor = isRedline ? 'bg-[#FF3B30] shadow-[0_0_8px_#FF3B30]' : 'bg-[#FF3B30]';
                  } else if (i >= 13) {
                    segColor = 'bg-[#F5A623]';
                  } else if (i >= 6) {
                    segColor = 'bg-[#00E5FF]';
                  } else {
                    segColor = 'bg-[#F4F5F7]';
                  }
                }
                return (
                  <div
                    key={i}
                    className={`flex-1 h-2 rounded-[1px] transform -skew-x-12 transition-colors duration-75 ${segColor}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono tabular-nums">
              {isAuto ? (
                <>
                  <span>[G] Manual</span>
                  <span>[F] Nitro</span>
                  <span>[Space] Drift</span>
                </>
              ) : (
                <>
                  <span>[Shift] Up</span>
                  <span>[Ctrl/Q] Down</span>
                  <span>[F] Nitro</span>
                </>
              )}
              <span className={isRedline ? 'text-[#FF3B30] font-bold' : 'text-gray-300'}>
                {Math.round(telemetry.rpm)} RPM
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 7. Mobile Sleek Bottom Telemetry Capsule (Always Centered!) */}
      {isMobile && (
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 pit-hud-capsule px-2.5 md:px-3.5 py-1.5 rounded-xl border border-white/20 flex flex-col items-center pointer-events-auto z-20 min-w-[162px] md:min-w-[215px]">
          <div className="flex items-center space-x-0.5 w-full mb-1">
            {Array.from({ length: 14 }).map((_, i) => {
              const isActive = i < Math.round((rpmPercent / 100) * 14);
              let segColor = 'bg-white/15';
              if (isActive) {
                if (i >= 12) segColor = 'bg-[#FF3B30]';
                else if (i >= 9) segColor = 'bg-[#F5A623]';
                else segColor = 'bg-[#00E5FF]';
              }
              return (
                <div
                  key={i}
                  className={`flex-1 h-1 rounded-[1px] transform -skew-x-12 transition-colors duration-75 ${segColor}`}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between w-full space-x-2 px-0.5">
            <button
              type="button"
              onClick={() => onToggleTransmission?.()}
              className={`px-2 py-0.5 rounded border font-mono flex items-center space-x-1 ${gearBoxStyle}`}
              title="Tap to toggle Auto / Manual gearbox"
            >
              <span className="text-[8px] font-bold opacity-80">{isAuto ? 'A' : 'M'}</span>
              <span className="text-base font-display font-bold leading-none tabular-nums">
                {gearLabel}
              </span>
            </button>

            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-display font-bold tracking-tight text-white tabular-nums leading-none">
                {Math.round(telemetry.speedKmh)}
              </span>
              <span className="text-[9px] font-bold text-[#00E5FF]">KM/H</span>
            </div>

            <div className="text-right min-w-[40px]">
              <span
                className={`text-[9px] font-mono tabular-nums font-bold ${
                  telemetry.shouldShiftUp || isRedline ? 'text-[#FF3B30]' : 'text-gray-300'
                }`}
              >
                {telemetry.shouldShiftUp ? 'SHIFT ▲' : `${Math.round(telemetry.rpm)}`}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 w-full mt-1 pt-1 border-t border-white/10 text-[9px] font-mono tabular-nums">
            <div className="flex items-center space-x-1 flex-1">
              <ShieldAlert className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
              <div className="flex-1 bg-white/15 h-1 rounded-sm overflow-hidden">
                <div
                  className={`h-full ${
                    telemetry.health < 40
                      ? 'bg-[#FF3B30]'
                      : telemetry.health < 75
                      ? 'bg-[#F5A623]'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${telemetry.health}%` }}
                />
              </div>
              <span className="text-gray-200">{telemetry.health}%</span>
            </div>
            <div className="flex items-center space-x-1 flex-1">
              <Flame className="w-2.5 h-2.5 text-[#00E5FF] shrink-0" />
              <div className="flex-1 bg-white/15 h-1 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-[#00E5FF]"
                  style={{ width: `${telemetry.nitroFuel}%` }}
                />
              </div>
              <span className="text-gray-200">{Math.round(telemetry.nitroFuel)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
