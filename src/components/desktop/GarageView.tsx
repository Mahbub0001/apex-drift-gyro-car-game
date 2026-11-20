import React, { useState } from 'react';
import { SUPER_CARS, SuperCarConfig } from '../../types';
import { Zap, Gauge, Award, Flame, Play, QrCode } from 'lucide-react';

interface GarageViewProps {
  onSelectCar: (car: SuperCarConfig) => void;
  selectedCar: SuperCarConfig;
  onOpenGyroModal: () => void;
  isPhoneConnected: boolean;
}

export const GarageView: React.FC<GarageViewProps> = ({
  onSelectCar,
  selectedCar,
  onOpenGyroModal,
  isPhoneConnected
}) => {
  const [activeCar, setActiveCar] = useState<SuperCarConfig>(selectedCar);

  const handleCarClick = (car: SuperCarConfig) => {
    setActiveCar(car);
    onSelectCar(car);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#090b10] flex flex-col justify-between p-6 font-racing text-white select-none">
      {/* Background Cinematic Garage Texture & Overhead Lighting */}
      <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-[#0a0d14] to-[#07080c]" />

      {/* Top Header */}
      <div className="relative z-10 flex items-center justify-between glass-panel px-6 py-4 rounded-2xl border border-white/10">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-display font-bold tracking-wider bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
              APEX DRIFT SHOWROOM
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
              GARAGE
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Select your track weapon • Drive with Keyboard or Smartphone Gyroscope
          </p>
        </div>

        {/* Gyro Connection Status */}
        <button
          onClick={onOpenGyroModal}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl glass-panel border border-cyan-500/30 text-xs font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/20 active:scale-95 transition-all pointer-events-auto"
        >
          <QrCode className="w-4 h-4 text-cyan-400" />
          <span>{isPhoneConnected ? 'Phone Gyro Connected' : 'Connect Gyro Wheel'}</span>
        </button>
      </div>

      {/* Center 5-Car Garage Showcase (Matches User Uploaded Image!) */}
      <div className="relative z-10 flex-1 flex flex-col justify-center my-4">
        <div className="grid grid-cols-5 gap-4 px-2">
          {SUPER_CARS.map((car) => {
            const isSelected = activeCar.id === car.id;
            return (
              <div
                key={car.id}
                onClick={() => handleCarClick(car)}
                className={`relative flex flex-col items-center p-4 rounded-2xl cursor-pointer transition-all duration-300 transform ${
                  isSelected
                    ? 'scale-105 glass-panel-cyan border-cyan-400 shadow-2xl shadow-cyan-500/30'
                    : 'glass-panel border-white/10 hover:border-white/30 hover:scale-102 opacity-80 hover:opacity-100'
                }`}
              >
                {/* Car Silhouette Preview Pill */}
                <div
                  className="w-full h-32 rounded-xl relative overflow-hidden flex items-center justify-center mb-3 shadow-inner"
                  style={{
                    backgroundColor: `#${car.bodyColorHex.toString(16).padStart(6, '0')}22`,
                    border: `1px solid #${car.bodyColorHex.toString(16).padStart(6, '0')}66`
                  }}
                >
                  {/* Glowing Underglow Effect */}
                  <div
                    className="absolute inset-0 blur-xl opacity-50"
                    style={{ backgroundColor: `#${car.bodyColorHex.toString(16).padStart(6, '0')}` }}
                  />

                  {/* Stylized Supercar Vector Badge */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div
                      className="w-16 h-8 rounded-lg shadow-lg"
                      style={{
                        backgroundColor: `#${car.bodyColorHex.toString(16).padStart(6, '0')}`,
                        boxShadow: `0 0 20px #${car.bodyColorHex.toString(16).padStart(6, '0')}aa`
                      }}
                    />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mt-2">
                      {car.subtitle}
                    </span>
                  </div>
                </div>

                {/* Car Podium Stand */}
                <div
                  className={`w-full py-2.5 rounded-xl text-center font-display font-bold text-sm uppercase tracking-widest transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg shadow-cyan-500/40'
                      : 'bg-black/60 text-gray-300 border border-white/10'
                  }`}
                >
                  {car.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Panel: Selected Car Specifications & Launch Button */}
      <div className="relative z-10 glass-panel p-5 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between">
        {/* Car Bio */}
        <div className="max-w-md mb-4 md:mb-0">
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-display font-bold text-white tracking-wider">
              {activeCar.name}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-cyan-300 font-bold uppercase">
              {activeCar.subtitle}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            {activeCar.description}
          </p>
        </div>

        {/* Dynamic Telemetry Specs */}
        <div className="flex items-center space-x-6">
          <div className="text-center">
            <span className="text-[10px] text-gray-400 uppercase font-bold block">TOP SPEED</span>
            <span className="text-xl font-display font-bold text-cyan-400">
              {activeCar.topSpeedKmh} <span className="text-xs">KM/H</span>
            </span>
          </div>

          <div className="text-center">
            <span className="text-[10px] text-gray-400 uppercase font-bold block">ACCEL (0-100)</span>
            <span className="text-xl font-display font-bold text-emerald-400">
              {(100 / activeCar.accelerationRate).toFixed(1)} <span className="text-xs">SEC</span>
            </span>
          </div>

          <div className="text-center">
            <span className="text-[10px] text-gray-400 uppercase font-bold block">HANDLING</span>
            <span className="text-xl font-display font-bold text-purple-400">
              {activeCar.handlingScore} <span className="text-xs">/10</span>
            </span>
          </div>

          <div className="text-center">
            <span className="text-[10px] text-gray-400 uppercase font-bold block">DRIFT FACTOR</span>
            <span className="text-xl font-display font-bold text-amber-400">
              {activeCar.driftFactor}x
            </span>
          </div>
        </div>

        {/* Launch Button */}
        <button
          onClick={() => onSelectCar(activeCar)}
          className="px-8 py-3.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-display font-bold text-sm uppercase tracking-wider rounded-xl shadow-xl shadow-cyan-500/30 transition-all transform active:scale-95 flex items-center space-x-2"
        >
          <span>DRIVE {activeCar.name}</span>
          <Play className="w-4 h-4 fill-white" />
        </button>
      </div>
    </div>
  );
};
