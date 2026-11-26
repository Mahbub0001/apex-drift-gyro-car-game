import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { SuperCarConfig, SUPER_CARS, GameSettings, TransmissionMode } from '../../types';
import { SoundEngine } from '../../game/audio/SoundEngine';
import { CarPreview3D } from '../shared/CarPreview3D';
import { loadStoredRecords } from '../../utils/records';
import {
  Play,
  Warehouse,
  Gamepad2,
  Users,
  Settings as SettingsIcon,
  Volume2,
  VolumeX,
  X,
  ChevronRight,
  Smartphone,
  Keyboard,
  Copy,
  Check,
  Wifi,
  Sliders,
  Trophy
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

function formatBestLap(ms: number): string {
  const totalSec = Math.max(0, ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
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
  const [records] = useState(() => loadStoredRecords());
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

  const handleTransmissionChange = (mode: TransmissionMode) => {
    playClick();
    onUpdateSettings({ transmissionMode: mode });
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

  const carPaintCss = `#${selectedCar.bodyColorHex.toString(16).padStart(6, '0')}`;
  const accelZeroToHundred = (100 / 3.6 / (selectedCar.accelerationRate * 1.18)).toFixed(1);

  return (
    <div className="relative w-screen h-[100dvh] overflow-y-auto lg:overflow-hidden bg-[#090A0D] text-[#F4F5F7] font-racing select-none flex flex-col justify-between">
      {/* FULL-BLEED INTERACTIVE 3D HERO STAGE */}
      <div className="fixed inset-0 z-0">
        <CarPreview3D
          car={selectedCar}
          isRevving={isHomeRevving}
          onRevClick={handleHomeRev}
          showControls={true}
          controlsAlign="bottom-right"
          targetOffsetX={-1.05}
        />
      </div>

      {/* Directional architectural carbon vignette so left cockpit rail has crisp legibility */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(9,10,13,0.94) 0%, rgba(9,10,13,0.78) 38%, rgba(9,10,13,0.28) 64%, rgba(9,10,13,0.12) 100%), linear-gradient(180deg, rgba(9,10,13,0.72) 0%, transparent 18%, transparent 82%, rgba(9,10,13,0.8) 100%)'
        }}
      />

      {/* TOP PIT-WALL HEADER */}
      <header className="relative z-20 flex items-center justify-between px-5 lg:px-8 py-3 border-b border-white/10 bg-[#090A0D]/75 backdrop-blur-md pointer-events-auto shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5">
            <span className="w-1.5 h-6 bg-[#FF3B30] rounded-sm block" />
            <h1 className="text-xl lg:text-2xl font-display font-bold tracking-wider text-[#F4F5F7]">
              APEX <span className="text-[#00E5FF]">DRIFT</span>
            </h1>
          </div>

          <div className="hidden md:flex items-center space-x-3 pl-4 border-l border-white/10 text-xs text-gray-300">
            <span>12.5 km Coastal &amp; Alpine Circuit</span>
            {records.bestLapMs !== null && (
              <>
                <span className="text-white/20">/</span>
                <span className="flex items-center gap-1.5 text-[#F5A623] font-mono tabular-nums font-bold">
                  <Trophy className="w-3.5 h-3.5" />
                  Best Lap {formatBestLap(records.bestLapMs)}
                </span>
              </>
            )}
          </div>
        </div>

        <nav className="flex items-center space-x-2" aria-label="Primary actions">
          <button
            type="button"
            onClick={() => {
              playClick();
              setActiveModal('gyro');
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              isPhoneConnected
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/45'
                : 'bg-[#12141A]/90 text-gray-200 border-white/15 hover:border-[#00E5FF]/50 hover:text-[#00E5FF]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>{isPhoneConnected ? 'Phone Wheel Synced' : 'Pair Phone Wheel'}</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isPhoneConnected ? 'bg-emerald-400 animate-pulse' : 'bg-[#00E5FF]'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => {
              playClick();
              setActiveModal('controls');
            }}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#12141A]/90 text-xs font-semibold text-gray-300 hover:text-white border border-white/15 hover:border-white/30 transition-colors"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-gray-400" />
            <span>Controls</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClick();
              setActiveModal('settings');
            }}
            aria-label="Settings"
            className="p-2 rounded-lg bg-[#12141A]/90 text-gray-300 hover:text-white border border-white/15 hover:border-white/30 transition-colors"
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={settings.isMuted ? 'Unmute audio' : 'Mute audio'}
            className="p-2 rounded-lg bg-[#12141A]/90 text-gray-300 hover:text-white border border-white/15 hover:border-white/30 transition-colors"
            title={settings.isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {settings.isMuted ? (
              <VolumeX className="w-4 h-4 text-[#FF3B30]" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#00E5FF]" />
            )}
          </button>
        </nav>
      </header>

      {/* MAIN PIT-WALL CONTROL RAIL (Left overlay; right side stays open for 3D turntable interaction) */}
      <main className="relative z-10 flex-1 flex items-center px-5 lg:px-8 py-4 pointer-events-none min-h-0">
        <div className="w-full max-w-[460px] flex flex-col space-y-4 pointer-events-auto">
          {/* Active Vehicle Identification & Selector */}
          <section className="pit-surface rounded-xl p-4 lg:p-5 border-l-4" style={{ borderLeftColor: carPaintCss }}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="text-xs text-gray-400 font-medium">{selectedCar.subtitle}</p>
                <h2 className="text-3xl lg:text-4xl font-display font-bold tracking-tight text-[#F4F5F7] leading-none mt-0.5">
                  {selectedCar.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleHomeRev}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                  isHomeRevving
                    ? 'bg-[#FF3B30] border-[#FF3B30] text-white'
                    : 'bg-white/5 border-white/15 text-[#F5A623] hover:bg-[#F5A623]/15'
                }`}
              >
                {isHomeRevving ? '8,500 RPM' : 'Rev Engine'}
              </button>
            </div>

            <p className="text-sm text-gray-300 leading-snug mb-3.5 max-w-[60ch]">
              {selectedCar.description}
            </p>

            {/* Quick 5-Car Switcher Tabs */}
            <div
              className="grid grid-cols-5 gap-1 bg-black/50 p-1 rounded-lg border border-white/10 mb-3.5"
              role="group"
              aria-label="Quick car selection"
            >
              {SUPER_CARS.map((car) => {
                const active = selectedCar.id === car.id;
                const swatch = `#${car.bodyColorHex.toString(16).padStart(6, '0')}`;
                return (
                  <button
                    key={car.id}
                    type="button"
                    onClick={() => {
                      playClick();
                      onSelectCar(car);
                    }}
                    className={`py-1.5 px-1 rounded-md text-[11px] font-display font-semibold tracking-wide transition-colors flex items-center justify-center gap-1 ${
                      active
                        ? 'bg-[#F4F5F7] text-[#090A0D]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: swatch }}
                    />
                    <span className="truncate">{car.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Clean Hairline Spec Strip */}
            <div className="grid grid-cols-4 border-t border-white/10 pt-3 text-left">
              <div className="pr-2 border-r border-white/10">
                <span className="text-[11px] text-gray-400 block">Top Speed</span>
                <span className="text-lg font-display font-bold tabular-nums text-white">
                  {selectedCar.topSpeedKmh}
                </span>
                <span className="text-[10px] text-gray-500 ml-0.5">km/h</span>
              </div>
              <div className="px-2.5 border-r border-white/10">
                <span className="text-[11px] text-gray-400 block">0–100 km/h</span>
                <span className="text-lg font-display font-bold tabular-nums text-white">
                  {accelZeroToHundred}
                </span>
                <span className="text-[10px] text-gray-500 ml-0.5">s</span>
              </div>
              <div className="px-2.5 border-r border-white/10">
                <span className="text-[11px] text-gray-400 block">Grip</span>
                <span className="text-lg font-display font-bold tabular-nums text-[#00E5FF]">
                  {selectedCar.handlingScore}
                </span>
                <span className="text-[10px] text-gray-500 ml-0.5">/10</span>
              </div>
              <div className="pl-2.5">
                <span className="text-[11px] text-gray-400 block">Drift Bias</span>
                <span className="text-lg font-display font-bold tabular-nums text-[#F5A623]">
                  {selectedCar.driftFactor}x
                </span>
              </div>
            </div>
          </section>

          {/* Gearbox Setup & Primary Race Launch */}
          <section className="pit-surface rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-white block">Transmission</span>
                <span className="text-[11px] text-gray-400">
                  {settings.transmissionMode === 'auto'
                    ? 'Auto shifts 1–6 and reverses on brake'
                    : 'Manual sequential shifts via Shift / Ctrl or paddles'}
                </span>
              </div>

              <div
                className="inline-flex p-0.5 rounded-lg bg-black/60 border border-white/15 shrink-0"
                role="group"
                aria-label="Transmission mode"
              >
                <button
                  type="button"
                  onClick={() => handleTransmissionChange('auto')}
                  className={`px-3 py-1 rounded-md text-xs font-display font-bold tracking-wider transition-colors ${
                    settings.transmissionMode === 'auto'
                      ? 'bg-[#00E5FF] text-[#090A0D]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  AUTO
                </button>
                <button
                  type="button"
                  onClick={() => handleTransmissionChange('manual')}
                  className={`px-3 py-1 rounded-md text-xs font-display font-bold tracking-wider transition-colors ${
                    settings.transmissionMode === 'manual'
                      ? 'bg-[#F5A623] text-[#090A0D]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  MANUAL
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playClick();
                onStartRacing();
              }}
              onMouseEnter={playHover}
              className="group w-full flex items-center justify-between px-5 py-3.5 rounded-lg bg-[#FF3B30] hover:bg-[#ff5147] active:scale-[0.99] transition-all text-white shadow-[0_10px_28px_rgba(255,59,48,0.35)]"
            >
              <span className="flex items-center gap-2.5 text-lg font-display font-bold tracking-wide">
                <Play className="w-5 h-5 fill-white" />
                <span>Start Race</span>
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/30 text-white/90">
                Enter
              </span>
            </button>

            {/* Secondary Pit-Lane Actions */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  onOpenGarage();
                }}
                onMouseEnter={playHover}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 transition-colors text-left"
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-gray-100">
                  <Warehouse className="w-4 h-4 text-[#F5A623]" />
                  <span>Open Garage</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  onOpenMultiplayer();
                }}
                onMouseEnter={playHover}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 transition-colors text-left"
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-gray-100">
                  <Users className="w-4 h-4 text-[#00E5FF]" />
                  <span>Multiplayer</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
          </section>
        </div>
      </main>

      {/* CLEAN STATUS FOOTER */}
      <footer className="relative z-20 flex items-center justify-between px-5 lg:px-8 py-2 border-t border-white/10 bg-[#090A0D]/80 text-[11px] text-gray-400 pointer-events-auto shrink-0">
        <div className="flex items-center space-x-3">
          <span>Quality: <strong className="text-gray-200 capitalize">{settings.graphicsQuality}</strong></span>
          <span className="text-white/15">|</span>
          <span>Gearbox: <strong className="text-[#00E5FF] uppercase">{settings.transmissionMode}</strong></span>
          {records.bestScore > 0 && (
            <>
              <span className="text-white/15 hidden sm:inline">|</span>
              <span className="hidden sm:inline">High Drift Score: <strong className="text-[#F5A623] tabular-nums">{records.bestScore.toLocaleString()}</strong></span>
            </>
          )}
        </div>
        <div className="flex items-center space-x-3 font-mono">
          <span>Gyro ID: <strong className="text-gray-200">{roomId}</strong></span>
        </div>
      </footer>

      {/* MODAL 1: CONTROLS & GEARBOX GUIDE */}
      {activeModal === 'controls' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Driving Controls"
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <div className="pit-surface p-6 rounded-xl border border-white/15 max-w-2xl w-full text-[#F4F5F7] relative">
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              aria-label="Close controls modal"
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-2xl font-display font-bold text-white mb-1 flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-[#00E5FF]" /> Driving Controls
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Switch anytime between Automatic (6-speed DCT) and Manual sequential shifting using the G key or HUD switch.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="bg-black/45 border border-white/10 p-4 rounded-lg">
                <span className="text-xs font-semibold text-[#00E5FF] flex items-center gap-1.5 mb-3">
                  <Keyboard className="w-4 h-4" /> Keyboard Controls
                </span>
                <ul className="space-y-1.5 text-xs text-gray-300">
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">Gas / Brake (or Auto Reverse)</span>
                    <span className="font-mono text-white font-semibold">W / S or ↑ / ↓</span>
                  </li>
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">Steer</span>
                    <span className="font-mono text-white font-semibold">A / D or ← / →</span>
                  </li>
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">Toggle Auto / Manual Gearbox</span>
                    <span className="font-mono text-[#00E5FF] font-semibold">G</span>
                  </li>
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">Shift Up / Shift Down</span>
                    <span className="font-mono text-[#F5A623] font-semibold">Shift (E) / Ctrl (Q)</span>
                  </li>
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">Handbrake Drift</span>
                    <span className="font-mono text-[#FF3B30] font-semibold">Spacebar</span>
                  </li>
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">Nitro Boost</span>
                    <span className="font-mono text-[#00E5FF] font-semibold">F or N</span>
                  </li>
                  <li className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-gray-400">Camera View / Horn</span>
                    <span className="font-mono text-white font-semibold">C / H</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-gray-400">Reset Car / Pause</span>
                    <span className="font-mono text-white font-semibold">R / Esc</span>
                  </li>
                </ul>
              </div>

              <div className="bg-black/45 border border-white/10 p-4 rounded-lg flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#F5A623] flex items-center gap-1.5 mb-3">
                    <Smartphone className="w-4 h-4" /> Phone Gyro Steering Wheel
                  </span>
                  <ol className="space-y-2 text-xs text-gray-300 list-decimal list-inside">
                    <li>Open the pairing QR code on your smartphone camera (same Wi-Fi network).</li>
                    <li>Hold your phone in landscape orientation and tap Center to zero your neutral angle.</li>
                    <li>Slide fingers vertically on Gas &amp; Brake rails for progressive pedal pressure.</li>
                    <li>Use the paddle shifters in Manual mode or let Auto manage gears cleanly.</li>
                  </ol>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveModal('gyro')}
                  className="mt-4 w-full py-2 bg-[#00E5FF]/15 hover:bg-[#00E5FF]/25 text-[#00E5FF] border border-[#00E5FF]/40 rounded-lg text-xs font-semibold transition-colors"
                >
                  Open Pairing QR Code
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Close (Esc)
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
          <div className="pit-surface p-6 rounded-xl border border-white/15 max-w-md w-full text-[#F4F5F7] text-center relative">
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              aria-label="Close gyro pairing modal"
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-display font-bold text-white mb-1">Pair Phone Steering Wheel</h3>
            <p className="text-xs text-gray-400 mb-3">
              Scan with your phone&apos;s camera on the same Wi-Fi network to turn it into a 60Hz tilt steering wheel.
            </p>

            <div className="bg-white p-3 rounded-xl inline-flex items-center justify-center mb-3">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Controller QR Code" className="w-48 h-48 rounded select-none block" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-gray-500 text-xs font-mono">
                  Generating QR...
                </div>
              )}
            </div>

            <div className="flex items-center justify-between bg-black/45 border border-white/10 px-3 py-2 rounded-lg mb-3">
              <span className="text-xs text-gray-300 font-semibold">Pairing Code</span>
              <span className="font-mono font-bold text-base text-[#00E5FF] tracking-widest">
                {roomId}
              </span>
            </div>

            <div className="bg-black/45 border border-white/10 rounded-lg p-2.5 mb-3 text-left">
              <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                <span className="flex items-center gap-1 text-[#00E5FF]"><Wifi className="w-3 h-3" /> Controller Link</span>
                <button
                  type="button"
                  onClick={() => {
                    if (controllerUrl) {
                      navigator.clipboard.writeText(controllerUrl);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }
                  }}
                  className="flex items-center gap-1 text-[#00E5FF] hover:underline"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLink ? 'Copied' : 'Copy link'}</span>
                </button>
              </div>
              <div className="text-[11px] font-mono text-gray-300 break-all select-all bg-black/55 p-1.5 rounded">
                {controllerUrl || 'Detecting network...'}
              </div>
              {httpsPort !== null && (
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/10 text-[11px]">
                  <span className="text-gray-400">
                    {preferHttpsQr ? 'If browser warns: Advanced -> Proceed' : 'HTTP fallback (drag wheel if gyro blocked)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreferHttpsQr((prev) => !prev)}
                    className="px-2 py-0.5 rounded bg-white/10 border border-white/15 text-[#00E5FF] font-mono font-bold"
                  >
                    {preferHttpsQr ? 'HTTPS' : 'HTTP'}
                  </button>
                </div>
              )}
            </div>

            {availableIps.length > 1 && (
              <div className="flex items-center justify-center gap-2 mb-3 text-xs text-gray-400">
                <label htmlFor="home-ip-select">Wi-Fi Adapter:</label>
                <select
                  id="home-ip-select"
                  value={lanIp}
                  onChange={(e) => setLanIp(e.target.value)}
                  className="bg-black/60 border border-white/15 rounded px-2 py-1 text-[#00E5FF] text-xs font-mono outline-none"
                >
                  {availableIps.map((ip) => (
                    <option key={ip} value={ip}>{ip}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="w-full py-2.5 bg-[#00E5FF] hover:bg-[#33ecff] text-[#090A0D] font-display font-bold rounded-lg text-xs uppercase tracking-wider"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: GAMEPLAY & GRAPHICS SETTINGS */}
      {activeModal === 'settings' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gameplay and Graphics Settings"
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <div className="pit-surface p-6 rounded-xl border border-white/15 max-w-md w-full text-[#F4F5F7] relative">
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              aria-label="Close settings modal"
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-display font-bold text-white mb-1 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#00E5FF]" /> Gameplay &amp; Graphics
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Preferences are saved automatically for both desktop and mobile play.
            </p>

            <div className="space-y-4 mb-5">
              <div>
                <span className="text-xs font-semibold text-gray-300 block mb-1.5">
                  Transmission Mode
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(['auto', 'manual'] as const).map((tm) => (
                    <button
                      key={tm}
                      type="button"
                      onClick={() => handleTransmissionChange(tm)}
                      className={`py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wider border transition-colors ${
                        settings.transmissionMode === tm
                          ? tm === 'auto'
                            ? 'bg-[#00E5FF] text-[#090A0D] border-[#00E5FF]'
                            : 'bg-[#F5A623] text-[#090A0D] border-[#F5A623]'
                          : 'bg-black/45 text-gray-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {tm === 'auto' ? 'Automatic DCT' : 'Manual Sequential'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-gray-300 block mb-1.5">
                  Graphics Quality
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['ultra', 'high', 'medium'] as const).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        playClick();
                        onUpdateSettings({ graphicsQuality: q });
                      }}
                      className={`py-2 rounded-lg text-xs font-display font-bold uppercase border transition-colors ${
                        settings.graphicsQuality === q
                          ? 'bg-[#F4F5F7] text-[#090A0D] border-white'
                          : 'bg-black/45 text-gray-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-gray-300 block mb-1.5">
                  Default Camera View
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      onUpdateSettings({ defaultCamera: 'chase' });
                    }}
                    className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      settings.defaultCamera === 'chase'
                        ? 'bg-[#F4F5F7] text-[#090A0D] border-white'
                        : 'bg-black/45 text-gray-400 border-white/10 hover:text-white'
                    }`}
                  >
                    Chase Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      onUpdateSettings({ defaultCamera: 'hood' });
                    }}
                    className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      settings.defaultCamera === 'hood'
                        ? 'bg-[#F4F5F7] text-[#090A0D] border-white'
                        : 'bg-black/45 text-gray-400 border-white/10 hover:text-white'
                    }`}
                  >
                    Hood Camera
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-1">
                  <label htmlFor="gyro-sens-home">Gyro Steering Sensitivity</label>
                  <span className="font-mono text-[#00E5FF] tabular-nums">{settings.gyroSensitivity.toFixed(1)}x</span>
                </div>
                <input
                  id="gyro-sens-home"
                  type="range"
                  min={0.7}
                  max={2.0}
                  step={0.1}
                  value={settings.gyroSensitivity}
                  onChange={(e) => onUpdateSettings({ gyroSensitivity: parseFloat(e.target.value) })}
                  className="w-full accent-[#00E5FF] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-black/45 border border-white/10">
                <span className="text-xs font-semibold text-gray-300">Engine &amp; Effects Audio</span>
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className={`px-3 py-1 rounded text-xs font-mono font-bold ${
                    settings.isMuted
                      ? 'bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/40'
                      : 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/40'
                  }`}
                >
                  {settings.isMuted ? 'Muted' : 'Enabled'}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Save &amp; Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
