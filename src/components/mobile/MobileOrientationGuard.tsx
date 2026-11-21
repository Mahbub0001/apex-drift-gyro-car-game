import React, { useState, useEffect } from 'react';
import { RotateCcw, Smartphone, Maximize, Play, Gamepad2 } from 'lucide-react';

interface MobileOrientationGuardProps {
  children: React.ReactNode;
  onSwitchToController?: () => void;
}

export const MobileOrientationGuard: React.FC<MobileOrientationGuardProps> = ({
  children,
  onSwitchToController
}) => {
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > window.innerHeight;
    }
    return true;
  });

  const [forceHorizontal, setForceHorizontal] = useState<boolean>(false);

  useEffect(() => {
    const checkOrientation = () => {
      const land = window.innerWidth > window.innerHeight;
      setIsLandscape(land);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const requestFullscreenLandscape = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen();
      }
      if (window.screen.orientation && (window.screen.orientation as any).lock) {
        await (window.screen.orientation as any).lock('landscape').catch(() => {});
      }
    } catch (e) {
      console.warn('Orientation lock error:', e);
    }
  };

  // If in landscape or forced horizontal, render children
  if (isLandscape || forceHorizontal) {
    const forcedStyle: React.CSSProperties = forceHorizontal
      ? {
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vh',
          height: '100vw',
          transform: 'rotate(90deg) translateY(-100%)',
          transformOrigin: 'top left',
          overflow: 'hidden'
        }
      : {};

    return (
      <div style={forcedStyle} className="fixed inset-0 w-full h-full overflow-hidden select-none">
        {children}
      </div>
    );
  }

  // Portrait Mode Activation Screen
  return (
    <div className="fixed inset-0 bg-[#08090C] z-50 flex flex-col justify-between p-6 text-center select-none text-white font-racing">
      {/* Top Brand */}
      <div className="flex items-center justify-between glass-panel px-4 py-2.5 rounded-xl border border-white/10">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs uppercase tracking-wider text-cyan-300 font-bold">
            APEX DRIFT MOBILE
          </span>
        </div>
        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
          12.5 KM CIRCUIT
        </span>
      </div>

      {/* Center Rotate Guide */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto my-4">
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-cyan-500/10 border-2 border-cyan-400/40 flex items-center justify-center animate-pulse shadow-[0_0_35px_rgba(0,242,254,0.25)]">
            <RotateCcw className="w-12 h-12 text-cyan-400 animate-spin-slow" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-[#12151c] p-2 rounded-full border border-cyan-400 shadow-lg">
            <Smartphone className="w-5 h-5 text-cyan-300" />
          </div>
        </div>

        <h2 className="text-2xl font-bold font-display tracking-wide text-white mb-2">
          ROTATE TO LANDSCAPE
        </h2>
        <p className="text-gray-300 text-sm leading-relaxed mb-6 px-3">
          Turn your phone horizontally with two hands like a real supercar steering wheel to enter full-screen landscape racing.
        </p>

        {/* Primary Action: Lock Fullscreen Landscape */}
        <button
          onClick={requestFullscreenLandscape}
          className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 via-sky-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold font-display text-base tracking-wider uppercase rounded-2xl shadow-xl shadow-cyan-500/30 transition-all transform active:scale-95 flex items-center justify-center space-x-2 border border-cyan-300/40"
        >
          <Maximize className="w-5 h-5" />
          <span>START RACE (LANDSCAPE)</span>
        </button>

        {/* Secondary Action: Force Horizontal View (If Auto-Rotate locked) */}
        <button
          onClick={() => setForceHorizontal(true)}
          className="w-full mt-3 py-3 px-4 bg-white/10 hover:bg-white/15 active:bg-cyan-500/30 rounded-xl text-xs font-bold uppercase tracking-wider text-cyan-300 border border-white/10 transition-all"
        >
          FORCE HORIZONTAL VIEW (IF AUTO-ROTATE LOCKED)
        </button>
      </div>

      {/* Footer Alternative */}
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
