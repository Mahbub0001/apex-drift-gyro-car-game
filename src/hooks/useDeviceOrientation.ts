import { useState, useEffect, useRef, useCallback } from 'react';

const radToDeg = (rad: number) => (rad * 180) / Math.PI;
const degToRad = (deg: number) => (deg * Math.PI) / 180;

// Wrap difference between two degree angles strictly into [-180, 180]
function unwrapAngleDiffDeg(angle: number, offset: number): number {
  let diff = angle - offset;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

export interface GyroData {
  steerNormalized: number; // -1.0 to 1.0
  angleDegrees: number;    // Display angle in degrees (-105 to +105)
  isPermissionGranted: boolean;
  needsPermissionPrompt: boolean;
  isLandscape: boolean;
  wakeLockActive: boolean;
  hasSensorSignal: boolean;
  isSecureContext: boolean;
  sensitivity: number;
}

export function useDeviceOrientation(
  initialSensitivity: number = 1.2,
  forceLandscape: boolean = false
) {
  const [isPermissionGranted, setIsPermissionGranted] = useState<boolean>(false);
  const [needsPermissionPrompt, setNeedsPermissionPrompt] = useState<boolean>(false);
  const [angleDegrees, setAngleDegrees] = useState<number>(0);
  const [steerNormalized, setSteerNormalized] = useState<number>(0);
  const [isLandscape, setIsLandscape] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : true
  );
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [hasSensorSignal, setHasSensorSignal] = useState<boolean>(false);
  const [sensitivity, setSensitivityState] = useState<number>(initialSensitivity);

  const offsetAngleRef = useRef<number>(0);
  const hasAutoZeroedRef = useRef<boolean>(false);
  const filteredAngleRef = useRef<number>(0);
  const wakeLockRef = useRef<any>(null);
  const lastCenterTickRef = useRef<number>(0);
  const prevSignRef = useRef<number>(0);
  const hasMotionSupportRef = useRef<boolean>(false);
  const sensorActiveRef = useRef<boolean>(false);
  const sensitivityRef = useRef<number>(initialSensitivity);
  const forceLandscapeRef = useRef<boolean>(forceLandscape);

  const isSecureContextVal = typeof window !== 'undefined' ? window.isSecureContext : true;

  useEffect(() => {
    sensitivityRef.current = initialSensitivity;
    setSensitivityState(initialSensitivity);
  }, [initialSensitivity]);

  useEffect(() => {
    forceLandscapeRef.current = forceLandscape;
    // Reset auto-calibration whenever CSS forced horizontal mode toggles
    hasAutoZeroedRef.current = false;
  }, [forceLandscape]);

  const setSensitivity = useCallback((val: number) => {
    const clamped = Math.max(0.6, Math.min(2.2, Number(val.toFixed(2))));
    sensitivityRef.current = clamped;
    setSensitivityState(clamped);
  }, []);

  // Check if iOS 13+ Motion/Orientation permission prompt is required
  useEffect(() => {
    const needsOrientPerm =
      typeof window !== 'undefined' &&
      typeof (window as any).DeviceOrientationEvent?.requestPermission === 'function';
    const needsMotionPerm =
      typeof window !== 'undefined' &&
      typeof (window as any).DeviceMotionEvent?.requestPermission === 'function';

    if (needsOrientPerm || needsMotionPerm) {
      setNeedsPermissionPrompt(true);
    } else {
      setIsPermissionGranted(true);
    }
  }, []);

  // Screen Wake Lock API (keeps screen awake during extended drives)
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        setWakeLockActive(true);
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
          setWakeLockActive(false);
        });
      }
    } catch (_) {
      // Fail quietly if battery saver or insecure HTTP blocks wakeLock
    }
  }, []);

  // Request permission explicitly inside user gesture (BOTH Orientation & Motion for iOS 13–18!)
  const requestPermission = useCallback(async () => {
    try {
      const promises: Promise<string>[] = [];
      if (typeof (window as any).DeviceOrientationEvent?.requestPermission === 'function') {
        promises.push((window as any).DeviceOrientationEvent.requestPermission());
      }
      if (typeof (window as any).DeviceMotionEvent?.requestPermission === 'function') {
        promises.push((window as any).DeviceMotionEvent.requestPermission());
      }

      let granted = false;
      if (promises.length > 0) {
        const results = await Promise.all(promises.map((p) => p.catch(() => 'denied')));
        granted = results.some((r) => r === 'granted');
      } else {
        granted = true;
      }

      if (granted) {
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
    hasAutoZeroedRef.current = true;
    prevSignRef.current = 0;
    setAngleDegrees(0);
    setSteerNormalized(0);
    if ('vibrate' in navigator) {
      navigator.vibrate([25, 40, 25]);
    }
  }, []);

  // Check screen orientation dynamically
  useEffect(() => {
    const handleOrientationChange = () => {
      const isLand = window.innerWidth > window.innerHeight;
      setIsLandscape(isLand);
      hasAutoZeroedRef.current = false;
    };

    handleOrientationChange();
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  // Dedicated Sensor Processing: ZERO listener churn
  useEffect(() => {
    if (!isPermissionGranted) return;

    const isIOS =
      typeof navigator !== 'undefined' &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    const markSensorActive = () => {
      if (!sensorActiveRef.current) {
        sensorActiveRef.current = true;
        setHasSensorSignal(true);
      }
    };

    const processRawAngle = (rawAngle: number) => {
      if (!Number.isFinite(rawAngle)) return;

      if (!hasAutoZeroedRef.current) {
        filteredAngleRef.current = rawAngle;
        offsetAngleRef.current = 0;
        hasAutoZeroedRef.current = true;
      }

      const prevFiltered = filteredAngleRef.current;
      const stepDiff = unwrapAngleDiffDeg(rawAngle, prevFiltered);
      const alpha = Math.abs(stepDiff) > 2.2 ? 0.84 : 0.48;

      const filtered = prevFiltered + alpha * stepDiff;
      filteredAngleRef.current = filtered;

      const deltaFromCenter = unwrapAngleDiffDeg(filtered, offsetAngleRef.current);
      const calibratedAngle = deltaFromCenter * sensitivityRef.current;
      const clampedAngle = Math.max(-105, Math.min(105, calibratedAngle));

      const currentSign = Math.abs(clampedAngle) < 2 ? 0 : Math.sign(clampedAngle);
      const prevSign = prevSignRef.current;
      const now = performance.now();
      if (
        prevSign !== 0 &&
        currentSign !== 0 &&
        prevSign !== currentSign &&
        now - lastCenterTickRef.current > 180
      ) {
        lastCenterTickRef.current = now;
        if ('vibrate' in navigator) {
          navigator.vibrate(10);
        }
      }
      if (currentSign !== 0) {
        prevSignRef.current = currentSign;
      }

      const deadzone = 1.5;
      const absAngle = Math.abs(clampedAngle);
      let normalized = 0;

      if (absAngle > deadzone) {
        const ratio = (absAngle - deadzone) / (75 - deadzone);
        const curved = Math.pow(Math.min(1.0, ratio), 1.15);
        normalized = Math.sign(clampedAngle) * curved;
      }

      setAngleDegrees(Math.round(clampedAngle));
      setSteerNormalized(Math.max(-1, Math.min(1, Number(normalized.toFixed(3)))));
    };

    const computeAngleFromUpVector = (vx: number, vy: number, vz: number, minBase: number): number => {
      const nativeLand = window.innerWidth > window.innerHeight;
      const isForcedHorizontal = forceLandscapeRef.current && !nativeLand;
      const effectiveLand = nativeLand || isForcedHorizontal;

      const orientation = isForcedHorizontal
        ? 90
        : window.screen?.orientation?.angle ??
          ((window as any).orientation as number | undefined) ??
          (nativeLand ? 90 : 0);

      if (effectiveLand) {
        const upMag = Math.max(minBase, Math.hypot(vx, vz));
        if (orientation === -90 || orientation === 270) {
          // Landscape Right (camera in right hand): clockwise right turn drops +Y -> vy < 0 -> -vy > 0
          return radToDeg(Math.atan2(-vy, upMag));
        }
        // Landscape Left (camera in left hand, 90° default): clockwise right turn lifts +Y -> vy > 0
        return radToDeg(Math.atan2(vy, upMag));
      }

      // Portrait Mode: clockwise right turn drops +X right side -> vx < 0 -> -vx > 0
      const upMag = Math.max(minBase, Math.hypot(vy, vz));
      return radToDeg(Math.atan2(-vx, upMag));
    };

    // High-frequency accelerometer gravity vector
    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x === null || acc.y === null) return;

      const signFix = isIOS ? -1 : 1;
      const ax = (acc.x ?? 0) * signFix;
      const ay = (acc.y ?? 0) * signFix;
      const az = (acc.z ?? 0) * signFix;

      // Ignore empty all-zero motion readings so deviceorientation fallback still works!
      if (Math.hypot(ax, ay, az) < 1.5) return;

      hasMotionSupportRef.current = true;
      markSensorActive();

      processRawAngle(computeAngleFromUpVector(ax, ay, az, 2.0));
    };

    // Gimbal-lock-free Euler-to-Up-Vector fallback (matches devicemotion axes identically)
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (hasMotionSupportRef.current) return;
      if (event.beta === null && event.gamma === null) return;

      const betaDeg = event.beta ?? 0;
      const gammaDeg = event.gamma ?? 0;
      if (betaDeg === 0 && gammaDeg === 0 && event.alpha === null) return;

      markSensorActive();

      const betaRad = degToRad(betaDeg);
      const gammaRad = degToRad(gammaDeg);
      const gx = -Math.sin(gammaRad) * Math.cos(betaRad);
      const gy = Math.sin(betaRad);
      const gz = Math.cos(gammaRad) * Math.cos(betaRad);

      processRawAngle(computeAngleFromUpVector(gx, gy, gz, 0.2));
    };

    window.addEventListener('devicemotion', handleMotion);
    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
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
    hasSensorSignal,
    isSecureContext: isSecureContextVal,
    sensitivity,
    setSensitivity,
    requestPermission,
    recalibrate
  };
}
