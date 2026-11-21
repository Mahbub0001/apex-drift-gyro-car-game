import React, { useState, useEffect, useRef } from 'react';
import { SUPER_CARS, SuperCarConfig } from '../../types';
import { SoundEngine } from '../../game/audio/SoundEngine';
import { Zap, Gauge, Award, Flame, Play, QrCode, ShieldCheck, Palette, Volume2 } from 'lucide-react';

interface GarageViewProps {
  onSelectCar: (car: SuperCarConfig) => void;
  selectedCar: SuperCarConfig;
  onOpenGyroModal: () => void;
  isPhoneConnected: boolean;
  onBackToHome?: () => void;
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
  onBackToHome
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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#07090e] flex flex-col justify-between p-6 font-racing text-white select-none">
      {/* Background Cinematic Garage Texture (Real Hangar Showroom) */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30 pointer-events-none filter blur-[1px] scale-105"
        style={{ backgroundImage: `url('/images/garage_hero.jpg')` }}
      />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#06080d] via-[#080b12]/80 to-[#06080d]/90" />

      {/* Top Header */}
      <div className="relative z-10 flex items-center justify-between glass-panel px-6 py-4 rounded-2xl border border-white/10 backdrop-blur-md">
        <div className="flex items-center space-x-4">
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white border border-white/10 flex items-center gap-1.5 text-xs font-bold font-mono transition-all"
            >
              ← MENU
            </button>
          )}
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-display font-extrabold tracking-wider bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                APEX DRIFT SHOWROOM
              </h1>
              <span className="text-[11px] px-3 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 uppercase tracking-widest">
                HYPERCAR FLEET
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Choose your competition track weapon • Steer with Keyboard (A/D or Arrows) or Smartphone Gyroscope
            </p>
          </div>
        </div>

        {/* Gyro Remote Status & QR Trigger */}
        <button
          onClick={onOpenGyroModal}
          className={`flex items-center space-x-2.5 px-4 py-2.5 rounded-xl border font-display text-xs font-bold uppercase tracking-wider transition-all pointer-events-auto shadow-lg ${
            isPhoneConnected
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-500/20'
              : 'glass-panel text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/20 shadow-cyan-500/10'
          }`}
        >
          {isPhoneConnected ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <QrCode className="w-4 h-4 text-cyan-400" />}
          <span>{isPhoneConnected ? 'Phone Gyro Connected' : 'Pair Smartphone Gyro'}</span>
        </button>
      </div>

      {/* Center 5 Supercars Lineup (Matching User Reference Image Exactly!) */}
      <div className="relative z-10 flex-1 flex flex-col justify-center my-2 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-5 gap-4">
          {SUPER_CARS.map((car) => {
            const isSelected = activeCar.id === car.id;
            return (
              <div
                key={car.id}
                onClick={() => handleCarClick(car)}
                className={`relative flex flex-col items-center p-3 rounded-2xl cursor-pointer transition-all duration-300 transform group ${
                  isSelected
                    ? 'scale-105 bg-gradient-to-b from-white/10 to-black/80 border-2 border-cyan-400 shadow-2xl shadow-cyan-500/40 ring-2 ring-cyan-400/30'
                    : 'glass-panel border border-white/10 hover:border-white/30 hover:scale-102 opacity-75 hover:opacity-100'
                }`}
              >
                {/* Car Realistic Preview Card */}
                <div className="w-full h-36 rounded-xl relative overflow-hidden flex items-center justify-center mb-3 bg-black/60 border border-white/5">
                  {/* Glowing Underglow Effect */}
                  <div
                    className="absolute -bottom-4 inset-x-4 h-12 blur-lg opacity-75 transition-colors duration-300"
                    style={{
                      backgroundColor: `#${(isSelected ? activeCar.bodyColorHex : car.bodyColorHex).toString(16).padStart(6, '0')}`
                    }}
                  />

                  {/* Supercar Photo Cutout */}
                  <img
                    src={`/images/cars/${car.id}.jpg`}
                    alt={car.name}
                    className={`w-full h-full object-cover object-center transform group-hover:scale-110 transition-transform duration-500 rounded-lg ${
                      isSelected && isRevving ? 'animate-pulse scale-105' : ''
                    }`}
                  />

                  {/* Dynamic Exhaust Flame Flare when Revving */}
                  {isSelected && isRevving && (
                    <div className="absolute inset-x-0 bottom-1 flex justify-center space-x-12 pointer-events-none z-30">
                      <div className="w-3.5 h-7 bg-gradient-to-t from-cyan-400 via-amber-400 to-transparent rounded-full blur-[1px] animate-ping" />
                      <div className="w-3.5 h-7 bg-gradient-to-t from-cyan-400 via-amber-400 to-transparent rounded-full blur-[1px] animate-ping" />
                    </div>
                  )}

                  {/* Top-Right Badge */}
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-bold text-gray-300 border border-white/10">
                    {car.topSpeedKmh} KM/H
                  </div>
                </div>

                {/* Podium Stand matching Reference Image */}
                <div
                  className={`w-full py-2 rounded-xl text-center font-display font-extrabold text-sm uppercase tracking-wider transition-all shadow-md ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white shadow-cyan-500/50'
                      : 'bg-black/80 text-gray-400 border border-white/10 group-hover:text-white'
                  }`}
                >
                  {car.name}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 font-mono uppercase tracking-wider">
                  {car.subtitle}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Customization Studio: Real-time Paint Swatches & Rev Throttle Button */}
      <div className="relative z-10 glass-panel px-6 py-3 rounded-2xl border border-white/10 backdrop-blur-md max-w-7xl mx-auto w-full flex flex-wrap items-center justify-between shadow-xl my-1">
        {/* 7 Paint Swatches */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-gray-300 font-display uppercase tracking-wider">
            <Palette className="w-4 h-4 text-cyan-400" />
            <span>CUSTOM PAINT FINISH:</span>
          </div>
          <div className="flex items-center space-x-2">
            {PAINT_SWATCHES.map((swatch) => {
              const isActive = activeCar.bodyColorHex === swatch.hex;
              return (
                <button
                  key={swatch.name}
                  onClick={() => handlePaintSelect(swatch.hex)}
                  className={`w-7 h-7 rounded-full transition-all duration-200 transform hover:scale-125 flex items-center justify-center relative ${
                    isActive
                      ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#080b12] shadow-[0_0_12px_rgba(255,255,255,0.7)]'
                      : 'opacity-70 hover:opacity-100 hover:shadow-lg'
                  }`}
                  style={{ backgroundColor: swatch.css }}
                  title={`${swatch.name} (${swatch.css})`}
                >
                  {isActive && <div className="w-2 h-2 rounded-full bg-white shadow-sm" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive "REV V8 ENGINE" Button */}
        <button
          onClick={handleRevEngine}
          className={`flex items-center space-x-2 px-5 py-2 rounded-xl border font-display text-xs font-extrabold uppercase tracking-wider transition-all duration-150 active:scale-95 shadow-lg ${
            isRevving
              ? 'bg-rose-600 border-rose-400 text-white shadow-rose-500/50 animate-pulse scale-105'
              : 'bg-black/60 border-amber-500/40 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400 shadow-amber-500/20'
          }`}
          title="Rev the V8 twin-turbo engine"
        >
          <Flame className={`w-4 h-4 ${isRevving ? 'text-white animate-spin' : 'text-amber-400'}`} />
          <span>{isRevving ? '🔥 8,500 RPM THROTTLE POP!' : 'REV V8 ENGINE'}</span>
          <Volume2 className="w-3.5 h-3.5 opacity-60 ml-0.5" />
        </button>
      </div>

      {/* Bottom Panel: Selected Car Specifications & Launch Button */}
      <div className="relative z-10 glass-panel p-6 rounded-2xl border border-white/10 backdrop-blur-md flex flex-col md:flex-row items-center justify-between shadow-2xl">
        {/* Car Bio */}
        <div className="max-w-lg mb-4 md:mb-0">
          <div className="flex items-center space-x-3">
            <h2 className="text-3xl font-display font-black text-white tracking-wider">
              {activeCar.name}
            </h2>
            <span
              className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border"
              style={{
                color: `#${activeCar.bodyColorHex.toString(16).padStart(6, '0')}`,
                borderColor: `#${activeCar.bodyColorHex.toString(16).padStart(6, '0')}66`,
                backgroundColor: `#${activeCar.bodyColorHex.toString(16).padStart(6, '0')}15`
              }}
            >
              {activeCar.subtitle}
            </span>
          </div>
          <p className="text-xs text-gray-300 mt-2 leading-relaxed">
            {activeCar.description}
          </p>
        </div>

        {/* Dynamic Telemetry Specs */}
        <div className="flex items-center space-x-6 bg-black/40 px-6 py-3 rounded-xl border border-white/5">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-cyan-400 mb-0.5">
              <Gauge className="w-3.5 h-3.5" />
              <span className="text-[10px] uppercase font-bold">TOP SPEED</span>
            </div>
            <span className="text-2xl font-display font-extrabold text-white">
              {activeCar.topSpeedKmh} <span className="text-xs text-gray-400">KM/H</span>
            </span>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-emerald-400 mb-0.5">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-[10px] uppercase font-bold">0-100 ACCEL</span>
            </div>
            <span className="text-2xl font-display font-extrabold text-white">
              {((100 / 3.6) / (activeCar.accelerationRate * 1.18)).toFixed(1)} <span className="text-xs text-gray-400">S</span>
            </span>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-purple-400 mb-0.5">
              <Award className="w-3.5 h-3.5" />
              <span className="text-[10px] uppercase font-bold">HANDLING</span>
            </div>
            <span className="text-2xl font-display font-extrabold text-white">
              {activeCar.handlingScore} <span className="text-xs text-gray-400">/10</span>
            </span>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-amber-400 mb-0.5">
              <Flame className="w-3.5 h-3.5" />
              <span className="text-[10px] uppercase font-bold">DRIFT</span>
            </div>
            <span className="text-2xl font-display font-extrabold text-white">
              {activeCar.driftFactor}x
            </span>
          </div>
        </div>

        {/* Launch Button */}
        <button
          onClick={handleDriveClick}
          className="mt-4 md:mt-0 px-9 py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-display font-extrabold text-base uppercase tracking-wider rounded-xl shadow-xl shadow-cyan-500/30 transition-all transform active:scale-95 hover:scale-102 flex items-center space-x-3 pointer-events-auto cursor-pointer"
        >
          <span>ENTER TRACK • DRIVE {activeCar.name}</span>
          <Play className="w-5 h-5 fill-white" />
        </button>
      </div>
    </div>
  );
};
