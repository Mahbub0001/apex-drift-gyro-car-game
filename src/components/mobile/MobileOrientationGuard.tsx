import React, { useState, useEffect } from 'react';
import { RotateCcw, Smartphone, Maximize, Play, Gamepad2, Globe } from 'lucide-react';

interface MobileOrientationGuardProps {
  children: React.ReactNode;
  onSwitchToController?: () => void;
  onOrientationChange?: (isLandscape: boolean) => void;
  onForceRotatedChange?: (isRotated90: boolean) => void;
  onRequestGyroPermission?: () => Promise<boolean>;
  isMultiplayerInvite?: boolean;
}

export const MobileOrientationGuard: React.FC<MobileOrientationGuardProps> = ({
  children,
  onSwitchToController,
  onOrientationChange,
  onForceRotatedChange,
  onRequestGyroPermission,
  isMultiplayerInvite = false
}) => {
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > window.innerHeight;
    }
    return true;
  });

  const [forceLandscapeView, setForceLandscapeView] = useState<boolean>(false);
  const [allowPortraitPlay, setAllowPortraitPlay] = useState<boolean>(false);
  const [vpSize, setVpSize] = useState<{ w: number; h: number }>(() =>
    typeof window !== 'undefined'
      ? { w: window.innerWidth, h: window.innerHeight }
      : { w: 390, h: 844 }
  );

  const isRotated90 = forceLandscapeView && !isLandscape;

  useEffect(() => {
    onForceRotatedChange?.(isRotated90);
    if (isRotated90) {
      const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
      return () => clearTimeout(t);
    }
  }, [isRotated90, onForceRotatedChange]);

  useEffect(() => {
    const checkOrientation = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const land = w > h;
      setVpSize({ w, h });
      setIsLandscape(land);
      onOrientationChange?.(land);
      if (land) {
        setForceLandscapeView(false);
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    document.addEventListener('fullscreenchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      document.removeEventListener('fullscreenchange', checkOrientation);
    };
  }, [onOrientationChange]);

  const requestFullscreenLandscape = () => {
    // Request iOS Motion/Gyro permission inside user tap gesture
    onRequestGyroPermission?.().catch(() => {});

    // Enter Fullscreen Horizontal Landscape immediately (never hang on locked/refused orientation.lock!)
    if (window.innerWidth <= window.innerHeight) {
      setForceLandscapeView(true);
      setAllowPortraitPlay(false);
    }

    try {
      const el = document.documentElement as any;
      const fsPromise: Promise<void> | undefined = el.requestFullscreen
        ? el.requestFullscreen({ navigationUI: 'hide' }).catch(() => el.requestFullscreen())
        : el.webkitRequestFullscreen
        ? Promise.resolve(el.webkitRequestFullscreen())
        : undefined;

      Promise.resolve(fsPromise)
        .then(() => {
          const ori = window.screen?.orientation as any;
          if (ori?.lock) {
            return ori.lock('landscape').catch(() => ori.lock('landscape-primary'));
          }
        })
        .catch(() => {});
    } catch (_) {}

    setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
  };

  const handlePlayPortrait = async () => {
    await onRequestGyroPermission?.();
    setForceLandscapeView(false);
    setAllowPortraitPlay(true);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  };

  if (isLandscape || allowPortraitPlay || forceLandscapeView) {
    const style: React.CSSProperties = isRotated90
      ? {
          position: 'fixed',
          top: 0,
          left: 0,
          width: `${vpSize.h}px`,
          height: `${vpSize.w}px`,
          transform: 'rotate(90deg) translateY(-100%)',
          transformOrigin: 'top left',
          overflow: 'hidden',
          zIndex: 40
        }
      : {};

    return (
      <div
        style={style}
        className={`${isRotated90 ? '' : 'fixed inset-0 w-screen h-[100dvh] '}overflow-hidden select-none touch-none`}
      >
        {children}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#08090C] z-50 flex flex-col justify-between p-6 text-center select-none text-white font-racing touch-none">
      <div className="flex items-center justify-between glass-panel px-4 py-2.5 rounded-xl border border-white/10">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs uppercase tracking-wider text-cyan-300 font-bold">
            APEX DRIFT MOBILE
          </span>
        </div>
        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
          {isMultiplayerInvite ? 'MP INVITE' : '12.5 KM CIRCUIT'}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto my-4">
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-cyan-500/10 border-2 border-cyan-400/40 flex items-center justify-center animate-pulse shadow-[0_0_35px_rgba(0,242,254,0.25)]">
            {isMultiplayerInvite ? (
              <Globe className="w-12 h-12 text-purple-400 animate-spin-slow" />
            ) : (
              <RotateCcw className="w-12 h-12 text-cyan-400 animate-spin-slow" />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-[#12151c] p-2 rounded-full border border-cyan-400 shadow-lg">
            <Smartphone className="w-5 h-5 text-cyan-300" />
          </div>
        </div>

        <h2 className="text-2xl font-bold font-display tracking-wide text-white mb-2">
          {isMultiplayerInvite ? 'JOIN MULTIPLAYER RACE' : 'ROTATE TO LANDSCAPE'}
        </h2>
        <p className="text-gray-300 text-sm leading-relaxed mb-6 px-3">
          {isMultiplayerInvite
            ? 'Tap below to enter Fullscreen Landscape mode and join your friend in the race lobby.'
            : 'Turn your phone horizontally with two hands for an authentic supercar cockpit view.'}
        </p>

        <button
          onClick={requestFullscreenLandscape}
          className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 via-sky-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold font-display text-base tracking-wider uppercase rounded-2xl shadow-xl shadow-cyan-500/30 transition-all transform active:scale-95 flex items-center justify-center space-x-2 border border-cyan-300/40"
        >
          <Maximize className="w-5 h-5" />
          <span>{isMultiplayerInvite ? 'ENTER FULLSCREEN LANDSCAPE' : 'START RACE IN LANDSCAPE'}</span>
        </button>

        <button
          onClick={handlePlayPortrait}
          className="w-full mt-3 py-3 px-4 bg-white/10 hover:bg-white/15 active:bg-cyan-500/30 rounded-xl text-xs font-bold uppercase tracking-wider text-cyan-300 border border-white/10 transition-all flex items-center justify-center space-x-1.5"
        >
          <Play className="w-3.5 h-3.5" />
          <span>PLAY IN PORTRAIT MODE</span>
        </button>

        <p className="text-[11px] text-gray-500 mt-3 font-mono">
          Works seamlessly even if system Auto-Rotate is turned off.
        </p>
      </div>

      {onSwitchToController && (
        <div className="pt-2 border-t border-white/10">
          <button
            onClick={onSwitchToController}
            className="text-xs text-gray-400 hover:text-cyan-300 underline underline-offset-4 tracking-wider flex items-center justify-center mx-auto space-x-1.5"
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Pair as Phone Controller for PC instead</span>
          </button>
        </div>
      )}
    </div>
  );
};
