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

  const isReady = isLandscape || allowPortraitPlay || forceLandscapeView;

  const containerStyle: React.CSSProperties = isRotated90
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
    <div className="fixed inset-0 overflow-hidden select-none touch-none bg-[#08090C]">
      {/* Always keep game canvas mounted at stable tree position so WebGL Engine initializes cleanly on first mount */}
      <div
        style={containerStyle}
        className={`${isRotated90 ? '' : 'fixed inset-0 w-screen h-[100dvh] '}overflow-hidden select-none touch-none ${
          isReady ? '' : 'opacity-0 pointer-events-none'
        }`}
      >
        {children}
      </div>

      {!isReady && (
        <div className="fixed inset-0 bg-[#090A0D] z-50 flex flex-col justify-between p-6 text-center select-none text-[#F4F5F7] font-racing touch-none">
          <div className="flex items-center justify-between pit-surface px-4 py-2.5 rounded-lg border border-white/10">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
              <span className="text-xs uppercase tracking-wider text-[#00E5FF] font-bold">
                Apex Drift Mobile
              </span>
            </div>
            <span className="text-[11px] font-mono text-gray-400 uppercase">
              {isMultiplayerInvite ? 'MP Invite' : '12.5 km Circuit'}
            </span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto my-4">
            <div className="relative mb-5">
              <div className="w-20 h-20 rounded-full bg-[#12141A] border border-[#00E5FF]/50 flex items-center justify-center">
                {isMultiplayerInvite ? (
                  <Globe className="w-10 h-10 text-[#00E5FF] animate-spin-slow" />
                ) : (
                  <RotateCcw className="w-10 h-10 text-[#00E5FF] animate-spin-slow" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-[#12141A] p-1.5 rounded-full border border-white/25">
                <Smartphone className="w-4 h-4 text-[#F5A623]" />
              </div>
            </div>

            <h2 className="text-2xl font-bold font-display tracking-wide text-white mb-2">
              {isMultiplayerInvite ? 'Join Multiplayer Race' : 'Rotate to Landscape'}
            </h2>
            <p className="text-gray-300 text-sm leading-relaxed mb-6 px-3">
              {isMultiplayerInvite
                ? 'Tap below to enter Fullscreen Landscape mode and join your friend in the race lobby.'
                : 'Turn your phone horizontally with two hands for a full supercar cockpit view.'}
            </p>

            <button
              onClick={requestFullscreenLandscape}
              className="w-full py-3.5 px-6 bg-[#FF3B30] hover:bg-[#ff5147] text-white font-bold font-display text-base tracking-wider uppercase rounded-lg transition-all active:scale-95 flex items-center justify-center space-x-2"
            >
              <Maximize className="w-5 h-5" />
              <span>{isMultiplayerInvite ? 'Enter Fullscreen Landscape' : 'Start Race in Landscape'}</span>
            </button>

            <button
              onClick={handlePlayPortrait}
              className="w-full mt-3 py-3 px-4 bg-[#12141A] hover:bg-white/10 rounded-lg text-xs font-bold uppercase tracking-wider text-[#00E5FF] border border-white/15 transition-colors flex items-center justify-center space-x-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Play in Portrait Mode</span>
            </button>

            <p className="text-[11px] text-gray-500 mt-3 font-mono">
              Works seamlessly even when system Auto-Rotate is off.
            </p>
          </div>

          {onSwitchToController && (
            <div className="pt-2 border-t border-white/10">
              <button
                onClick={onSwitchToController}
                className="text-xs text-gray-400 hover:text-[#00E5FF] underline underline-offset-4 tracking-wider flex items-center justify-center mx-auto space-x-1.5"
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>Pair as Phone Controller for PC instead</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
