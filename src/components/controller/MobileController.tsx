import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';
import { WebRTCController } from '../../services/webrtc';
import { ControllerInput } from '../../types';
import { RotateCcw, Zap, Flame, ShieldAlert, Wifi, Maximize, Compass } from 'lucide-react';

interface MobileControllerProps {
  roomId: string;
}

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
    const ctrl = new WebRTCController(roomId);
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
  }, [roomId]);

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

  // Landscape enforcement notice
  if (!isLandscape) {
    return (
      <div className="fixed inset-0 bg-[#08090C] z-50 flex flex-col items-center justify-center p-6 text-center">
        <RotateCcw className="w-16 h-16 text-cyan-400 animate-spin mb-4" />
        <h2 className="text-2xl font-bold font-display uppercase tracking-wider text-white mb-2">
          Rotate Device
        </h2>
        <p className="text-gray-400 text-sm max-w-xs">
          Apex Drift steering wheel operates in Landscape mode. Turn your phone horizontally to start driving.
        </p>
      </div>
    );
  }

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
          <span className="text-xs text-gray-500 font-mono">ROOM: {roomId}</span>
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

        {/* Center: Dynamic Gyro Telemetry Ring & Angle HUD */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Gyro Wheel HUD Ring */}
          <div className="relative w-44 h-44 flex items-center justify-center">
            {/* Outer Rotating Steering Marker */}
            <div
              className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-400/40 transition-transform duration-75"
              style={{ transform: `rotate(${angleDegrees}deg)` }}
            >
              <div className="w-3 h-3 bg-cyan-400 rounded-full mx-auto -mt-1.5 shadow-lg shadow-cyan-400/80" />
            </div>

            {/* Inner Telemetry Display */}
            <div className="w-36 h-36 glass-panel rounded-full flex flex-col items-center justify-center border border-white/20 p-2 text-center shadow-inner">
              <span className="text-gray-400 text-[10px] uppercase font-bold tracking-widest">
                STEER ANGLE
              </span>
              <div className="text-3xl font-display font-bold text-cyan-300 my-0.5">
                {Math.abs(angleDegrees)}°
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
                {angleDegrees === 0 ? 'CENTER' : angleDegrees > 0 ? 'RIGHT' : 'LEFT'}
              </span>

              {/* Host Telemetry Reflection */}
              <div className="mt-1 pt-1 border-t border-white/10 flex items-center space-x-3 text-xs">
                <span className="text-white font-bold">{hostTelemetry.speedKmh} KM/H</span>
                <span className="text-amber-400 font-bold">G {hostTelemetry.gear}</span>
              </div>
            </div>
          </div>

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
