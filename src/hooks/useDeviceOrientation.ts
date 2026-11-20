import { useState, useEffect, useRef, useCallback } from 'react';

export interface GyroData {
  steerNormalized: number; // -1.0 to 1.0
  angleDegrees: number;    // Display angle in degrees
  isPermissionGranted: boolean;
  needsPermissionPrompt: boolean;
  isLandscape: boolean;
  wakeLockActive: boolean;
}

export function useDeviceOrientation() {
  const [isPermissionGranted, setIsPermissionGranted] = useState<boolean>(false);
  const [needsPermissionPrompt, setNeedsPermissionPrompt] = useState<boolean>(false);
  const [angleDegrees, setAngleDegrees] = useState<number>(0);
  const [steerNormalized, setSteerNormalized] = useState<number>(0);
  const [isLandscape, setIsLandscape] = useState<boolean>(true);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);

  const offsetAngleRef = useRef<number>(0);
  const filteredAngleRef = useRef<number>(0);
  const wakeLockRef = useRef<any>(null);

  // Check if iOS permission is required
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      typeof (window as any).DeviceOrientationEvent !== 'undefined' &&
      typeof (window as any).DeviceOrientationEvent.requestPermission === 'function'
    ) {
      setNeedsPermissionPrompt(true);
    } else {
      // Android and desktops don't require explicit prompt button
      setIsPermissionGranted(true);
    }
  }, []);

  // Screen Wake Lock API
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        setWakeLockActive(true);
        wakeLockRef.current.addEventListener('release', () => {
          setWakeLockActive(false);
        });
      }
    } catch (err) {
      console.warn('[WakeLock] Error:', err);
    }
  }, []);

  // Request permission explicitly on iOS
  const requestPermission = useCallback(async () => {
    try {
      if (
        typeof (window as any).DeviceOrientationEvent !== 'undefined' &&
        typeof (window as any).DeviceOrientationEvent.requestPermission === 'function'
      ) {
        const response = await (window as any).DeviceOrientationEvent.requestPermission();
        if (response === 'granted') {
          setIsPermissionGranted(true);
          setNeedsPermissionPrompt(false);
          await requestWakeLock();
          return true;
        }
      } else {
        setIsPermissionGranted(true);
        setNeedsPermissionPrompt(false);
        await requestWakeLock();
        return true;
      }
    } catch (e) {
      console.error('[DeviceOrientation] Permission error:', e);
    }
    return false;
  }, [requestWakeLock]);

  // Recalibrate neutral steering angle
  const recalibrate = useCallback(() => {
    offsetAngleRef.current = filteredAngleRef.current;
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  }, []);

  // Check screen orientation
  useEffect(() => {
    const handleOrientationChange = () => {
      const isLand = window.innerWidth > window.innerHeight;
      setIsLandscape(isLand);
    };

    handleOrientationChange();
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  // Device orientation event listener
  useEffect(() => {
    if (!isPermissionGranted) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const isLand = window.innerWidth > window.innerHeight;
      let rawAngle = 0;

      if (isLand) {
        const orientation = window.screen.orientation?.angle ?? (window.orientation as number) ?? 90;
        if (orientation === -90 || orientation === 270) {
          rawAngle = event.beta ?? 0;
        } else {
          rawAngle = -(event.beta ?? 0);
        }
      } else {
        // Portrait mode steering: gamma (-90 to +90 degrees tilt)
        rawAngle = event.gamma ?? 0;
      }

      // 1. Exponential Moving Average (EMA) Low-Pass Filter (alpha = 0.35)
      const alpha = 0.35;
      const prevFiltered = filteredAngleRef.current;
      const filtered = alpha * rawAngle + (1 - alpha) * prevFiltered;
      filteredAngleRef.current = filtered;

      // 2. Apply Zero-Calibration offset
      const calibratedAngle = filtered - offsetAngleRef.current;

      // 3. Clamp between -90 and +90 degrees
      const clampedAngle = Math.max(-90, Math.min(90, calibratedAngle));

      // 4. Deadzone (2.5 degrees) and Non-linear Exponential Curve
      const deadzone = 2.5;
      const absAngle = Math.abs(clampedAngle);
      let normalized = 0;

      if (absAngle > deadzone) {
        const ratio = (absAngle - deadzone) / (90 - deadzone);
        const curved = Math.pow(ratio, 1.35); // Slight curve for fine highway control
        normalized = Math.sign(clampedAngle) * curved;
      }

      setAngleDegrees(Math.round(clampedAngle));
      setSteerNormalized(Math.max(-1, Math.min(1, normalized)));
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [isPermissionGranted]);

  return {
    steerNormalized,
    angleDegrees,
    isPermissionGranted,
    needsPermissionPrompt,
    isLandscape,
    wakeLockActive,
    requestPermission,
    recalibrate
  };
}
