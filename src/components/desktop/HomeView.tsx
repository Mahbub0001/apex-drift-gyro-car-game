import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { SuperCarConfig, SUPER_CARS, GameSettings } from '../../types';
import { SoundEngine } from '../../game/audio/SoundEngine';
import { CarPreview3D } from '../shared/CarPreview3D';
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
  Smartphone,
  Keyboard,
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
  settings: GameSettings;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  selectedCar,
  onStartRacing,
  onOpenGarage,
  onSelectCar,
  roomId,
  isPhoneConnected,
  onOpenMultiplayer,
  settings,
  onUpdateSettings
}) => {
  const [activeModal, setActiveModal] = useState<'none' | 'controls' | 'settings' | 'gyro'>('none');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isHomeRevving, setIsHomeRevving] = useState<boolean>(false);
  const soundRef = useRef<SoundEngine | null>(null);

  useEffect(() => {
    const sound = new SoundEngine();
    if (settings.isMuted) {
      sound.toggleMute();
    }
    soundRef.current = sound;
    return () => {
      sound.dispose();
    };
  }, []);

  const handleToggleMute = () => {
    const nextMuted = !settings.isMuted;
    soundRef.current?.init();
    if (soundRef.current) {
      if (nextMuted) soundRef.current.playUiClick();
      soundRef.current.toggleMute();
    }
    onUpdateSettings({ isMuted: nextMuted });
  };

  const playClick = () => {
    if (settings.isMuted) return;
    soundRef.current?.init();
    soundRef.current?.playUiClick();
  };

  const playHover = () => {
    if (settings.isMuted) return;
    soundRef.current?.playUiHover();
  };

  const handleHomeRev = () => {
    soundRef.current?.init();
    soundRef.current?.playRevPulse();
    setIsHomeRevving(true);
    setTimeout(() => setIsHomeRevving(false), 900);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeModal !== 'none') {
        e.preventDefault();
        setActiveModal('none');
      } else if (e.key === 'Enter' && activeModal === 'none') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SELECT') return;
        e.preventDefault();
        playClick();
        onStartRacing();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeModal, onStartRacing]);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [controllerUrl, setControllerUrl] = useState<string>('');
  const [lanIp, setLanIp] = useState<string>('');
  const [availableIps, setAvailableIps] = useState<string[]>([]);
  const [httpsPort, setHttpsPort] = useState<number | null>(null);
  const [preferHttpsQr, setPreferHttpsQr] = useState<boolean>(true);

  useEffect(() => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal || window.location.protocol === 'http:') {
      fetch('/api/lan-ip')
        .then((res) => res.json())
        .then((data) => {
          if (data?.primary) {
            setLanIp(data.primary);
            setAvailableIps(data.all || [data.primary]);
          }
          if (typeof data?.httpsPort === 'number') {
            setHttpsPort(data.httpsPort);
          }
        })
        .catch(() => setLanIp('localhost'));
    }
  }, []);

  useEffect(() => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const host = isLocal ? (lanIp || window.location.hostname) : window.location.hostname;
    const useHttps = preferHttpsQr && httpsPort !== null && host !== 'localhost' && host !== '127.0.0.1';
    const protocol = useHttps ? 'https:' : window.location.protocol;
    const port = useHttps ? `:${httpsPort}` : window.location.port ? `:${window.location.port}` : '';
    const url = `${protocol}//${host}${port}/?mode=controller&room=${roomId}`;
    setControllerUrl(url);

    QRCode.toDataURL(url, {
      width: 320,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrDataUrl);
  }, [roomId, lanIp, httpsPort, preferHttpsQr]);

  return (
    <div className="relative w-screen h-[100dvh] overflow-y-auto xl:overflow-hidden bg-[#06080d] text-white font-racing select-none flex flex-col justify-between">
      {/* Subtle Ambient Showroom Backdrop */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,rgba(0,242,254,0.08),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(138,43,226,0.08),transparent_55%)]" />

      {/* TOP HEADER NAVIGATION BAR */}
      <header className="relative z-20 flex items-center justify-between px-6 lg:px-8 py-3.5 border-b border-white/10 backdrop-blur-md bg-black/35 shrink-0">
        <div className="flex items-center space-x-3.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-300/40">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl lg:text-2xl font-display font-extrabold tracking-wider text-white">
                APEX<span className="text-cyan-400">DRIFT</span>
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                MANUAL UP • AUTO DOWN
              </span>
            </div>
            <p className="text-[11px] font-mono text-gray-400 tracking-wider hidden sm:block">
              12.5 KM GRAND WORLD CIRCUIT • 4-LANE HIGHWAY • 3D WEBGL2 & GYRO
            </p>
          </div>
        </div>

        <nav className="flex items-center space-x-2.5" aria-label="Primary actions">
          <button
            onClick={() => {
              playClick();
              setActiveModal('gyro');
            }}
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

          <button
            onClick={() => {
              playClick();
              setActiveModal('controls');
            }}
            className="flex items-center space-x-2 glass-panel px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-300 hover:text-white border border-white/10 hover:border-white/30 transition-all"
          >
            <Gamepad2 className="w-4 h-4 text-gray-400" />
            <span>Controls</span>
          </button>

          <button
            onClick={() => {
              playClick();
              setActiveModal('settings');
            }}
            aria-label="Gameplay and graphics settings"
            className="p-2.5 glass-panel rounded-xl text-gray-400 hover:text-white border border-white/10 hover:border-white/30 transition-all"
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          <button
            onClick={handleToggleMute}
            aria-label={settings.isMuted ? 'Unmute audio' : 'Mute audio'}
            className="p-2.5 glass-panel rounded-xl text-gray-400 hover:text-white border border-white/10 hover:border-white/30 transition-all"
            title={settings.isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {settings.isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>
        </nav>
      </header>

      {/* MAIN BODY: 2-COLUMN HERO STAGE */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 px-6 lg:px-8 py-4 items-center max-w-7xl mx-auto w-full min-h-0">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-5 flex flex-col justify-center space-y-3">
          <div className="mb-1">
            <span className="text-[11px] uppercase font-bold text-cyan-400 tracking-widest flex items-center gap-1.5 mb-1">
              <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" /> SEASON 1 CHAMPIONSHIP
            </span>
            <h2 className="text-3xl lg:text-4xl xl:text-5xl font-display font-black tracking-tight leading-none text-white drop-shadow-md">
              THE HIGHWAY <br />
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                REVOLUTION
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-1.5 font-mono leading-relaxed">
              Drive interactive 3D hypercars across a 12.5 KM Riviera coastline, alpine pass & neon tunnel with manual upshifts, speed-based auto downshifts & 60Hz phone gyro steering.
            </p>
          </div>

          <button
            onClick={() => {
              playClick();
              onStartRacing();
            }}
            onMouseEnter={playHover}
            className="group relative flex items-center justify-between px-5 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 bg-[length:200%_auto] hover:bg-right transition-all duration-500 shadow-xl shadow-cyan-500/25 border border-cyan-300/40 text-left active:scale-[0.98]"
          >
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-100 font-bold block mb-0.5">
                GRAND WORLD CIRCUIT • SEMI-AUTO GEARBOX
              </span>
              <span className="text-xl lg:text-2xl font-display font-black uppercase tracking-wider text-white flex items-center gap-2">
                ENTER RACE TRACK{' '}
                <Play className="w-5 h-5 fill-white text-white group-hover:translate-x-1.5 transition-transform" />
              </span>
            </div>
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-black/40 border border-white/20 text-cyan-200 shrink-0">
              PRESS ENTER
            </span>
          </button>

          <button
            onClick={() => {
              playClick();
              onOpenGarage();
            }}
            onMouseEnter={playHover}
            className="group flex items-center justify-between px-4 py-3 rounded-xl glass-panel border border-white/10 hover:border-amber-500/40 hover:bg-amber-500/10 transition-all text-left active:scale-[0.99]"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Warehouse className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-display font-bold uppercase tracking-wider text-white block">
                  3D HYPERCAR SHOWROOM
                </span>
                <span className="text-[11px] font-mono text-gray-400">
                  Inspect, paint & rev 5 3D competition supercars
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
          </button>

          <button
            onClick={() => {
              playClick();
              onOpenMultiplayer();
            }}
            onMouseEnter={playHover}
            className="group flex items-center justify-between px-4 py-3 rounded-xl glass-panel border border-white/10 hover:border-purple-500/40 hover:bg-purple-500/10 transition-all text-left active:scale-[0.99]"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Users className="w-4 h-4" />
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

          <button
            onClick={() => {
              playClick();
              setActiveModal('gyro');
            }}
            onMouseEnter={playHover}
            className="group flex items-center justify-between px-4 py-3 rounded-xl glass-panel border border-white/10 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all text-left active:scale-[0.99]"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-display font-bold uppercase tracking-wider text-white block">
                  SMARTPHONE GYRO PAIRING
                </span>
                <span className="text-[11px] font-mono text-gray-400">
                  Scan QR code for tilt steering + paddle shifters
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
          </button>
        </div>

        {/* RIGHT COLUMN: ACTUAL INTERACTIVE 3D SHOWCASE */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <div className="glass-panel p-5 rounded-3xl border border-white/15 relative overflow-hidden shadow-2xl backdrop-blur-xl">
            <div
              className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-[100px] opacity-25 pointer-events-none"
              style={{ backgroundColor: '#' + selectedCar.bodyColorHex.toString(16).padStart(6, '0') }}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-cyan-400">
                  ACTIVE TRACK WEAPON
                </span>
                <h3 className="text-2xl lg:text-3xl font-display font-black tracking-wider text-white leading-tight">
                  {selectedCar.name}
                </h3>
                <span className="text-xs text-gray-400 font-mono">
                  {selectedCar.subtitle}
                </span>
              </div>

              <div className="flex items-center space-x-1 bg-black/50 p-1 rounded-xl border border-white/10" role="group" aria-label="Quick car selection">
                {SUPER_CARS.map((car) => (
                  <button
                    key={car.id}
                    onClick={() => {
                      playClick();
                      onSelectCar(car);
                    }}
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

            {/* FULL INTERACTIVE 360° 3D TURNTABLES (Drag, Zoom, Angle Presets & Rev!) */}
            <div className="relative w-full h-52 xl:h-64 rounded-2xl overflow-hidden bg-[#070a12] border border-white/10 mb-4">
              <CarPreview3D
                car={selectedCar}
                isRevving={isHomeRevving}
                onRevClick={handleHomeRev}
                showControls={true}
              />
              <div className="absolute bottom-2.5 left-3.5 right-3.5 pointer-events-none">
                <span className="text-[11px] font-mono text-gray-200 bg-black/55 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/10 inline-block max-w-full truncate">
                  {selectedCar.description}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2.5 text-center mb-3">
              <div className="bg-black/40 border border-white/10 p-2 rounded-xl">
                <div className="flex items-center justify-center space-x-1 text-cyan-400 mb-0.5">
                  <Gauge className="w-3.5 h-3.5" />
                  <span className="text-[9px] uppercase font-bold tracking-wider">TOP SPEED</span>
                </div>
                <span className="text-lg lg:text-xl font-display font-extrabold text-white">
                  {selectedCar.topSpeedKmh} <span className="text-[10px] text-gray-400 font-normal">KM/H</span>
                </span>
              </div>

              <div className="bg-black/40 border border-white/10 p-2 rounded-xl">
                <div className="flex items-center justify-center space-x-1 text-emerald-400 mb-0.5">
                  <Zap className="w-3.5 h-3.5" />
                  <span className="text-[9px] uppercase font-bold tracking-wider">0-100 ACCEL</span>
                </div>
                <span className="text-lg lg:text-xl font-display font-extrabold text-white">
                  {(100 / 3.6 / (selectedCar.accelerationRate * 1.18)).toFixed(1)}{' '}
                  <span className="text-[10px] text-gray-400 font-normal">S</span>
                </span>
              </div>

              <div className="bg-black/40 border border-white/10 p-2 rounded-xl">
                <div className="flex items-center justify-center space-x-1 text-purple-400 mb-0.5">
                  <Award className="w-3.5 h-3.5" />
                  <span className="text-[9px] uppercase font-bold tracking-wider">HANDLING</span>
                </div>
                <span className="text-lg lg:text-xl font-display font-extrabold text-white">
                  {selectedCar.handlingScore} <span className="text-[10px] text-gray-400 font-normal">/10</span>
                </span>
              </div>

              <div className="bg-black/40 border border-white/10 p-2 rounded-xl">
                <div className="flex items-center justify-center space-x-1 text-amber-400 mb-0.5">
                  <Flame className="w-3.5 h-3.5" />
                  <span className="text-[9px] uppercase font-bold tracking-wider">DRIFT</span>
                </div>
                <span className="text-lg lg:text-xl font-display font-extrabold text-white">
                  {selectedCar.driftFactor}x
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs font-mono text-gray-400">
              <div className="flex items-center space-x-2">
                <span>CUSTOM PAINT:</span>
                <span
                  className="w-3 h-3 rounded-full inline-block border border-white/40"
                  style={{ backgroundColor: '#' + selectedCar.bodyColorHex.toString(16).padStart(6, '0') }}
                />
                <span className="text-gray-300">SEMI-AUTO (MAN ▲ / AUTO ▼) • AWD</span>
              </div>
              <button
                onClick={() => {
                  playClick();
                  onOpenGarage();
                }}
                className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition-colors"
              >
                OPEN FULL GARAGE SHOWROOM <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER BAR */}
      <footer className="relative z-20 flex items-center justify-between px-6 lg:px-8 py-2.5 border-t border-white/10 bg-black/45 text-[11px] font-mono text-gray-400 shrink-0">
        <div className="flex items-center space-x-4">
          <span>APEX ENGINE v2.6</span>
          <span>•</span>
          <span>MANUAL UP / AUTO DOWN</span>
          <span>•</span>
          <span>QUALITY: {settings.graphicsQuality.toUpperCase()}</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-cyan-400/90">ROOM CODE: {roomId}</span>
          <span>•</span>
          <span>© 2026 APEX MOTORSPORT STUDIOS</span>
        </div>
      </footer>

      {/* MODAL 1: CONTROLS & HOW TO PLAY */}
      {activeModal === 'controls' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Driving Controls and Dynamics"
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <div className="glass-panel p-6 rounded-2xl border border-cyan-500/40 max-w-2xl w-full text-white font-racing relative shadow-2xl">
            <button
              onClick={() => setActiveModal('none')}
              aria-label="Close controls modal"
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-2xl font-display font-extrabold text-cyan-300 mb-1 flex items-center gap-2">
              <Gamepad2 className="w-6 h-6 text-cyan-400" /> GEARBOX & DRIVING CONTROLS
            </h3>
            <p className="text-xs text-gray-400 mb-4 font-mono">
              Manual upshifts (SHIFT / GEAR+) combined with automatic speed-based downshifting when braking or slowing down.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-black/50 border border-white/10 p-4 rounded-xl">
                <span className="text-xs uppercase font-bold text-cyan-400 flex items-center gap-1.5 mb-3">
                  <Keyboard className="w-4 h-4" /> PC KEYBOARD (SEMI-AUTO)
                </span>
                <ul className="space-y-1.5 text-xs font-mono text-gray-300">
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">THROTTLE / BRAKE:</span>
                    <span className="text-cyan-300 font-bold">W / S or UP / DOWN</span>
                  </li>
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">STEERING:</span>
                    <span className="text-white font-bold">A / D or LEFT / RIGHT</span>
                  </li>
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">GEAR UP (+ MANUAL):</span>
                    <span className="text-amber-400 font-bold">SHIFT or E</span>
                  </li>
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">GEAR DOWN:</span>
                    <span className="text-emerald-400 font-bold">AUTO (CTRL/Q = REV)</span>
                  </li>
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">HANDBRAKE DRIFT:</span>
                    <span className="text-rose-400 font-bold">SPACEBAR ONLY</span>
                  </li>
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">NITRO BOOST:</span>
                    <span className="text-purple-400 font-bold">F or N</span>
                  </li>
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">CAMERA / HORN:</span>
                    <span className="text-cyan-300 font-bold">C / H</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-gray-400">RESET / PAUSE:</span>
                    <span className="text-rose-400 font-bold">R / ESC</span>
                  </li>
                </ul>
              </div>

              <div className="bg-black/50 border border-cyan-500/20 p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-xs uppercase font-bold text-cyan-400 flex items-center gap-1.5 mb-3">
                    <Smartphone className="w-4 h-4" /> SMARTPHONE GYRO + PADDLES
                  </span>
                  <div className="space-y-2 text-xs font-mono text-gray-300">
                    <p className="text-gray-400">
                      1. Scan QR code or open on phone in <span className="text-cyan-300 font-bold">Landscape</span>.
                    </p>
                    <p className="text-gray-400">
                      2. Tilt phone left/right to steer cleanly.
                    </p>
                    <p className="text-gray-400">
                      3. Tap <span className="text-cyan-300 font-bold">GEAR + ▲</span> (right paddle) at redline to upshift! Downshifts happen automatically as speed drops (tap <span className="text-amber-300 font-bold">GEAR -</span> for Reverse).
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
              CLOSE (ESC)
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: PAIR PHONE GYRO */}
      {activeModal === 'gyro' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pair Gyro Controller"
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <div className="glass-panel p-6 rounded-2xl border border-cyan-500/40 max-w-md w-full text-white text-center font-racing relative shadow-2xl">
            <button
              onClick={() => setActiveModal('none')}
              aria-label="Close gyro pairing modal"
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-display font-bold text-cyan-300 mb-1 flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5 text-cyan-400" /> PAIR GYRO CONTROLLER
            </h3>
            <p className="text-xs text-gray-400 mb-3 font-mono">
              Scan with your phone&apos;s camera (same Wi-Fi) for tilt steering &amp; F1 paddle shifters!
            </p>

            <div className="bg-white p-3.5 rounded-2xl shadow-xl flex flex-col items-center justify-center mb-3">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="w-52 h-52 rounded-lg select-none block" />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-gray-500 text-xs font-mono">
                  Generating High-Contrast QR...
                </div>
              )}
            </div>

            <div className="flex items-center justify-between bg-cyan-950/50 border border-cyan-500/40 p-2.5 rounded-xl mb-3">
              <span className="text-xs text-cyan-200 font-bold uppercase tracking-wider">PAIRING CODE:</span>
              <span className="font-mono font-extrabold text-lg text-cyan-300 tracking-widest bg-black/80 px-3 py-0.5 rounded border border-cyan-500/50">
                {roomId}
              </span>
            </div>

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
              {httpsPort !== null && (
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/10 text-[10px] font-mono">
                  <span className="text-gray-400">
                    {preferHttpsQr ? 'First time on phone: Advanced → Proceed' : 'HTTP mode (Touch wheel if gyro blocked)'}
                  </span>
                  <button
                    onClick={() => setPreferHttpsQr((prev) => !prev)}
                    className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold"
                  >
                    {preferHttpsQr ? 'HTTPS (GYRO)' : 'HTTP'}
                  </button>
                </div>
              )}
            </div>

            {availableIps.length > 1 && (
              <div className="flex items-center justify-center gap-2 mb-3 text-[11px] font-mono text-gray-400">
                <label htmlFor="home-ip-select">Wi-Fi / LAN IP:</label>
                <select
                  id="home-ip-select"
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
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gameplay and Graphics Settings"
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <div className="glass-panel p-6 rounded-2xl border border-white/20 max-w-md w-full text-white font-racing relative shadow-2xl">
            <button
              onClick={() => setActiveModal('none')}
              aria-label="Close settings modal"
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-display font-bold text-white mb-1 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" /> GAMEPLAY & GRAPHICS SETTINGS
            </h3>
            <p className="text-xs text-gray-400 mb-4 font-mono">
              Settings are saved automatically and applied in-game.
            </p>

            <div className="space-y-4 mb-5">
              <div>
                <span className="text-xs uppercase font-bold text-gray-300 block mb-2 font-mono">
                  GRAPHICS PRESET
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['ultra', 'high', 'medium'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        playClick();
                        onUpdateSettings({ graphicsQuality: q });
                      }}
                      className={`py-2 rounded-xl text-xs font-bold uppercase font-mono transition-all border ${
                        settings.graphicsQuality === q
                          ? 'bg-cyan-500 text-black border-cyan-400 shadow-lg shadow-cyan-500/20'
                          : 'bg-black/40 text-gray-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs uppercase font-bold text-gray-300 block mb-2 font-mono">
                  DEFAULT CAMERA VIEW
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      playClick();
                      onUpdateSettings({ defaultCamera: 'chase' });
                    }}
                    className={`py-2 rounded-xl text-xs font-bold uppercase font-mono transition-all border ${
                      settings.defaultCamera === 'chase'
                        ? 'bg-cyan-500 text-black border-cyan-400'
                        : 'bg-black/40 text-gray-400 border-white/10 hover:text-white'
                    }`}
                  >
                    CHASE (BEHIND CAR)
                  </button>
                  <button
                    onClick={() => {
                      playClick();
                      onUpdateSettings({ defaultCamera: 'hood' });
                    }}
                    className={`py-2 rounded-xl text-xs font-bold uppercase font-mono transition-all border ${
                      settings.defaultCamera === 'hood'
                        ? 'bg-cyan-500 text-black border-cyan-400'
                        : 'bg-black/40 text-gray-400 border-white/10 hover:text-white'
                    }`}
                  >
                    HOOD (FIRST PERSON)
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs uppercase font-bold text-gray-300 mb-1.5 font-mono">
                  <label htmlFor="gyro-sens-home">GYRO SENSITIVITY</label>
                  <span className="text-cyan-400">{settings.gyroSensitivity.toFixed(1)}x</span>
                </div>
                <input
                  id="gyro-sens-home"
                  type="range"
                  min={0.7}
                  max={2.0}
                  step={0.1}
                  value={settings.gyroSensitivity}
                  onChange={(e) => onUpdateSettings({ gyroSensitivity: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/10">
                <span className="text-xs font-mono text-gray-300">MASTER AUDIO & SOUND ENGINE</span>
                <button
                  onClick={handleToggleMute}
                  className={`px-3 py-1 rounded-lg text-xs font-bold font-mono ${
                    settings.isMuted
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  }`}
                >
                  {settings.isMuted ? 'MUTED' : 'ENABLED'}
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
