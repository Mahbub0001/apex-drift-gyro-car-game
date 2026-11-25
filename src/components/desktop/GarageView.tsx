import React, { useState, useEffect, useRef } from 'react';
import { SUPER_CARS, SuperCarConfig } from '../../types';
import { SoundEngine } from '../../game/audio/SoundEngine';
import { CarPreview3D } from '../shared/CarPreview3D';
import { Zap, Gauge, Award, Flame, Play, QrCode, ShieldCheck, Palette, Volume2, ArrowLeft } from 'lucide-react';

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
  { name: 'Cyber Cyan', hex: 0x00f2fe, css: '#00f2fe' },
  { name: 'Obsidian Black', hex: 0x121418, css: '#121418' },
  { name: 'Alpine White', hex: 0xf8f9fa, css: '#f8f9fa' },
  { name: 'Ultraviolet', hex: 0x7928ca, css: '#7928ca' },
  { name: 'Sunset Gold', hex: 0xffb703, css: '#ffb703' },
  { name: 'Acid Green', hex: 0x10b981, css: '#10b981' },
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

  return (
    <div className="relative w-screen h-[100dvh] overflow-y-auto bg-[#07090e] flex flex-col justify-between p-3 sm:p-4 font-racing text-white select-none">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(0,242,254,0.08),transparent_60%)]" />

      {/* Top Header */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-2 glass-panel px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl border border-white/10 backdrop-blur-md max-w-7xl mx-auto w-full shrink-0">
        <div className="flex items-center space-x-3">
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white border border-white/15 flex items-center gap-1.5 text-xs font-bold font-mono transition-all shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isMobileMode ? 'RACE' : 'MENU'}</span>
            </button>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg sm:text-2xl font-display font-extrabold tracking-wider bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                3D HYPERCAR SHOWROOM
              </h1>
              <span className="hidden sm:inline-block text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 uppercase tracking-widest">
                INTERACTIVE TURNTABLES
              </span>
            </div>
          </div>
        </div>

        {!isMobileMode && onOpenGyroModal && (
          <button
            onClick={onOpenGyroModal}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border font-display text-xs font-bold uppercase tracking-wider transition-all shadow-lg ${
              isPhoneConnected
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-500/20'
                : 'glass-panel text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/20 shadow-cyan-500/10'
            }`}
          >
            {isPhoneConnected ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <QrCode className="w-4 h-4 text-cyan-400" />}
            <span>{isPhoneConnected ? 'Gyro Connected' : 'Pair Smartphone Gyro'}</span>
          </button>
        )}
      </header>

      {/* Main 3D Interactive Stage + Roster Selector */}
      <div className="relative z-10 flex-1 flex flex-col justify-center gap-2.5 my-2 max-w-7xl mx-auto w-full min-h-0">
        {/* Live 360 Interactive 3D Car View */}
        <div className="relative w-full h-52 sm:h-64 lg:flex-1 lg:min-h-[260px] rounded-2xl overflow-hidden border border-white/15 bg-[#070a12] shadow-2xl">
          <CarPreview3D
            car={activeCar}
            isRevving={isRevving}
            onRevClick={handleRevEngine}
            showControls={true}
          />
          {/* Floating Spec Badge Bottom-Left */}
          <div className="absolute bottom-3 left-3.5 pointer-events-none flex items-center space-x-2">
            <span className="px-3 py-1 rounded-xl bg-black/65 backdrop-blur-md border border-white/15 text-xs font-display font-black tracking-wider text-white">
              {activeCar.name}
            </span>
            <span
              className="px-2.5 py-1 rounded-xl bg-black/65 backdrop-blur-md border text-[10px] font-mono uppercase tracking-wider font-bold"
              style={{
                color: activeHexCss === '#121418' ? '#cbd5e1' : activeHexCss,
                borderColor: `${activeHexCss}66`
              }}
            >
              {activeCar.subtitle}
            </span>
          </div>
        </div>

        {/* 5 Clean Interactive Roster Selector Cards */}
        <div
          className="flex md:grid md:grid-cols-5 gap-2.5 overflow-x-auto pb-1 md:pb-0 snap-x snap-mandatory shrink-0"
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
                className={`min-w-[148px] sm:min-w-[170px] md:min-w-0 snap-center relative flex flex-col justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-200 text-left ${
                  isSelected
                    ? 'bg-gradient-to-b from-cyan-500/20 to-black/85 border-2 border-cyan-400 shadow-lg shadow-cyan-500/25'
                    : 'glass-panel border border-white/10 hover:border-white/30 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/60 shadow shrink-0"
                      style={{ backgroundColor: displayHex }}
                    />
                    <span className="font-display font-black text-xs sm:text-sm tracking-wider text-white">
                      {car.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-300 font-bold">
                    {car.topSpeedKmh}
                  </span>
                </div>

                {/* Spec Quick Bars */}
                <div className="space-y-1 text-[9px] font-mono text-gray-400">
                  <div className="flex items-center justify-between">
                    <span>GRIP</span>
                    <span className="text-purple-300 font-bold">{car.handlingScore}/10</span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-purple-400"
                      style={{ width: `${(car.topSpeedKmh / 335) * 100}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Paint & Engine Rev Bar */}
      <div className="relative z-10 glass-panel px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl border border-white/10 backdrop-blur-md max-w-7xl mx-auto w-full flex flex-wrap items-center justify-between gap-2.5 shadow-xl my-1 shrink-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-gray-300 font-display uppercase tracking-wider">
            <Palette className="w-4 h-4 text-cyan-400" />
            <span>LIVE 3D PAINT:</span>
            {activePaintObj && <span className="text-cyan-300 font-mono text-[11px]">{activePaintObj.name}</span>}
          </div>
          <div className="flex items-center space-x-2">
            {PAINT_SWATCHES.map((swatch) => {
              const isActive = activeCar.bodyColorHex === swatch.hex;
              return (
                <button
                  key={swatch.name}
                  aria-label={`Select ${swatch.name} paint`}
                  onClick={() => handlePaintSelect(swatch.hex)}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full transition-all duration-200 transform hover:scale-125 flex items-center justify-center relative ${
                    isActive
                      ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#080b12] shadow-[0_0_12px_rgba(255,255,255,0.7)]'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: swatch.css }}
                  title={swatch.name}
                >
                  {isActive && <div className="w-2 h-2 rounded-full bg-white shadow-sm" />}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleRevEngine}
          className={`flex items-center space-x-2 px-4 py-1.5 sm:py-2 rounded-xl border font-display text-xs font-extrabold uppercase tracking-wider transition-all duration-150 active:scale-95 shadow-lg ${
            isRevving
              ? 'bg-rose-600 border-rose-400 text-white shadow-rose-500/50 animate-pulse scale-105'
              : 'bg-black/60 border-amber-500/40 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400 shadow-amber-500/20'
          }`}
          title="Rev the V8 twin-turbo engine"
        >
          <Flame className={`w-4 h-4 ${isRevving ? 'text-white animate-spin' : 'text-amber-400'}`} />
          <span>{isRevving ? '8,500 RPM EXHAUST POP!' : 'REV V8 ENGINE'}</span>
          <Volume2 className="w-3.5 h-3.5 opacity-60 ml-0.5" />
        </button>
      </div>

      {/* Bottom Launch Bar */}
      <div className="relative z-10 glass-panel p-3.5 sm:p-4 rounded-2xl border border-white/10 backdrop-blur-md flex flex-col lg:flex-row items-center justify-between gap-3 shadow-2xl max-w-7xl mx-auto w-full shrink-0">
        <p className="text-xs text-gray-300 max-w-md text-center lg:text-left leading-relaxed hidden sm:block">
          {activeCar.description}
        </p>

        <div className="flex items-center space-x-4 sm:space-x-6 bg-black/45 px-4 sm:px-5 py-2 rounded-xl border border-white/5">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-cyan-400 mb-0.5">
              <Gauge className="w-3 h-3" />
              <span className="text-[9px] uppercase font-bold">TOP SPEED</span>
            </div>
            <span className="text-base sm:text-xl font-display font-extrabold text-white">
              {activeCar.topSpeedKmh} <span className="text-[10px] text-gray-400">KM/H</span>
            </span>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-emerald-400 mb-0.5">
              <Zap className="w-3 h-3" />
              <span className="text-[9px] uppercase font-bold">0-100</span>
            </div>
            <span className="text-base sm:text-xl font-display font-extrabold text-white">
              {(100 / 3.6 / (activeCar.accelerationRate * 1.18)).toFixed(1)} <span className="text-[10px] text-gray-400">S</span>
            </span>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-purple-400 mb-0.5">
              <Award className="w-3 h-3" />
              <span className="text-[9px] uppercase font-bold">GRIP</span>
            </div>
            <span className="text-base sm:text-xl font-display font-extrabold text-white">
              {activeCar.handlingScore}
            </span>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-amber-400 mb-0.5">
              <Flame className="w-3 h-3" />
              <span className="text-[9px] uppercase font-bold">DRIFT</span>
            </div>
            <span className="text-base sm:text-xl font-display font-extrabold text-white">
              {activeCar.driftFactor}x
            </span>
          </div>
        </div>

        <button
          onClick={handleDriveClick}
          className="w-full lg:w-auto px-7 py-3 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-display font-extrabold text-sm sm:text-base uppercase tracking-wider rounded-xl shadow-xl shadow-cyan-500/30 transition-all transform active:scale-95 flex items-center justify-center space-x-3 cursor-pointer"
        >
          <span>ENTER TRACK • DRIVE {activeCar.name}</span>
          <Play className="w-5 h-5 fill-white" />
        </button>
      </div>
    </div>
  );
};
