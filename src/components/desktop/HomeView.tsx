import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { SuperCarConfig, SUPER_CARS } from '../../types';
import {
  Play,
  Warehouse,
  Gamepad2,
  Users,
  Settings as SettingsIcon,
  QrCode,
  Volume2,
  VolumeX,
  Gauge,
  Zap,
  Award,
  Flame,
  X,
  ChevronRight,
  ShieldCheck,
  Smartphone,
  Keyboard,
  Compass,
  Copy,
  Check,
  Wifi,
  Radio,
  Sliders
} from 'lucide-react';

interface HomeViewProps {
  selectedCar: SuperCarConfig;
  onStartRacing: () => void;
  onOpenGarage: () => void;
  onSelectCar: (car: SuperCarConfig) => void;
  roomId: string;
  isPhoneConnected: boolean;
  onOpenMultiplayer: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  selectedCar,
  onStartRacing,
  onOpenGarage,
  onSelectCar,
  roomId,
  isPhoneConnected,
  onOpenMultiplayer
}) => {
  // Modal states
  const [activeModal, setActiveModal] = useState<'none' | 'controls' | 'settings' | 'gyro'>('none');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // QR Code State
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [controllerUrl, setControllerUrl] = useState<string>('');
  const [lanIp, setLanIp] = useState<string>('');
  const [availableIps, setAvailableIps] = useState<string[]>([]);

  // Settings State
  const [graphicsQuality, setGraphicsQuality] = useState<'ultra' | 'high' | 'medium'>('ultra');
  const [cameraPreference, setCameraPreference] = useState<'chase' | 'hood'>('chase');

  // Network Detection
  useEffect(() => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      fetch('/api/lan-ip')
        .then((res) => res.json())
        .then((data) => {
          if (data?.primary) {
            setLanIp(data.primary);
            setAvailableIps(data.all || [data.primary]);
          }
        })
        .catch(() => setLanIp('192.168.10.230'));
    }
  }, []);

  // Generate High-Contrast Standard QR Code
  useEffect(() => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const host = isLocal ? (lanIp || '192.168.10.230') : window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;
    const url = `${protocol}//${host}${port}/?mode=controller&room=${roomId}`;
    setControllerUrl(url);

    QRCode.toDataURL(url, {
      width: 320,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrDataUrl);
  }, [roomId, lanIp]);

  // Car image mapping
  const carImages: Record<string, string> = {
    raptor: '/images/cars/raptor.jpg',
    phantom: '/images/cars/phantom.jpg',
    apex: '/images/cars/apex.jpg',
    spark: '/images/cars/spark.jpg',
    titan: '/images/cars/titan.jpg'
  };

  const activeImage = carImages[selectedCar.id] || carImages.raptor;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#06080d] text-white font-racing select-none flex flex-col justify-between">
      {/* Dynamic Background Hangar Image with Multi-Tier Vignettes */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40 pointer-events-none scale-105 transition-all duration-1000 filter blur-[0.5px]"
        style={{ backgroundImage: `url('/images/garage_hero.jpg')` }}
      />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#06080d] via-[#06080d]/80 to-transparent" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#06080d] via-transparent to-[#06080d]/90" />

      {/* TOP HEADER NAVIGATION BAR */}
      <header className="relative z-20 flex items-center justify-between px-8 py-5 border-b border-white/10 backdrop-blur-md bg-black/30">
        {/* Brand Logo & Studio Tag */}
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-300/40">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-display font-extrabold tracking-wider text-white">
                APEX<span className="text-cyan-400">DRIFT</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                PRO HIGHWAY
              </span>
            </div>
            <p className="text-[11px] font-mono text-gray-400 tracking-wider">
              3.8 KM CLOSED CIRCUIT • WEBGL2 & GYRO
            </p>
          </div>
        </div>

        {/* Live Network & Quick Action Controls */}
        <div className="flex items-center space-x-3">
          {/* Gyro Remote Status Pill */}
          <button
            onClick={() => setActiveModal('gyro')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
              isPhoneConnected
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-lg shadow-emerald-500/20'
                : 'glass-panel text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/20 shadow-lg shadow-cyan-500/10'
            }`}
          >
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span>{isPhoneConnected ? 'Gyro Connected' : 'Pair Phone Gyro'}</span>
            <span className={`w-2 h-2 rounded-full ${isPhoneConnected ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`} />
          </button>

          {/* Controls Guide Button */}
          <button
            onClick={() => setActiveModal('controls')}
            className="flex items-center space-x-2 glass-panel px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-300 hover:text-white border border-white/10 hover:border-white/30 transition-all"
          >
            <Gamepad2 className="w-4 h-4 text-gray-400" />
            <span>Controls</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setActiveModal('settings')}
            className="p-2.5 glass-panel rounded-xl text-gray-400 hover:text-white border border-white/10 hover:border-white/30 transition-all"
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* Audio Mute Button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2.5 glass-panel rounded-xl text-gray-400 hover:text-white border border-white/10 hover:border-white/30 transition-all"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>
        </div>
      </header>

      {/* MAIN BODY: 2-COLUMN HERO STAGE */}
      <main className="relative z-10 flex-1 grid grid-cols-12 gap-8 px-8 py-6 items-center max-w-7xl mx-auto w-full">
        {/* LEFT COLUMN: PRIMARY RACING NAVIGATION MENU */}
        <div className="col-span-5 flex flex-col justify-center space-y-4">
          <div className="mb-2">
            <span className="text-xs uppercase font-bold text-cyan-400 tracking-widest flex items-center gap-1.5 mb-1">
              <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" /> SEASON 1 CHAMPIONSHIP
            </span>
            <h2 className="text-4xl lg:text-5xl font-display font-black tracking-tight leading-none text-white drop-shadow-md">
              THE HIGHWAY <br />
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                REVOLUTION
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-2 font-mono leading-relaxed">
              Drive authentic hypercars on a seamless 3.8 KM British mountain highway. Turn your smartphone into an authentic 60Hz zero-install tilt steering wheel!
            </p>
          </div>

          {/* 1. START RACE BUTTON (HERO CTA) */}
          <button
            onClick={onStartRacing}
            className="group relative flex items-center justify-between px-6 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 bg-[length:200%_auto] hover:bg-right transition-all duration-500 shadow-xl shadow-cyan-500/25 border border-cyan-300/40 text-left active:scale-[0.98]"
          >
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-100 font-bold block mb-0.5">
                SPEEDWAY CIRCUIT • 3.8 KM
              </span>
              <span className="text-2xl font-display font-black uppercase tracking-wider text-white flex items-center gap-2">
                ENTER RACE TRACK <Play className="w-5 h-5 fill-white text-white group-hover:translate-x-1.5 transition-transform" />
              </span>
            </div>
            <span className="text-xs font-mono px-3 py-1.5 rounded-lg bg-black/40 border border-white/20 text-cyan-200">
              PRESS ENTER
            </span>
          </button>

          {/* 2. HYPERCAR SHOWROOM */}
          <button
            onClick={onOpenGarage}
            className="group flex items-center justify-between px-5 py-3.5 rounded-xl glass-panel border border-white/10 hover:border-amber-500/40 hover:bg-amber-500/10 transition-all text-left active:scale-[0.99]"
          >
            <div className="flex items-center space-x-3.5">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Warehouse className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-display font-bold uppercase tracking-wider text-white block">
                  HYPERCAR SHOWROOM
                </span>
                <span className="text-[11px] font-mono text-gray-400">
                  Select and inspect 5 competition supercars
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
          </button>

          {/* 3. MULTIPLAYER P2P LOBBY */}
          <button
            onClick={onOpenMultiplayer}
            className="group flex items-center justify-between px-5 py-3.5 rounded-xl glass-panel border border-white/10 hover:border-purple-500/40 hover:bg-purple-500/10 transition-all text-left active:scale-[0.99]"
          >
            <div className="flex items-center space-x-3.5">
              <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-display font-bold uppercase tracking-wider text-white block">
                  MULTIPLAYER ROOMS
                </span>
                <span className="text-[11px] font-mono text-gray-400">
                  Join or host private races via P2P WebRTC
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
          </button>

          {/* 4. GYRO CONTROLLER PAIRING BANNER */}
          <button
            onClick={() => setActiveModal('gyro')}
            className="group flex items-center justify-between px-5 py-3.5 rounded-xl glass-panel border border-white/10 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all text-left active:scale-[0.99]"
          >
            <div className="flex items-center space-x-3.5">
              <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-display font-bold uppercase tracking-wider text-white block">
                  SMARTPHONE GYRO PAIRING
                </span>
                <span className="text-[11px] font-mono text-gray-400">
                  Scan QR code for zero-install tilt steering
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
          </button>
        </div>

        {/* RIGHT COLUMN: ACTIVE HYPERCAR SHOWCASE */}
        <div className="col-span-7 flex flex-col justify-center">
          <div className="glass-panel p-6 rounded-3xl border border-white/15 relative overflow-hidden shadow-2xl backdrop-blur-xl">
            {/* Ambient Car Spec Glow */}
            <div
              className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-[100px] opacity-30 pointer-events-none"
              style={{ backgroundColor: '#' + selectedCar.bodyColorHex.toString(16).padStart(6, '0') }}
            />

            {/* Header info */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-cyan-400">
                  ACTIVE TRACK WEAPON
                </span>
                <h3 className="text-3xl font-display font-black tracking-wider text-white">
                  {selectedCar.name}
                </h3>
                <span className="text-xs text-gray-400 font-mono">
                  {selectedCar.subtitle}
                </span>
              </div>

              {/* Quick Car Carousel Selector */}
              <div className="flex items-center space-x-1.5 bg-black/50 p-1 rounded-xl border border-white/10">
                {SUPER_CARS.map((car) => (
                  <button
                    key={car.id}
                    onClick={() => onSelectCar(car)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition-all ${
                      selectedCar.id === car.id
                        ? 'bg-cyan-500 text-black shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {car.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Car Preview Image */}
            <div className="relative w-full h-64 rounded-2xl overflow-hidden bg-black/60 border border-white/10 mb-5 group">
              <img
                src={activeImage}
                alt={selectedCar.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-none">
                <span className="text-xs font-mono text-gray-300">
                  {selectedCar.description}
                </span>
              </div>
            </div>

            {/* Live Performance Specs Grid */}
            <div className="grid grid-cols-4 gap-3 text-center mb-4">
              <div className="bg-black/40 border border-white/10 p-2.5 rounded-xl">
                <div className="flex items-center justify-center space-x-1 text-cyan-400 mb-0.5">
                  <Gauge className="w-3.5 h-3.5" />
                  <span className="text-[9px] uppercase font-bold tracking-wider">TOP SPEED</span>
                </div>
                <span className="text-xl font-display font-extrabold text-white">
                  {selectedCar.topSpeedKmh} <span className="text-[10px] text-gray-400 font-normal">KM/H</span>
                </span>
              </div>

              <div className="bg-black/40 border border-white/10 p-2.5 rounded-xl">
                <div className="flex items-center justify-center space-x-1 text-emerald-400 mb-0.5">
                  <Zap className="w-3.5 h-3.5" />
                  <span className="text-[9px] uppercase font-bold tracking-wider">0-100 ACCEL</span>
                </div>
                <span className="text-xl font-display font-extrabold text-white">
                  {((100 / 3.6) / (selectedCar.accelerationRate * 1.18)).toFixed(1)} <span className="text-[10px] text-gray-400 font-normal">S</span>
                </span>
              </div>

              <div className="bg-black/40 border border-white/10 p-2.5 rounded-xl">
                <div className="flex items-center justify-center space-x-1 text-purple-400 mb-0.5">
                  <Award className="w-3.5 h-3.5" />
                  <span className="text-[9px] uppercase font-bold tracking-wider">HANDLING</span>
                </div>
                <span className="text-xl font-display font-extrabold text-white">
                  {selectedCar.handlingScore} <span className="text-[10px] text-gray-400 font-normal">/10</span>
                </span>
              </div>

              <div className="bg-black/40 border border-white/10 p-2.5 rounded-xl">
                <div className="flex items-center justify-center space-x-1 text-amber-400 mb-0.5">
                  <Flame className="w-3.5 h-3.5" />
                  <span className="text-[9px] uppercase font-bold tracking-wider">DRIFT</span>
                </div>
                <span className="text-xl font-display font-extrabold text-white">
                  {selectedCar.driftFactor}x
                </span>
              </div>
            </div>

            {/* Quick Action Footer in Card */}
            <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs font-mono text-gray-400">
              <span>ENGINE: V8 TWIN-TURBO • AWD</span>
              <button
                onClick={onOpenGarage}
                className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition-colors"
              >
                OPEN FULL GARAGE SHOWROOM <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER BAR */}
      <footer className="relative z-20 flex items-center justify-between px-8 py-3.5 border-t border-white/10 bg-black/40 text-[11px] font-mono text-gray-500">
        <div className="flex items-center space-x-4">
          <span>APEX ENGINE v2.4.0</span>
          <span>•</span>
          <span>60 HZ FIXED TIME-STEP PHYSICS</span>
          <span>•</span>
          <span>WEBGL2 TONE MAPPING</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-cyan-400/80">ROOM CODE: {roomId}</span>
          <span>•</span>
          <span>© 2026 APEX MOTORSPORT STUDIOS</span>
        </div>
      </footer>

      {/* MODAL 1: CONTROLS & HOW TO PLAY */}
      {activeModal === 'controls' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-cyan-500/40 max-w-2xl w-full text-white font-racing relative shadow-2xl">
            <button
              onClick={() => setActiveModal('none')}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-2xl font-display font-extrabold text-cyan-300 mb-1 flex items-center gap-2">
              <Gamepad2 className="w-6 h-6 text-cyan-400" /> DRIVING CONTROLS & DYNAMICS
            </h3>
            <p className="text-xs text-gray-400 mb-4 font-mono">
              Master the high-speed circuit using keyboard or smartphone motion tilt wheel.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Keyboard Controls */}
              <div className="bg-black/50 border border-white/10 p-4 rounded-xl">
                <span className="text-xs uppercase font-bold text-cyan-400 flex items-center gap-1.5 mb-3">
                  <Keyboard className="w-4 h-4" /> PC KEYBOARD DRIVING
                </span>
                <ul className="space-y-2 text-xs font-mono text-gray-300">
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">THROTTLE:</span>
                    <span className="text-cyan-300 font-bold">W / UP ARROW</span>
                  </li>
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">BRAKE / REVERSE:</span>
                    <span className="text-rose-400 font-bold">S / DOWN ARROW</span>
                  </li>
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">STEERING:</span>
                    <span className="text-white font-bold">A / D or LEFT / RIGHT</span>
                  </li>
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">HANDBRAKE DRIFT:</span>
                    <span className="text-amber-400 font-bold">SPACEBAR</span>
                  </li>
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">NITRO BOOST:</span>
                    <span className="text-purple-400 font-bold">LEFT / RIGHT SHIFT</span>
                  </li>
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">SWITCH CAMERA:</span>
                    <span className="text-cyan-300 font-bold">C KEY</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-gray-400">RESET ON TRACK:</span>
                    <span className="text-rose-400 font-bold">R KEY</span>
                  </li>
                </ul>
              </div>

              {/* Smartphone Gyro Wheel */}
              <div className="bg-black/50 border border-cyan-500/20 p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-xs uppercase font-bold text-cyan-400 flex items-center gap-1.5 mb-3">
                    <Smartphone className="w-4 h-4" /> SMARTPHONE TILT STEERING
                  </span>
                  <div className="space-y-2 text-xs font-mono text-gray-300">
                    <p className="text-gray-400">
                      1. Scan the QR code or open controller link on your phone.
                    </p>
                    <p className="text-gray-400">
                      2. Hold phone horizontally in <span className="text-cyan-300 font-bold">Landscape</span>.
                    </p>
                    <p className="text-gray-400">
                      3. Tilt phone left and right like a real steering wheel.
                    </p>
                    <p className="text-gray-400">
                      4. Touch the on-screen GAS, BRAKE and NITRO buttons!
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveModal('gyro')}
                  className="mt-3 w-full py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  PAIR PHONE NOW
                </button>
              </div>
            </div>

            <button
              onClick={() => setActiveModal('none')}
              className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: PAIR PHONE GYRO (HIGH-CONTRAST PURE BLACK ON WHITE) */}
      {activeModal === 'gyro' && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-cyan-500/40 max-w-md w-full text-white text-center font-racing relative shadow-2xl">
            <button
              onClick={() => setActiveModal('none')}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-display font-bold text-cyan-300 mb-1 flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5 text-cyan-400" /> PAIR GYRO CONTROLLER
            </h3>
            <p className="text-xs text-gray-400 mb-3 font-mono">
              Scan with your phone's camera (same Wi-Fi) to turn your phone into a physical tilt steering wheel!
            </p>

            {/* Standard Pure White High-Contrast QR Code Card */}
            <div className="bg-white p-3.5 rounded-2xl shadow-xl shadow-cyan-500/10 flex flex-col items-center justify-center mb-3">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="w-52 h-52 rounded-lg select-none block" />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-gray-500 text-xs font-mono">
                  Generating High-Contrast QR...
                </div>
              )}
            </div>

            {/* Room Code Badge */}
            <div className="flex items-center justify-between bg-cyan-950/50 border border-cyan-500/40 p-2.5 rounded-xl mb-3">
              <span className="text-xs text-cyan-200 font-bold uppercase tracking-wider">PAIRING CODE:</span>
              <span className="font-mono font-extrabold text-lg text-cyan-300 tracking-widest bg-black/80 px-3 py-0.5 rounded border border-cyan-500/50">
                {roomId}
              </span>
            </div>

            {/* Connection Link & Copy */}
            <div className="bg-black/40 border border-white/10 rounded-lg p-2.5 mb-3 text-left">
              <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 mb-1">
                <span className="flex items-center gap-1 text-cyan-400"><Wifi className="w-3 h-3" /> Controller Link:</span>
                <button
                  onClick={() => {
                    if (controllerUrl) {
                      navigator.clipboard.writeText(controllerUrl);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }
                  }}
                  className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200 transition-colors"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLink ? 'COPIED!' : 'COPY'}</span>
                </button>
              </div>
              <div className="text-[11px] font-mono text-gray-300 break-all select-all bg-black/60 p-1.5 rounded">
                {controllerUrl || 'Detecting network...'}
              </div>
            </div>

            {/* IP Switcher if multiple LAN adapters */}
            {availableIps.length > 1 && (
              <div className="flex items-center justify-center gap-2 mb-3 text-[11px] font-mono text-gray-400">
                <span>Wi-Fi / LAN IP:</span>
                <select
                  value={lanIp}
                  onChange={(e) => setLanIp(e.target.value)}
                  className="bg-black/60 border border-cyan-500/30 rounded px-2 py-1 text-cyan-300 text-[11px] outline-none"
                >
                  {availableIps.map((ip) => (
                    <option key={ip} value={ip}>{ip}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => setActiveModal('none')}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider"
            >
              DONE
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: SETTINGS & GRAPHICS */}
      {activeModal === 'settings' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/20 max-w-md w-full text-white font-racing relative shadow-2xl">
            <button
              onClick={() => setActiveModal('none')}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-display font-bold text-white mb-1 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" /> GAMEPLAY & GRAPHICS SETTINGS
            </h3>
            <p className="text-xs text-gray-400 mb-4 font-mono">
              Optimize rendering performance and controls.
            </p>

            <div className="space-y-4 mb-5">
              {/* Graphics Presets */}
              <div>
                <span className="text-xs uppercase font-bold text-gray-300 block mb-2 font-mono">
                  GRAPHICS PRESET
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['ultra', 'high', 'medium'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => setGraphicsQuality(q)}
                      className={`py-2 rounded-xl text-xs font-bold uppercase font-mono transition-all border ${
                        graphicsQuality === q
                          ? 'bg-cyan-500 text-black border-cyan-400 shadow-lg shadow-cyan-500/20'
                          : 'bg-black/40 text-gray-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Camera Mode */}
              <div>
                <span className="text-xs uppercase font-bold text-gray-300 block mb-2 font-mono">
                  DEFAULT CAMERA VIEW
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCameraPreference('chase')}
                    className={`py-2 rounded-xl text-xs font-bold uppercase font-mono transition-all border ${
                      cameraPreference === 'chase'
                        ? 'bg-cyan-500 text-black border-cyan-400'
                        : 'bg-black/40 text-gray-400 border-white/10 hover:text-white'
                    }`}
                  >
                    CHASE (BEHIND CAR)
                  </button>
                  <button
                    onClick={() => setCameraPreference('hood')}
                    className={`py-2 rounded-xl text-xs font-bold uppercase font-mono transition-all border ${
                      cameraPreference === 'hood'
                        ? 'bg-cyan-500 text-black border-cyan-400'
                        : 'bg-black/40 text-gray-400 border-white/10 hover:text-white'
                    }`}
                  >
                    HOOD (FIRST PERSON)
                  </button>
                </div>
              </div>

              {/* Master Audio */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/10">
                <span className="text-xs font-mono text-gray-300">MASTER AUDIO & SOUND ENGINE</span>
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold font-mono ${
                    isMuted ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  }`}
                >
                  {isMuted ? 'MUTED' : 'ENABLED'}
                </button>
              </div>
            </div>

            <button
              onClick={() => setActiveModal('none')}
              className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
            >
              SAVE & CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
