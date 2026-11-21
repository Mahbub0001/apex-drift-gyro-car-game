import { useState, useEffect, useRef, useCallback } from 'react';

const radToDeg = (rad: number) => (rad * 180) / Math.PI;
const degToRad = (deg: number) => (deg * Math.PI) / 180;

export interface GyroData {
  steerNormalized: number; // -1.0 to 1.0
  angleDegrees: number;    // Display angle in degrees (-110 to +110)
  isPermissionGranted: boolean;
  needsPermissionPrompt: boolean;
  isLandscape: boolean;
  wakeLockActive: boolean;
  sensitivity: number;
}

export function useDeviceOrientation() {
  const [isPermissionGranted, setIsPermissionGranted] = useState<boolean>(false);
  const [needsPermissionPrompt, setNeedsPermissionPrompt] = useState<boolean>(false);
  const [angleDegrees, setAngleDegrees] = useState<number>(0);
  const [steerNormalized, setSteerNormalized] = useState<number>(0);
  const [isLandscape, setIsLandscape] = useState<boolean>(true);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [sensitivity, setSensitivity] = useState<number>(1.2); // Tuned for authentic GT3 / NFS supercar handling

  const offsetAngleRef = useRef<number>(0);
  const filteredAngleRef = useRef<number>(0);
  const wakeLockRef = useRef<any>(null);
  const lastCenterTickRef = useRef<number>(0);
  const hasMotionSupportRef = useRef<boolean>(false);

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

  // Recalibrate neutral steering angle to current phone posture
  const recalibrate = useCallback(() => {
    offsetAngleRef.current = filteredAngleRef.current;
    if ('vibrate' in navigator) {
      navigator.vibrate([25, 40, 25]);
    }
  }, []);

  // Check screen orientation dynamically
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

  // Dedicated Sensor Processing: High-frequency devicemotion with fallback
  useEffect(() => {
    if (!isPermissionGranted) return;

    // Fast-path accelerometer gravity vector (handles any hand holding angle from 15° to 90°)
    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x === null || acc.y === null) return;

      hasMotionSupportRef.current = true;

      const isLand = window.innerWidth > window.innerHeight;
      const orientation =
        window.screen?.orientation?.angle ??
        (window.orientation as number) ??
        (isLand ? 90 : 0);

      const ax = acc.x;
      const ay = acc.y;
      let rawAngle = 0;

      if (isLand) {
        if (orientation === 90) {
          // Standard Landscape Left (phone rotated counter-clockwise):
          // Horizontal axis between hands is Y. Vertical axis is X (downwards is -X).
          // Turning right (clockwise) moves right hand down (-Y towards Earth, so ay < 0, -ay > 0).
          rawAngle = radToDeg(Math.atan2(-ay, -ax));
        } else if (orientation === -90 || orientation === 270) {
          // Landscape Right (phone rotated clockwise):
          // Downwards is +X. Turning right moves right hand down (+Y towards Earth, so ay > 0).
          rawAngle = radToDeg(Math.atan2(ay, ax));
        } else {
          // Generic Landscape fallback
          rawAngle = radToDeg(Math.atan2(-ay, -ax));
        }
      } else {
        // Portrait Mode:
        // Downwards is -Y. Turning right tilts phone clockwise (+X towards Earth, so ax > 0).
        rawAngle = radToDeg(Math.atan2(ax, -ay));
      }

      processRawAngle(rawAngle);
    };

    // Fallback Euler angle orientation listener (ONLY used if devicemotion is unsupported)
    const handleOrientation = (event: DeviceOrientationEvent) => {
      // If devicemotion is actively supplying hardware data, skip to prevent sensor fighting
      if (hasMotionSupportRef.current) return;
      if (event.beta === null && event.gamma === null) return;

      const isLand = window.innerWidth > window.innerHeight;
      const orientation =
        window.screen?.orientation?.angle ??
        (window.orientation as number) ??
        (isLand ? 90 : 0);

      let rawAngle = 0;
      const betaRad = degToRad(event.beta ?? 0);
      const gammaRad = degToRad(event.gamma ?? 0);

      if (isLand) {
        if (orientation === -90 || orientation === 270) {
          rawAngle = radToDeg(Math.atan2(-Math.sin(betaRad), Math.sin(gammaRad)));
        } else {
          rawAngle = radToDeg(Math.atan2(Math.sin(betaRad), Math.sin(gammaRad)));
        }
      } else {
        rawAngle = radToDeg(Math.atan2(Math.sin(gammaRad), Math.cos(betaRad)));
      }

      processRawAngle(rawAngle);
    };

    const processRawAngle = (rawAngle: number) => {
      if (isNaN(rawAngle)) return;

      // 1. Adaptive Exponential Moving Average (EMA) Low-Pass Filter:
      // High responsiveness for fast flicks (alpha = 0.82), smooth damping for micro-tremors (alpha = 0.48)
      const prevFiltered = filteredAngleRef.current;
      const deltaAngle = Math.abs(rawAngle - prevFiltered);
      const alpha = deltaAngle > 2.2 ? 0.84 : 0.48;

      const filtered = alpha * rawAngle + (1 - alpha) * prevFiltered;
      filteredAngleRef.current = filtered;

      // 2. Apply Zero-Calibration offset
      const calibratedAngle = (filtered - offsetAngleRef.current) * sensitivity;

      // 3. Clamp between -105 and +105 degrees (broad rotation for authentic supercar wheel feel)
      const clampedAngle = Math.max(-105, Math.min(105, calibratedAngle));

      // 4. Center Crossing Haptic Feedback Tick
      const prevSign = Math.sign(angleDegrees);
      const currentSign = Math.sign(Math.round(clampedAngle));
      const now = performance.now();
      if (
        prevSign !== 0 &&
        currentSign !== 0 &&
        prevSign !== currentSign &&
        now - lastCenterTickRef.current > 180
      ) {
        lastCenterTickRef.current = now;
        if ('vibrate' in navigator) {
          navigator.vibrate(12); // Subtle mechanical center notch tick
        }
      }

      // 5. Razor-Sharp Deadzone (1.2 degrees) and Progressive Steering Curve
      const deadzone = 1.2;
      const absAngle = Math.abs(clampedAngle);
      let normalized = 0;

      if (absAngle > deadzone) {
        const ratio = (absAngle - deadzone) / (90 - deadzone);
        const curved = Math.pow(Math.min(1.25, ratio), 1.18); // Dynamic progressive curve for razor precision
        normalized = Math.sign(clampedAngle) * Math.min(1.0, curved);
      }

      setAngleDegrees(Math.round(clampedAngle));
      setSteerNormalized(Math.max(-1, Math.min(1, Number(normalized.toFixed(3)))));
    };

    window.addEventListener('devicemotion', handleMotion);
    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [isPermissionGranted, sensitivity, angleDegrees]);

  return {
    steerNormalized,
    angleDegrees,
    isPermissionGranted,
    needsPermissionPrompt,
    isLandscape,
    wakeLockActive,
    sensitivity,
    setSensitivity,
    requestPermission,
    recalibrate
  };
}
