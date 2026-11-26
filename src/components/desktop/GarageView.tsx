import React, { useState, useEffect, useRef } from 'react';
import { SUPER_CARS, SuperCarConfig } from '../../types';
import { SoundEngine } from '../../game/audio/SoundEngine';
import { CarPreview3D } from '../shared/CarPreview3D';
import { Play, QrCode, ShieldCheck, Palette, Volume2, ArrowLeft, Flame } from 'lucide-react';

interface GarageViewProps {
  onSelectCar: (car: SuperCarConfig) => void;
  selectedCar: SuperCarConfig;
  onOpenGyroModal?: () => void;
  isPhoneConnected: boolean;
  onBackToHome?: () => void;
  isMobileMode?: boolean;
}

const PAINT_SWATCHES = [
  { name: 'Rosso Corsa', hex: 0xd90429, css: '#d90429' },
  { name: 'Velocity Cyan', hex: 0x00e5ff, css: '#00e5ff' },
  { name: 'Obsidian Carbon', hex: 0x121418, css: '#121418' },
  { name: 'Alpine White', hex: 0xf8f9fa, css: '#f8f9fa' },
  { name: 'Midnight Plum', hex: 0x5a189a, css: '#5a189a' },
  { name: 'Signal Gold', hex: 0xf5a623, css: '#f5a623' },
  { name: 'Track Green', hex: 0x10b981, css: '#10b981' },
];

export const GarageView: React.FC<GarageViewProps> = ({
  onSelectCar,
  selectedCar,
  onOpenGyroModal,
  isPhoneConnected,
  onBackToHome,
  isMobileMode = false
}) => {
  const [activeCar, setActiveCar] = useState<SuperCarConfig>(selectedCar);
  const [isRevving, setIsRevving] = useState<boolean>(false);
  const soundRef = useRef<SoundEngine | null>(null);

  useEffect(() => {
    const sound = new SoundEngine();
    soundRef.current = sound;
    return () => {
      sound.dispose();
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onBackToHome) {
        onBackToHome();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onBackToHome]);

  const handleCarClick = (car: SuperCarConfig) => {
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    setActiveCar(car);
  };

  const handleDriveClick = () => {
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    onSelectCar(activeCar);
  };

  const handleRevEngine = () => {
    soundRef.current?.init();
    soundRef.current?.playRevPulse();
    setIsRevving(true);
    setTimeout(() => setIsRevving(false), 900);
  };

  const handlePaintSelect = (hex: number) => {
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    setActiveCar((prev) => ({
      ...prev,
      bodyColorHex: hex
    }));
  };

  const activePaintObj = PAINT_SWATCHES.find((s) => s.hex === activeCar.bodyColorHex);
  const activeHexCss = `#${activeCar.bodyColorHex.toString(16).padStart(6, '0')}`;
  const accelZeroToHundred = (100 / 3.6 / (activeCar.accelerationRate * 1.18)).toFixed(1);

  return (
    <div className="relative w-screen h-[100dvh] overflow-y-auto bg-[#090A0D] flex flex-col justify-between p-3 sm:p-4 font-racing text-[#F4F5F7] select-none">
      {/* Top Studio Header */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-2 pit-surface px-4 py-2.5 rounded-xl border border-white/10 max-w-7xl mx-auto w-full shrink-0">
        <div className="flex items-center space-x-3">
          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-200 hover:text-white border border-white/15 flex items-center gap-1.5 text-xs font-semibold transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isMobileMode ? 'Back to Track' : 'Main Menu'}</span>
            </button>
          )}
          <div className="flex items-center space-x-2.5">
            <span className="w-1 h-5 bg-[#00E5FF] rounded-sm block" />
            <h1 className="text-lg sm:text-xl font-display font-bold tracking-wider text-white">
              Showroom &amp; Paint Bay
            </h1>
          </div>
        </div>

        {!isMobileMode && onOpenGyroModal && (
          <button
            type="button"
            onClick={onOpenGyroModal}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              isPhoneConnected
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/45'
                : 'bg-white/5 text-gray-200 border-white/15 hover:border-[#00E5FF]/50 hover:text-[#00E5FF]'
            }`}
          >
            {isPhoneConnected ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <QrCode className="w-4 h-4 text-[#00E5FF]" />
            )}
            <span>{isPhoneConnected ? 'Phone Wheel Synced' : 'Pair Phone Wheel'}</span>
          </button>
        )}
      </header>

      {/* Main 3D Stage + Car Roster Tabs */}
      <div className="relative z-10 flex-1 flex flex-col justify-center gap-2.5 my-2.5 max-w-7xl mx-auto w-full min-h-0">
        <div className="relative w-full h-56 sm:h-72 lg:flex-1 lg:min-h-[280px] rounded-xl overflow-hidden border border-white/15 bg-[#090A0D]">
          <CarPreview3D
            car={activeCar}
            isRevving={isRevving}
            onRevClick={handleRevEngine}
            showControls={true}
          />
          <div
            className="absolute top-3 left-3 pointer-events-none flex items-center space-x-2.5 bg-[#090A0D]/80 backdrop-blur-md px-3.5 py-2 rounded-lg border border-white/15 border-l-4"
            style={{ borderLeftColor: activeHexCss }}
          >
            <div>
              <h2 className="text-base sm:text-xl font-display font-bold tracking-wider text-white leading-none">
                {activeCar.name}
              </h2>
              <span className="text-[11px] text-gray-400 block mt-0.5">{activeCar.subtitle}</span>
            </div>
          </div>
        </div>

        {/* 5 Clean Horizontal Car Tabs */}
        <div
          className="flex md:grid md:grid-cols-5 gap-2 overflow-x-auto pb-1 md:pb-0 snap-x snap-mandatory shrink-0"
          role="listbox"
          aria-label="Hypercar Lineup"
        >
          {SUPER_CARS.map((car) => {
            const isSelected = activeCar.id === car.id;
            const displayHex = `#${(isSelected ? activeCar.bodyColorHex : car.bodyColorHex).toString(16).padStart(6, '0')}`;
            return (
              <button
                type="button"
                key={car.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleCarClick(car)}
                className={`min-w-[146px] sm:min-w-[168px] md:min-w-0 snap-center relative flex flex-col justify-between p-2.5 rounded-lg cursor-pointer transition-all text-left border ${
                  isSelected
                    ? 'bg-[#12141A] border-[#00E5FF] shadow-[0_0_20px_rgba(0,229,255,0.12)]'
                    : 'bg-[#0D0F14]/90 border-white/10 hover:border-white/25 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0 border border-white/40"
                      style={{ backgroundColor: displayHex }}
                    />
                    <span className="font-display font-bold text-xs sm:text-sm tracking-wider text-white">
                      {car.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-[#00E5FF] font-bold">
                    {car.topSpeedKmh}
                  </span>
                </div>

                <div className="w-full h-1 bg-white/10 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-[#00E5FF]"
                    style={{ width: `${(car.topSpeedKmh / 335) * 100}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Paint Swatches, Rev & Track Launch Dock */}
      <div className="relative z-10 pit-surface px-4 py-3 sm:px-5 rounded-xl border border-white/10 max-w-7xl mx-auto w-full flex flex-col lg:flex-row items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-300">
            <Palette className="w-4 h-4 text-[#00E5FF]" />
            <span>Paint:</span>
            <span className="text-white">{activePaintObj ? activePaintObj.name : 'Custom'}</span>
          </div>

          <div className="flex items-center space-x-2">
            {PAINT_SWATCHES.map((swatch) => {
              const isActive = activeCar.bodyColorHex === swatch.hex;
              return (
                <button
                  key={swatch.name}
                  type="button"
                  aria-label={`Select ${swatch.name} paint`}
                  onClick={() => handlePaintSelect(swatch.hex)}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full transition-transform flex items-center justify-center ${
                    isActive
                      ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#12141A]'
                      : 'opacity-80 hover:opacity-100 hover:scale-110'
                  }`}
                  style={{ backgroundColor: swatch.css }}
                  title={swatch.name}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleRevEngine}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              isRevving
                ? 'bg-[#FF3B30] border-[#FF3B30] text-white'
                : 'bg-black/45 border-white/15 text-[#F5A623] hover:bg-[#F5A623]/15'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>{isRevving ? '8,500 RPM!' : 'Rev V8'}</span>
            <Volume2 className="w-3.5 h-3.5 opacity-60" />
          </button>
        </div>

        {/* Crisp Spec Comparison + Primary CTA */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-5 w-full lg:w-auto">
          <div className="flex items-center space-x-4 text-left text-xs">
            <div>
              <span className="text-gray-400 block text-[10px]">Top Speed</span>
              <span className="font-display font-bold text-base tabular-nums text-white">
                {activeCar.topSpeedKmh} <span className="text-[10px] text-gray-500">km/h</span>
              </span>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div>
              <span className="text-gray-400 block text-[10px]">0–100 km/h</span>
              <span className="font-display font-bold text-base tabular-nums text-white">
                {accelZeroToHundred} <span className="text-[10px] text-gray-500">s</span>
              </span>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div>
              <span className="text-gray-400 block text-[10px]">Grip</span>
              <span className="font-display font-bold text-base tabular-nums text-[#00E5FF]">
                {activeCar.handlingScore}
              </span>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div>
              <span className="text-gray-400 block text-[10px]">Drift</span>
              <span className="font-display font-bold text-base tabular-nums text-[#F5A623]">
                {activeCar.driftFactor}x
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDriveClick}
            className="w-full sm:w-auto px-7 py-2.5 bg-[#FF3B30] hover:bg-[#ff5147] active:scale-[0.99] text-white font-display font-bold text-sm tracking-wider uppercase rounded-lg shadow-[0_8px_24px_rgba(255,59,48,0.35)] transition-all flex items-center justify-center space-x-2"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Drive {activeCar.name}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
