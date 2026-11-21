import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';
import { WebRTCController } from '../../services/webrtc';
import { ControllerInput } from '../../types';
import { RotateCcw, Zap, Flame, ShieldAlert, Wifi, Maximize, Compass } from 'lucide-react';

interface MobileControllerProps {
  roomId: string;
}

interface PhysicalWheelProps {
  angleDegrees: number;
  speedKmh: number;
  gear: number | string;
  rpm: number;
  size?: number;
}

const PhysicalWheel: React.FC<PhysicalWheelProps> = ({
  angleDegrees,
  speedKmh,
  gear,
  rpm,
  size = 230
}) => {
  // 10-LED sequential shift light array: 4 Green, 3 Amber, 3 Red
  const activeLeds = Math.min(10, Math.max(0, Math.floor(((rpm - 1500) / 7000) * 10)));
  const isRedline = rpm >= 8000;

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{ width: size, height: size }}
    >
      {/* Outer Glow Halo based on Steering */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none transition-opacity duration-300"
        style={{
          boxShadow: `0 0 35px ${Math.abs(angleDegrees) > 10 ? 'rgba(0, 242, 254, 0.22)' : 'rgba(255, 255, 255, 0.06)'}`,
        }}
      />

      {/* Graduation Arc Markings Behind Wheel (-90°, -45°, 0°, +45°, +90°) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
        viewBox="0 0 240 240"
      >
        <circle
          cx="120"
          cy="120"
          r="112"
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="2"
          strokeDasharray="4 8"
        />
        <line x1="120" y1="2" x2="120" y2="12" stroke="#00f2fe" strokeWidth="3" />
        <line x1="38" y1="38" x2="45" y2="45" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
        <line x1="202" y1="38" x2="195" y2="45" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
        <line x1="8" y1="120" x2="18" y2="120" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
        <line x1="232" y1="120" x2="222" y2="120" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
      </svg>

      {/* THE ROTATING PHYSICAL GT3 / SUPERCAR WHEEL */}
      <div
        className="relative w-full h-full rounded-full flex items-center justify-center transition-transform duration-75 will-change-transform"
        style={{
          transform: `rotate(${angleDegrees}deg)`,
          transformOrigin: 'center center',
          boxShadow: '0 16px 40px rgba(0,0,0,0.9), inset 0 2px 4px rgba(255,255,255,0.25), inset 0 -4px 8px rgba(0,0,0,0.9)'
        }}
      >
        {/* Outer Wheel Rim (Molded Dark Perforated Leather / Carbon Ring) */}
        <div
          className="absolute inset-0 rounded-full border-[18px] border-[#181a20]"
          style={{
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.85)'
          }}
        />

        {/* 12-o'clock Racing Centering Stripe (Bright Cyan Neon) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-[18px] bg-cyan-400 rounded-sm shadow-[0_0_12px_#00f2fe] z-20" />

        {/* 9-o'clock and 3-o'clock Ergonomic Textured Grips */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[22px] h-28 bg-[#1f232b] rounded-r-lg border-r border-cyan-500/30 flex flex-col justify-around py-2 items-center opacity-90 shadow-inner">
          <div className="w-1.5 h-1.5 rounded-full bg-black/60" />
          <div className="w-1.5 h-1.5 rounded-full bg-black/60" />
          <div className="w-1.5 h-1.5 rounded-full bg-black/60" />
          <div className="w-1.5 h-1.5 rounded-full bg-black/60" />
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[22px] h-28 bg-[#1f232b] rounded-l-lg border-l border-cyan-500/30 flex flex-col justify-around py-2 items-center opacity-90 shadow-inner">
          <div className="w-1.5 h-1.5 rounded-full bg-black/60" />
          <div className="w-1.5 h-1.5 rounded-full bg-black/60" />
          <div className="w-1.5 h-1.5 rounded-full bg-black/60" />
          <div className="w-1.5 h-1.5 rounded-full bg-black/60" />
        </div>

        {/* Left Spoke (Brushed Aluminum / Carbon) */}
        <div className="absolute left-[16px] top-1/2 -translate-y-1/2 w-[56px] h-[34px] bg-gradient-to-r from-[#2a2d36] to-[#1c1e24] rounded-l-md border-t border-b border-white/10 flex items-center justify-center shadow-lg">
          <div className="w-6 h-3 rounded-full bg-[#121418] border border-white/5" />
        </div>

        {/* Right Spoke */}
        <div className="absolute right-[16px] top-1/2 -translate-y-1/2 w-[56px] h-[34px] bg-gradient-to-l from-[#2a2d36] to-[#1c1e24] rounded-r-md border-t border-b border-white/10 flex items-center justify-center shadow-lg">
          <div className="w-6 h-3 rounded-full bg-[#121418] border border-white/5" />
        </div>

        {/* Bottom Spoke */}
        <div className="absolute bottom-[16px] left-1/2 -translate-x-1/2 w-[34px] h-[52px] bg-gradient-to-t from-[#2a2d36] to-[#1c1e24] rounded-b-md border-l border-r border-white/10 flex flex-col items-center justify-center shadow-lg">
          <div className="w-3 h-6 rounded-full bg-[#121418] border border-white/5" />
        </div>

        {/* Central Horn Hub & Digital Telemetry Screen */}
        <div
          className="relative rounded-full flex flex-col items-center justify-center border-2 border-white/20 p-2 text-center shadow-2xl z-10"
          style={{
            width: size * 0.62,
            height: size * 0.62,
            background: 'radial-gradient(circle at 40% 40%, #1f232b 0%, #121419 75%, #0a0b0d 100%)'
          }}
        >
          {/* Shift Light Array (F1 / GT3 sequential 10-LED bar) */}
          <div className="flex items-center space-x-1 mb-1 px-2 py-0.5 bg-black/60 rounded-full border border-white/10">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => {
              const isActive = idx < activeLeds;
              let color = '#10b981'; // Green (0-3)
              if (idx >= 4 && idx < 7) color = '#f59e0b'; // Amber (4-6)
              if (idx >= 7) color = '#ef4444'; // Red (7-9)

              return (
                <div
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-75 ${
                    isRedline && isActive ? 'animate-ping' : ''
                  }`}
                  style={{
                    backgroundColor: isActive ? color : 'rgba(255,255,255,0.08)',
                    boxShadow: isActive ? `0 0 6px ${color}` : 'none'
                  }}
                />
              );
            })}
          </div>

          {/* Speed Digital Readout */}
          <div className="text-2xl font-display font-black tracking-tight text-cyan-300 leading-none">
            {speedKmh}
          </div>
          <div className="text-[9px] font-mono tracking-widest text-gray-400 uppercase leading-none mt-0.5">
            KM/H
          </div>

          {/* Current Gear */}
          <div className="flex items-center justify-center space-x-1.5 my-0.5">
            <span className="text-[10px] text-gray-500 font-mono">GEAR</span>
            <span className="text-lg font-display font-black text-amber-400 leading-none">
              {gear}
            </span>
          </div>

          {/* Realtime Steering Angle Readout */}
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400 leading-none">
            {angleDegrees === 0
              ? '● CENTER'
              : angleDegrees > 0
              ? `▶ +${Math.abs(angleDegrees)}°`
              : `◀ -${Math.abs(angleDegrees)}°`}
          </div>
        </div>
      </div>
    </div>
  );
};

export const MobileController: React.FC<MobileControllerProps> = ({ roomId }) => {
  const {
    steerNormalized,
    angleDegrees,
    isPermissionGranted,
    needsPermissionPrompt,
    isLandscape,
    wakeLockActive,
    requestPermission,
    recalibrate
  } = useDeviceOrientation();

  const [currentRoomId, setCurrentRoomId] = useState<string>(roomId);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [ping, setPing] = useState<number>(0);
  const [hostTelemetry, setHostTelemetry] = useState<{ speedKmh: number; gear: number | string; rpm: number }>({
    speedKmh: 0,
    gear: 'N',
    rpm: 0
  });

  const [throttle, setThrottle] = useState<number>(0);
  const [brake, setBrake] = useState<number>(0);
  const [handbrake, setHandbrake] = useState<boolean>(false);
  const [nitro, setNitro] = useState<boolean>(false);

  const controllerRef = useRef<WebRTCController | null>(null);
  const throttleContainerRef = useRef<HTMLDivElement>(null);
  const brakeContainerRef = useRef<HTMLDivElement>(null);

  // Initialize WebRTC connection
  useEffect(() => {
    const ctrl = new WebRTCController(currentRoomId);
    controllerRef.current = ctrl;

    ctrl.connect(
      (feedback) => {
        setHostTelemetry(feedback);
      },
      (connected) => {
        setIsConnected(connected);
      }
    );

    const pingCheck = setInterval(() => {
      setPing(ctrl.pingMs);
    }, 500);

    return () => {
      clearInterval(pingCheck);
      ctrl.destroy();
    };
  }, [currentRoomId]);

  // Transmit inputs to desktop at 60 Hz
  useEffect(() => {
    if (!isConnected || !controllerRef.current) return;

    const interval = setInterval(() => {
      const inputPacket: ControllerInput = {
        steer: steerNormalized,
        throttle,
        brake,
        handbrake,
        nitro,
        reset: false,
        cameraSwitch: false,
        angleDegrees,
        timestamp: Date.now()
      };
      controllerRef.current?.sendInput(inputPacket);
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, [isConnected, steerNormalized, throttle, brake, handbrake, nitro, angleDegrees]);

  // Touch handlers for Throttle Slider
  const handleThrottleTouch = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!throttleContainerRef.current) return;
    const rect = throttleContainerRef.current.getBoundingClientRect();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const relativeY = clientY - rect.top;
    // 0 at bottom, 1 at top
    const value = Math.max(0, Math.min(1, 1 - relativeY / rect.height));
    setThrottle(Number(value.toFixed(2)));
  }, []);

  // Touch handlers for Brake Slider
  const handleBrakeTouch = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!brakeContainerRef.current) return;
    const rect = brakeContainerRef.current.getBoundingClientRect();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const relativeY = clientY - rect.top;
    const value = Math.max(0, Math.min(1, 1 - relativeY / rect.height));
    setBrake(Number(value.toFixed(2)));
  }, []);

  const triggerHaptic = (ms: number = 30) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(ms);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const requestLandscape = async () => {
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

  const sendOneShotAction = (action: 'reset' | 'cameraSwitch') => {
    triggerHaptic(40);
    controllerRef.current?.sendInput({
      steer: steerNormalized,
      throttle,
      brake,
      handbrake,
      nitro,
      reset: action === 'reset',
      cameraSwitch: action === 'cameraSwitch',
      angleDegrees,
      timestamp: Date.now()
    });
  };

  // iOS / Manual permission modal
  if (needsPermissionPrompt && !isPermissionGranted) {
    return (
      <div className="fixed inset-0 bg-[#08090C] z-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="glass-panel p-8 rounded-2xl max-w-md w-full border border-cyan-500/30">
          <Zap className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold font-display text-white mb-2">
            START YOUR ENGINE
          </h2>
          <p className="text-gray-300 text-sm mb-6">
            Tap below to calibrate and grant access to the phone's gyroscope motion sensors for steering.
          </p>
          <button
            onClick={requestPermission}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold font-display text-lg rounded-xl shadow-lg shadow-cyan-500/25 transition-all transform active:scale-95"
          >
            ACTIVATE GYRO WHEEL
          </button>
        </div>
      </div>
    );
  }

  // Portrait Mode Controller: Full active steering wheel, HUD telemetry, and pedals
  if (!isLandscape) {
    return (
      <div className="fixed inset-0 bg-[#08090C] flex flex-col justify-between p-3 select-none overflow-hidden text-white font-racing">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between glass-panel px-3 py-2 rounded-xl border border-white/10">
          <div className="flex items-center space-x-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-xs uppercase tracking-wider text-gray-300 font-bold">
              {isConnected ? `${ping}ms P2P` : 'CONNECTING...'}
            </span>
            <button
              onClick={() => {
                const code = prompt('Enter Desktop Room Code:', currentRoomId);
                if (code && code.trim().length >= 4) {
                  setCurrentRoomId(code.trim().toUpperCase());
                }
              }}
              className="text-[10px] text-cyan-300 font-mono bg-white/10 active:bg-cyan-500/30 px-2 py-0.5 rounded border border-white/10"
            >
              {currentRoomId}
            </button>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={recalibrate}
              className="flex items-center space-x-1 px-2.5 py-1 bg-white/10 active:bg-cyan-500/30 rounded-lg text-[11px] font-bold uppercase tracking-wider"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>Center</span>
            </button>

            <button
              onClick={requestLandscape}
              className="flex items-center space-x-1 px-2.5 py-1 bg-cyan-500/20 active:bg-cyan-500/40 border border-cyan-500/40 rounded-lg text-[11px] font-bold text-cyan-300 uppercase tracking-wider"
              title="Switch to Horizontal Fullscreen"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rotate</span>
            </button>
          </div>
        </div>

        {/* Telemetry Bar */}
        <div className="flex items-center justify-around glass-panel py-2 px-4 rounded-xl border border-white/5 my-1 text-center">
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-mono">Speed</div>
            <div className="text-2xl font-display font-black text-cyan-300">
              {hostTelemetry.speedKmh} <span className="text-xs font-normal text-gray-400">KM/H</span>
            </div>
          </div>
          <div className="w-[1px] h-8 bg-white/10" />
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-mono">Gear</div>
            <div className="text-2xl font-display font-black text-amber-400">
              {hostTelemetry.gear}
            </div>
          </div>
          <div className="w-[1px] h-8 bg-white/10" />
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-mono">Steering</div>
            <div className="text-2xl font-display font-black text-purple-300">
              {Math.abs(angleDegrees)}°
            </div>
          </div>
        </div>

        {/* Steering Wheel Area (Center) */}
        <div className="flex-1 flex flex-col items-center justify-center my-1 relative">
          <PhysicalWheel
            angleDegrees={angleDegrees}
            speedKmh={hostTelemetry.speedKmh}
            gear={hostTelemetry.gear}
            rpm={hostTelemetry.rpm}
            size={245}
          />

          {/* Quick Actions (Camera, Reset, Nitro) */}
          <div className="w-full flex items-center justify-center space-x-2 mt-3 px-2">
            <button
              onClick={() => sendOneShotAction('cameraSwitch')}
              className="px-3 py-2 bg-white/10 active:bg-white/20 rounded-xl text-xs font-bold text-gray-300 uppercase tracking-wider border border-white/10"
            >
              CAMERA
            </button>
            <button
              onTouchStart={() => { setNitro(true); triggerHaptic(60); }}
              onTouchEnd={() => setNitro(false)}
              onMouseDown={() => setNitro(true)}
              onMouseUp={() => setNitro(false)}
              className={`flex-1 max-w-[150px] py-2.5 rounded-xl font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all transform active:scale-95 border ${
                nitro
                  ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-xl shadow-purple-500/60 border-cyan-300'
                  : 'bg-gradient-to-r from-purple-900/60 to-cyan-900/60 text-cyan-300 border-purple-500/40'
              }`}
            >
              <Flame className="w-4 h-4 text-cyan-300 animate-pulse" />
              <span>NITRO BOOST</span>
            </button>
            <button
              onClick={() => sendOneShotAction('reset')}
              className="px-3 py-2 bg-white/10 active:bg-rose-500/30 rounded-xl text-xs font-bold text-rose-300 uppercase tracking-wider border border-white/10"
            >
              RESET
            </button>
          </div>
        </div>

        {/* Bottom Pedals (Brake, Handbrake, Gas) */}
        <div className="flex items-center justify-between space-x-2 my-1 px-1">
          {/* Left: Brake Pedal */}
          <div
            ref={brakeContainerRef}
            onTouchStart={(e) => { handleBrakeTouch(e); triggerHaptic(20); }}
            onTouchMove={handleBrakeTouch}
            onTouchEnd={() => setBrake(0)}
            onMouseDown={(e) => { handleBrakeTouch(e); }}
            onMouseMove={(e) => e.buttons === 1 && handleBrakeTouch(e)}
            onMouseUp={() => setBrake(0)}
            className="flex-1 h-32 glass-panel rounded-2xl relative overflow-hidden flex flex-col justify-end p-1 border border-rose-500/40 cursor-pointer shadow-lg shadow-rose-950/40"
          >
            <div
              className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-xl transition-all duration-75"
              style={{ height: `${Math.round(brake * 100)}%` }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs uppercase font-black tracking-widest text-white drop-shadow">
                BRAKE
              </span>
              <span className="text-sm font-display font-bold text-rose-300">
                {Math.round(brake * 100)}%
              </span>
            </div>
          </div>

          {/* Center: Handbrake Button */}
          <button
            onTouchStart={() => { setHandbrake(true); triggerHaptic(45); }}
            onTouchEnd={() => setHandbrake(false)}
            onMouseDown={() => setHandbrake(true)}
            onMouseUp={() => setHandbrake(false)}
            className={`w-20 h-32 rounded-2xl font-display font-bold text-xs uppercase tracking-wider transition-all transform active:scale-95 border flex flex-col items-center justify-center ${
              handbrake
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/50 border-rose-300'
                : 'bg-white/10 text-gray-300 border-white/10'
            }`}
          >
            <span className="text-[10px] text-gray-400">DRIFT</span>
            <span className="font-black text-sm">HAND<br/>BRAKE</span>
          </button>

          {/* Right: Gas / Accel Pedal */}
          <div
            ref={throttleContainerRef}
            onTouchStart={(e) => { handleThrottleTouch(e); triggerHaptic(20); }}
            onTouchMove={handleThrottleTouch}
            onTouchEnd={() => setThrottle(0)}
            onMouseDown={(e) => { handleThrottleTouch(e); }}
            onMouseMove={(e) => e.buttons === 1 && handleThrottleTouch(e)}
            onMouseUp={() => setThrottle(0)}
            className="flex-1 h-32 glass-panel rounded-2xl relative overflow-hidden flex flex-col justify-end p-1 border border-cyan-500/40 cursor-pointer shadow-lg shadow-cyan-950/40"
          >
            <div
              className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-xl transition-all duration-75"
              style={{ height: `${Math.round(throttle * 100)}%` }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs uppercase font-black tracking-widest text-white drop-shadow">
                GAS
              </span>
              <span className="text-sm font-display font-bold text-cyan-200">
                {Math.round(throttle * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Footer Guidance */}
        <div className="flex items-center justify-between text-[10px] text-gray-400 px-2 py-0.5 font-mono">
          <span>PORTRAIT WHEEL</span>
          <span>TIP: ROTATE PHONE FOR 2-HAND COCKPIT</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#08090C] flex flex-col justify-between p-3 select-none overflow-hidden text-white font-racing">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between glass-panel px-4 py-2 rounded-xl border border-white/10">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-xs uppercase tracking-wider text-gray-300 font-bold">
              {isConnected ? `${ping}ms P2P` : 'CONNECTING...'}
            </span>
          </div>
          <button
            onClick={() => {
              const code = prompt('Enter Desktop Room Code:', currentRoomId);
              if (code && code.trim().length >= 4) {
                setCurrentRoomId(code.trim().toUpperCase());
              }
            }}
            className="text-[11px] text-cyan-300 font-mono bg-white/10 active:bg-cyan-500/30 px-2 py-0.5 rounded border border-white/10 hover:border-cyan-400"
          >
            ROOM: {currentRoomId}
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={recalibrate}
            className="flex items-center space-x-1 px-3 py-1 bg-white/10 active:bg-cyan-500/30 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Center</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 bg-white/10 active:bg-white/20 rounded-lg"
          >
            <Maximize className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      </div>

      {/* Main Cockpit Area */}
      <div className="flex-1 flex items-center justify-between my-2 relative px-2">
        {/* Left Hand: Brake Slider + Handbrake */}
        <div className="flex flex-col items-center justify-between h-full w-28 py-1">
          {/* Brake Slider */}
          <div
            ref={brakeContainerRef}
            onTouchStart={(e) => { handleBrakeTouch(e); triggerHaptic(20); }}
            onTouchMove={handleBrakeTouch}
            onTouchEnd={() => setBrake(0)}
            onMouseDown={(e) => { handleBrakeTouch(e); }}
            onMouseMove={(e) => e.buttons === 1 && handleBrakeTouch(e)}
            onMouseUp={() => setBrake(0)}
            className="w-20 h-40 glass-panel rounded-2xl relative overflow-hidden flex flex-col justify-end p-1 border border-rose-500/40 cursor-pointer shadow-lg shadow-rose-950/40"
          >
            <div
              className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-xl transition-all duration-75"
              style={{ height: `${Math.round(brake * 100)}%` }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs uppercase font-bold tracking-widest text-white/90 drop-shadow">
                BRAKE
              </span>
              <span className="text-lg font-display font-bold text-rose-300">
                {Math.round(brake * 100)}%
              </span>
            </div>
          </div>

          {/* Handbrake Button */}
          <button
            onTouchStart={() => { setHandbrake(true); triggerHaptic(45); }}
            onTouchEnd={() => setHandbrake(false)}
            onMouseDown={() => setHandbrake(true)}
            onMouseUp={() => setHandbrake(false)}
            className={`w-24 py-3 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-all transform active:scale-95 border ${
              handbrake
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/50 border-rose-300'
                : 'bg-white/10 text-gray-300 border-white/10'
            }`}
          >
            HANDBRAKE
          </button>
        </div>

        {/* Center: Physical Steering Wheel & Cockpit Telemetry */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <PhysicalWheel
            angleDegrees={angleDegrees}
            speedKmh={hostTelemetry.speedKmh}
            gear={hostTelemetry.gear}
            rpm={hostTelemetry.rpm}
            size={215}
          />

          {/* Quick Utility Actions */}
          <div className="flex items-center space-x-3 mt-2">
            <button
              onClick={() => sendOneShotAction('cameraSwitch')}
              className="px-3 py-1 bg-white/10 active:bg-white/20 rounded-lg text-xs font-bold text-gray-300 uppercase tracking-wider"
            >
              CAMERA (C)
            </button>
            <button
              onClick={() => sendOneShotAction('reset')}
              className="px-3 py-1 bg-white/10 active:bg-rose-500/30 rounded-lg text-xs font-bold text-rose-300 uppercase tracking-wider"
            >
              RESET (R)
            </button>
          </div>
        </div>

        {/* Right Hand: Throttle Slider + Nitro Burst */}
        <div className="flex flex-col items-center justify-between h-full w-28 py-1">
          {/* Gas Slider */}
          <div
            ref={throttleContainerRef}
            onTouchStart={(e) => { handleThrottleTouch(e); triggerHaptic(20); }}
            onTouchMove={handleThrottleTouch}
            onTouchEnd={() => setThrottle(0)}
            onMouseDown={(e) => { handleThrottleTouch(e); }}
            onMouseMove={(e) => e.buttons === 1 && handleThrottleTouch(e)}
            onMouseUp={() => setThrottle(0)}
            className="w-20 h-40 glass-panel rounded-2xl relative overflow-hidden flex flex-col justify-end p-1 border border-cyan-500/40 cursor-pointer shadow-lg shadow-cyan-950/40"
          >
            <div
              className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-xl transition-all duration-75"
              style={{ height: `${Math.round(throttle * 100)}%` }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs uppercase font-bold tracking-widest text-white/90 drop-shadow">
                GAS
              </span>
              <span className="text-lg font-display font-bold text-cyan-200">
                {Math.round(throttle * 100)}%
              </span>
            </div>
          </div>

          {/* Nitro Button */}
          <button
            onTouchStart={() => { setNitro(true); triggerHaptic(60); }}
            onTouchEnd={() => setNitro(false)}
            onMouseDown={() => setNitro(true)}
            onMouseUp={() => setNitro(false)}
            className={`w-24 py-3 rounded-xl font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-1 transition-all transform active:scale-95 border ${
              nitro
                ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-xl shadow-purple-500/60 border-cyan-300'
                : 'bg-gradient-to-r from-purple-900/60 to-cyan-900/60 text-cyan-300 border-purple-500/40'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
            <span>NITRO</span>
          </button>
        </div>
      </div>

      {/* Footer Status */}
      <div className="flex items-center justify-between text-[10px] text-gray-500 px-2 font-mono">
        <span>GYRO: {wakeLockActive ? 'WAKELOCK ON' : 'READY'}</span>
        <span>STEER NORM: {steerNormalized.toFixed(2)}</span>
      </div>
    </div>
  );
};
