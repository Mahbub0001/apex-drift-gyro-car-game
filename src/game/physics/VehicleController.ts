import * as THREE from 'three';
import {
  ControllerInput,
  VehicleTelemetry,
  SuperCarConfig,
  SUPER_CARS,
  TransmissionMode
} from '../../types';
import { loadStoredRecords, saveBestLapRecord, saveBestScoreRecord } from '../../utils/records';

const GEAR_ORDER: (number | 'R' | 'N')[] = ['R', 'N', 1, 2, 3, 4, 5, 6];

function normalizeAngle(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function shortestAngleDiff(from: number, to: number): number {
  return normalizeAngle(to - from);
}

export class VehiclePhysics {
  public position: THREE.Vector3 = new THREE.Vector3(0, 0.64, 10);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public rotation: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
  public quaternion: THREE.Quaternion = new THREE.Quaternion();

  // Telemetry & States (Switchable 6-Speed Automatic DCT or Sequential Manual!)
  public transmissionMode: TransmissionMode = 'auto';
  public speedKmh: number = 0;
  public rpm: number = 850;
  public gear: number | string = 1; // Starts in Gear 1 ready for launch
  public nitroFuel: number = 100;
  public isDrifting: boolean = false;
  public driftAngle: number = 0;
  public driftScore: number = 0;
  public totalScore: number = 0;
  public lastBankedDrift: number = 0;
  private lastBankTimer: number = 0;
  public didJustBankDrift: boolean = false;

  public driftYawAngle: number = 0;
  private driftTimer: number = 0;
  public isAirborne: boolean = false;
  public isJumping: boolean = false;
  public didJustLand: boolean = false;
  public lastLandingStrength: number = 0;
  public jumpAirTimer: number = 0;
  private prevAirborne: boolean = false;
  private airbornePeakVel: number = 0;
  public health: number = 100;

  // Lap & Wrong-Way Telemetry
  public lap: number = 1;
  public lapTimeMs: number = 0;
  public raceTimeMs: number = 0;
  public bestLapTimeMs: number | null = null;
  public didCompleteLap: boolean = false;
  public lastCompletedLapMs: number = 0;
  public didSetBestLap: boolean = false;
  private newBestLapBannerTimer: number = 0;
  public trackProgress: number = 0;
  public isWrongWay: boolean = false;
  private prevSplineT: number = 0.001;
  private passedMidpoint: boolean = false;
  private wrongWayTimer: number = 0;

  // Supercar Performance Specs (Driven by selected SuperCarConfig)
  public carConfigId: string = SUPER_CARS[0].id;
  public maxSpeedKmh: number = 310;
  public maxNitroSpeedKmh: number = 345;
  public accelerationRate: number = 7.4;
  public handlingScore: number = 9.6;
  public driftFactor: number = 1.6;
  public nitroMultiplier: number = 1.8;

  public brakingRate: number = 22.0;
  public naturalFriction: number = 2.4;
  public aeroDragCoeff: number = 0.00075;

  // Internal Dynamics
  private headingAngle: number = 0;
  private currentSteerAngle: number = 0;
  private verticalVelocity: number = 0;
  private groundHeight: number = 0;
  private smoothedRoadPitch: number = 0;
  private lateralSlipVelocity: number = 0;
  private smoothedThrottle: number = 0;
  private neutralFreeRev: number = 850;
  private prevCountdownLocked: boolean = false;
  private manualUpshiftHoldTimer: number = 0;
  private autoShiftCooldown: number = 0;
  private autoReverseHoldTimer: number = 0;
  private manualIdleTimer: number = 0;
  public didAutoShiftDown: boolean = false;
  public didAutoShiftUp: boolean = false;

  // Collision state
  public hadBarrierCollision: boolean = false;

  constructor(
    initialPosition: THREE.Vector3 = new THREE.Vector3(0, 0.64, 10),
    carConfig: SuperCarConfig = SUPER_CARS[0],
    transmissionMode: TransmissionMode = 'auto'
  ) {
    this.position.copy(initialPosition);
    this.transmissionMode = transmissionMode;
    this.bestLapTimeMs = loadStoredRecords().bestLapMs;
    this.applyCarConfig(carConfig);
  }

  public setTransmissionMode(mode: TransmissionMode) {
    this.transmissionMode = mode;
    if (mode === 'auto' && this.gear === 'N') {
      this.gear = 1;
    }
  }

  public applyCarConfig(config: SuperCarConfig) {
    this.carConfigId = config.id;
    this.maxSpeedKmh = config.topSpeedKmh;
    this.accelerationRate = config.accelerationRate;
    this.handlingScore = config.handlingScore;
    this.driftFactor = config.driftFactor;
    this.nitroMultiplier = config.nitroMultiplier;
    this.maxNitroSpeedKmh = config.topSpeedKmh + Math.round(20 * config.nitroMultiplier);
  }

  // Manual Upshift: R -> N -> 1 -> 2 -> 3 -> 4 -> 5 -> 6
  public shiftUp(): boolean {
    const idx = GEAR_ORDER.indexOf(this.gear as any);
    if (idx >= 0 && idx < GEAR_ORDER.length - 1) {
      const nextGear = GEAR_ORDER[idx + 1];
      this.gear = nextGear;
      // Hold newly selected upshift gear briefly unless braking so early shifts don't immediately fight acceleration
      if (typeof nextGear === 'number' && nextGear > 1) {
        this.manualUpshiftHoldTimer = 1.6;
      }
      return true;
    }
    return false;
  }

  // Optional Manual Downshift / Reverse Selector: 6 -> ... -> 1 -> N -> R
  public shiftDown(): boolean {
    const idx = GEAR_ORDER.indexOf(this.gear as any);
    if (idx > 0) {
      this.gear = GEAR_ORDER[idx - 1];
      return true;
    }
    return false;
  }

  // Speed threshold (km/h) below which a forward gear (2..6) automatically downshifts
  private getGearDownshiftSpeedKmh(gearNum: number): number {
    const scale = this.maxSpeedKmh / 310;
    const thresholds = [0, 38, 82, 128, 176, 224];
    const idx = Math.max(0, Math.min(5, gearNum - 1));
    return thresholds[idx] * scale;
  }

  // Get calibrated max speed (km/h) for a specific forward gear (1..6)
  private getGearTopSpeedKmh(gearNum: number): number {
    const scale = this.maxSpeedKmh / 310;
    const baseCaps = [66, 118, 172, 226, 282, 310];
    const idx = Math.max(0, Math.min(5, gearNum - 1));
    if (gearNum === 6) return this.maxSpeedKmh;
    return baseCaps[idx] * scale;
  }

  public update(
    delta: number,
    input: ControllerInput,
    roadElevationFunc?: (x: number, z: number) => number,
    closestPointFunc?: (x: number, z: number) => { point: THREE.Vector3; tangent: THREE.Vector3; dist: number; t: number },
    isCountdownLocked: boolean = false
  ): VehicleTelemetry {
    this.hadBarrierCollision = false;
    this.didJustBankDrift = false;
    this.didAutoShiftDown = false;
    this.didAutoShiftUp = false;
    this.didJustLand = false;
    this.didCompleteLap = false;
    this.didSetBestLap = false;

    if (this.manualUpshiftHoldTimer > 0) {
      this.manualUpshiftHoldTimer = Math.max(0, this.manualUpshiftHoldTimer - delta);
    }
    if (this.autoShiftCooldown > 0) {
      this.autoShiftCooldown = Math.max(0, this.autoShiftCooldown - delta);
    }
    if (this.newBestLapBannerTimer > 0) {
      this.newBestLapBannerTimer = Math.max(0, this.newBestLapBannerTimer - delta);
    }

    if (this.lastBankTimer > 0) {
      this.lastBankTimer -= delta;
      if (this.lastBankTimer <= 0) {
        this.lastBankedDrift = 0;
      }
    }

    // 1. Terrain Ground Height
    this.groundHeight = roadElevationFunc ? roadElevationFunc(this.position.x, this.position.z) : 0;
    const targetSuspensionY = this.groundHeight + 0.42;

    // 2. Starting Grid Countdown Neutral Hold (supports free engine revving!)
    if (isCountdownLocked) {
      this.prevCountdownLocked = true;
      this.velocity.set(0, 0, 0);
      this.speedKmh = 0;
      this.smoothedThrottle = THREE.MathUtils.lerp(this.smoothedThrottle, input.throttle, Math.min(1, delta * 9.0));
      const targetRev = THREE.MathUtils.lerp(900, 8250, this.smoothedThrottle);
      this.rpm += (targetRev - this.rpm) * Math.min(1, delta * 10.0);

      const revSquat = -this.smoothedThrottle * 0.02;
      this.position.y = targetSuspensionY;
      this.rotation.set(
        revSquat,
        this.headingAngle,
        Math.sin(performance.now() * 0.05) * 0.004 * this.smoothedThrottle,
        'YXZ'
      );
      this.quaternion.setFromEuler(this.rotation);

      return {
        speedKmh: 0,
        rpm: Math.round(this.rpm),
        gear: 'N',
        transmissionMode: this.transmissionMode,
        nitroFuel: Math.round(this.nitroFuel),
        isDrifting: false,
        driftScore: 0,
        totalScore: this.totalScore,
        lastBankedDrift: this.lastBankedDrift,
        isAirborne: false,
        isJumping: false,
        didJustLand: false,
        isNewBestLap: false,
        health: Math.max(0, Math.round(this.health)),
        lap: this.lap,
        lapTimeMs: 0,
        raceTimeMs: 0,
        bestLapTimeMs: this.bestLapTimeMs,
        trackProgress: this.trackProgress,
        isWrongWay: false,
        shouldShiftUp: false
      };
    }

    // Drop cleanly into 1st Gear on "GO!" if still in Neutral from launch countdown
    if (this.prevCountdownLocked) {
      this.prevCountdownLocked = false;
      if (this.gear === 'N') {
        this.gear = 1;
      }
    }

    // Advance Lap & Total Race Stopwatches
    this.lapTimeMs += delta * 1000;
    this.raceTimeMs += delta * 1000;

    // 3. Nitro Management (Scaled per vehicle nitroMultiplier)
    const canFireNitro = input.nitro && this.nitroFuel > 0 && input.throttle > 0.05 && typeof this.gear === 'number';
    let nitroThrust = 0;
    if (canFireNitro) {
      nitroThrust = 3.6 * this.nitroMultiplier;
      this.nitroFuel = Math.max(0, this.nitroFuel - delta * 19);
    } else {
      this.nitroFuel = Math.min(100, this.nitroFuel + delta * 3.8);
    }

    // 4. Dual-Mode (Auto 6-Speed DCT / Manual Sequential) Gearbox Torque, Braking & Reverse
    let forwardSpeed = this.velocity.z;
    const isBrakeDriftCombo =
      input.brake > 0.2 && input.throttle > 0.2 && Math.abs(input.steer) > 0.25 && this.speedKmh > 38;

    const gearTorques = [1.42, 1.18, 1.0, 0.86, 0.74, 0.65];

    // Automatic transmission seamless Stop-to-Reverse & Reverse-to-Drive handling
    if (this.transmissionMode === 'auto') {
      if (this.gear === 'R' && input.throttle > 0.1) {
        this.gear = 1;
        this.autoReverseHoldTimer = 0;
      } else if (input.brake > 0.25 && !isBrakeDriftCombo && Math.abs(forwardSpeed) < 1.35 && this.gear !== 'R') {
        this.autoReverseHoldTimer += delta;
        if (this.autoReverseHoldTimer >= 0.16) {
          this.gear = 'R';
          this.autoReverseHoldTimer = 0;
        }
      } else {
        this.autoReverseHoldTimer = 0;
      }
    } else {
      this.autoReverseHoldTimer = 0;
    }

    // Effective reverse drive input: in AUTO mode, Brake/S drives reverse; in MANUAL mode, Throttle/W drives Reverse when 'R' is selected
    const autoReverseThrottle = this.transmissionMode === 'auto' && this.gear === 'R' ? input.brake : 0;

    if (this.gear === 'R') {
      const revPedal = this.transmissionMode === 'auto' ? autoReverseThrottle : input.throttle;
      if (this.transmissionMode === 'manual' && input.brake > 0.05) {
        this.smoothedThrottle = THREE.MathUtils.lerp(this.smoothedThrottle, 0, Math.min(1, delta * 24.0));
        if (Math.abs(forwardSpeed) > 0.4) {
          forwardSpeed -= Math.sign(forwardSpeed) * input.brake * this.brakingRate * delta;
          if (Math.abs(forwardSpeed) < 0.4) forwardSpeed = 0;
        } else {
          forwardSpeed = 0;
        }
      } else if (revPedal > 0.01) {
        this.smoothedThrottle = THREE.MathUtils.lerp(this.smoothedThrottle, revPedal, Math.min(1, delta * 7.0));
        if (forwardSpeed > 0.2) {
          forwardSpeed -= this.brakingRate * 0.75 * delta;
        } else if (forwardSpeed > -15.5) {
          forwardSpeed -= this.smoothedThrottle * (this.accelerationRate * 0.68) * delta;
        }
      } else {
        this.smoothedThrottle = THREE.MathUtils.lerp(this.smoothedThrottle, 0, Math.min(1, delta * 8.0));
        if (Math.abs(forwardSpeed) > 0.12) {
          forwardSpeed -= Math.sign(forwardSpeed) * this.naturalFriction * delta;
        } else {
          forwardSpeed = 0;
        }
      }
    } else if (input.brake > 0.05 && !isBrakeDriftCombo) {
      this.smoothedThrottle = THREE.MathUtils.lerp(this.smoothedThrottle, 0, Math.min(1, delta * 24.0));
      if (Math.abs(forwardSpeed) > 0.4) {
        forwardSpeed -= Math.sign(forwardSpeed) * input.brake * this.brakingRate * delta;
        if (Math.abs(forwardSpeed) < 0.4) forwardSpeed = 0;
      } else {
        forwardSpeed = 0;
      }
    } else if (this.gear === 'N') {
      // NEUTRAL GEAR: Free coasting, throttle revs engine freely without drive torque
      this.smoothedThrottle = THREE.MathUtils.lerp(this.smoothedThrottle, input.throttle, Math.min(1, delta * 9.0));
      const dragForce = this.naturalFriction + forwardSpeed * forwardSpeed * this.aeroDragCoeff;
      if (Math.abs(forwardSpeed) > 0.12) {
        forwardSpeed -= Math.sign(forwardSpeed) * dragForce * delta;
      } else {
        forwardSpeed = 0;
      }
    } else {
      // FORWARD GEARS 1..6
      const gearNum = typeof this.gear === 'number' ? this.gear : 1;
      const baseGearTopKmh = this.getGearTopSpeedKmh(gearNum);
      const gearTopKmh =
        canFireNitro && gearNum === 6
          ? this.maxNitroSpeedKmh
          : canFireNitro
          ? baseGearTopKmh * 1.07
          : baseGearTopKmh;
      const gearTopMs = (gearTopKmh * 1000) / 3600;
      const gearTorque = gearTorques[gearNum - 1] || 1.0;

      // Low-RPM bogging if launched/cruised in too high a gear!
      const speedFraction = Math.max(0, forwardSpeed) / Math.max(1, gearTopMs);
      const lowRpmPenalty = gearNum > 1 && speedFraction < 0.22 ? 0.38 + (speedFraction / 0.22) * 0.62 : 1.0;

      if (input.throttle > 0.01) {
        this.smoothedThrottle = THREE.MathUtils.lerp(this.smoothedThrottle, input.throttle, Math.min(1, delta * 6.8));
        if (forwardSpeed < gearTopMs) {
          const engineAccel =
            this.smoothedThrottle *
            this.accelerationRate *
            gearTorque *
            lowRpmPenalty *
            Math.max(0.18, 1.0 - speedFraction * 0.45);
          forwardSpeed = Math.min(gearTopMs, forwardSpeed + (engineAccel + nitroThrust) * delta);
        } else if (forwardSpeed > gearTopMs + 1.2) {
          forwardSpeed -= 6.5 * delta;
        }
      } else {
        this.smoothedThrottle = THREE.MathUtils.lerp(this.smoothedThrottle, 0, Math.min(1, delta * 8.0));
        const excessBrake = forwardSpeed > gearTopMs + 1.0 ? 8.5 : 0;
        const dragForce = this.naturalFriction + excessBrake + forwardSpeed * forwardSpeed * this.aeroDragCoeff;
        if (Math.abs(forwardSpeed) > 0.12) {
          forwardSpeed -= Math.sign(forwardSpeed) * dragForce * delta;
        } else {
          forwardSpeed = 0;
        }
      }

      if (isBrakeDriftCombo) {
        forwardSpeed = Math.max(8, forwardSpeed - this.brakingRate * 0.16 * delta);
      }
    }

    this.velocity.z = forwardSpeed;
    this.speedKmh = Math.abs(Math.round((forwardSpeed * 3600) / 1000));

    // 5. Speed-Sensitive Steering Scaled by Car Handling Spec
    const handlingFactor = 0.92 + (this.handlingScore - 9.0) * 0.14;
    const speedNorm = Math.min(1.0, this.speedKmh / 230);
    const speedSteerAngleRad = THREE.MathUtils.lerp(
      THREE.MathUtils.degToRad(29 * handlingFactor),
      THREE.MathUtils.degToRad(9.2 * handlingFactor),
      speedNorm * speedNorm
    );

    const targetSteerAngle = -input.steer * speedSteerAngleRad;
    const isAnalogGyro = Math.abs(input.steer) > 0 && Math.abs(input.steer) !== 1.0;
    const steerFilterRate = isAnalogGyro ? 24.0 : Math.abs(input.steer) > 0.05 ? 11.5 * handlingFactor : 16.0;
    this.currentSteerAngle += (targetSteerAngle - this.currentSteerAngle) * Math.min(1.0, delta * steerFilterRate);

    // 6. Arcade Drift Triggers
    const isEbrake = input.handbrake && this.speedKmh > 22;
    const isBrakeTap = input.brake > 0.2 && Math.abs(input.steer) > 0.25 && this.speedKmh > 38;
    const isSustainedDrift = this.isDrifting && Math.abs(input.steer) > 0.15 && this.speedKmh > 25;

    const shouldDrift = (isEbrake || isBrakeTap || isSustainedDrift) && Math.abs(forwardSpeed) > 2.5;

    const wheelbase = 2.7;
    let turnRate = 0;

    if (Math.abs(forwardSpeed) > 0.4) {
      const dir = Math.sign(forwardSpeed);
      const driftSlideMult = 0.85 + (this.driftFactor - 1.5) * 0.35;

      if (shouldDrift) {
        this.isDrifting = true;
        this.driftTimer += delta;
        turnRate = this.currentSteerAngle * (2.35 * handlingFactor) * dir;

        const ptsGained = Math.round(this.speedKmh * delta * 10 * this.driftFactor);
        this.driftScore += ptsGained;
        this.nitroFuel = Math.min(100, this.nitroFuel + delta * 18);

        const steerSign = Math.sign(input.steer || -this.currentSteerAngle || 1);
        const targetSlip =
          -steerSign * THREE.MathUtils.degToRad(18 + Math.min(20, (this.speedKmh / 180) * 18 * driftSlideMult));
        this.driftYawAngle = THREE.MathUtils.lerp(this.driftYawAngle, targetSlip, Math.min(1.0, delta * 7.5));

        this.lateralSlipVelocity = THREE.MathUtils.lerp(
          this.lateralSlipVelocity,
          -input.steer * (forwardSpeed * 0.42 * driftSlideMult),
          delta * 5.0
        );

        if (this.smoothedThrottle > 0.15 && typeof this.gear === 'number') {
          forwardSpeed += this.accelerationRate * 0.36 * delta;
          this.velocity.z = forwardSpeed;
        }
      } else {
        if (this.isDrifting) {
          if (this.driftScore >= 50) {
            this.totalScore += this.driftScore;
            this.lastBankedDrift = this.driftScore;
            this.lastBankTimer = 2.0;
            this.didJustBankDrift = true;
            saveBestScoreRecord(this.totalScore);
          }
          if (this.driftTimer > 0.6 && this.speedKmh > 45 && typeof this.gear === 'number') {
            forwardSpeed = Math.min((this.maxNitroSpeedKmh * 1000) / 3600, forwardSpeed + 3.4);
            this.velocity.z = forwardSpeed;
          }
          this.driftScore = 0;
        }

        this.isDrifting = false;
        this.driftTimer = 0;
        this.driftYawAngle = THREE.MathUtils.lerp(this.driftYawAngle, 0, Math.min(1.0, delta * 8.5));

        const gripTurnSpeed = Math.min(Math.abs(forwardSpeed), 42.0);
        turnRate = (this.currentSteerAngle / wheelbase) * gripTurnSpeed * (0.48 * handlingFactor) * dir;
        this.lateralSlipVelocity = THREE.MathUtils.lerp(this.lateralSlipVelocity, 0, delta * 10.0);
      }
    } else {
      if (this.isDrifting && this.driftScore >= 50) {
        this.totalScore += this.driftScore;
        this.lastBankedDrift = this.driftScore;
        this.lastBankTimer = 2.0;
        this.didJustBankDrift = true;
        saveBestScoreRecord(this.totalScore);
      }
      this.driftScore = 0;
      this.isDrifting = false;
      this.driftTimer = 0;
      this.driftYawAngle = 0;
      this.lateralSlipVelocity = 0;
    }

    this.headingAngle = normalizeAngle(this.headingAngle + turnRate * delta);
    this.driftAngle = this.isDrifting ? Math.abs(Math.round(THREE.MathUtils.radToDeg(this.driftYawAngle))) : 0;

    // 7. Vertical Suspension, Jump Gravity & Touchdown Detection
    const isAboveGround = this.position.y > targetSuspensionY + 0.05;

    if (isAboveGround || this.verticalVelocity > 0) {
      this.isAirborne = true;
      this.verticalVelocity -= 24.0 * delta;
      this.airbornePeakVel = Math.max(this.airbornePeakVel, Math.abs(this.verticalVelocity));
      this.position.y += this.verticalVelocity * delta;

      if (this.jumpAirTimer > 0) {
        this.isJumping = true;
        this.jumpAirTimer += delta;
      }

      if (this.position.y <= targetSuspensionY) {
        this.position.y = targetSuspensionY;
        this.verticalVelocity = 0;
        this.isAirborne = false;
        this.isJumping = false;
        if (this.prevAirborne && this.airbornePeakVel > 6.5) {
          this.didJustLand = true;
          this.lastLandingStrength = THREE.MathUtils.clamp(this.airbornePeakVel / 18, 0.3, 1.0);
        }
        this.jumpAirTimer = 0;
        this.airbornePeakVel = 0;
      }
    } else {
      if (this.prevAirborne && this.airbornePeakVel > 6.5) {
        this.didJustLand = true;
        this.lastLandingStrength = THREE.MathUtils.clamp(this.airbornePeakVel / 18, 0.3, 1.0);
      }
      this.isAirborne = false;
      this.isJumping = false;
      this.jumpAirTimer = 0;
      this.airbornePeakVel = 0;
      this.position.y = targetSuspensionY;
      this.verticalVelocity = 0;
    }
    this.prevAirborne = this.isAirborne;

    // 8. World Translation
    const forwardX = Math.sin(this.headingAngle) * forwardSpeed * delta;
    const forwardZ = Math.cos(this.headingAngle) * forwardSpeed * delta;

    const latX = Math.cos(this.headingAngle) * this.lateralSlipVelocity * delta;
    const latZ = -Math.sin(this.headingAngle) * this.lateralSlipVelocity * delta;

    this.position.x += forwardX + latX;
    this.position.z += forwardZ + latZ;

    // 9. Track Containment, Guardrail Glance, Lap Counting, Road Slope Pitch & Wrong-Way Check
    let targetRoadSlopePitch = 0;
    if (closestPointFunc) {
      const { point, tangent, dist, t } = closestPointFunc(this.position.x, this.position.z);
      this.trackProgress = t;

      if (t > 0.42 && t < 0.62) {
        this.passedMidpoint = true;
      }
      if (this.prevSplineT > 0.85 && t < 0.15 && this.passedMidpoint) {
        const finishedLapMs = Math.round(this.lapTimeMs);
        this.didCompleteLap = true;
        this.lastCompletedLapMs = finishedLapMs;
        if (this.bestLapTimeMs === null || finishedLapMs < this.bestLapTimeMs) {
          this.bestLapTimeMs = finishedLapMs;
          this.didSetBestLap = true;
          this.newBestLapBannerTimer = 3.2;
        }
        saveBestLapRecord(finishedLapMs, this.carConfigId);
        this.lap += 1;
        this.lapTimeMs = 0;
        this.passedMidpoint = false;
      }
      this.prevSplineT = t;

      const fwdX = Math.sin(this.headingAngle);
      const fwdZ = Math.cos(this.headingAngle);
      const dotTangent = fwdX * tangent.x + fwdZ * tangent.z;

      // Align chassis elevation pitch with alpine/descent road slope!
      const rawSlopeSin = THREE.MathUtils.clamp(tangent.y * dotTangent, -0.42, 0.42);
      targetRoadSlopePitch = -Math.asin(rawSlopeSin);

      if (dotTangent < -0.45 && this.speedKmh > 25 && forwardSpeed > 0.5) {
        this.wrongWayTimer += delta;
        if (this.wrongWayTimer > 0.45) {
          this.isWrongWay = true;
        }
      } else {
        this.wrongWayTimer = 0;
        this.isWrongWay = false;
      }

      const maxCenterDist = 9.2;
      if (dist > maxCenterDist) {
        const dx = point.x - this.position.x;
        const dz = point.z - this.position.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const nx = dx / len;
        const nz = dz / len;

        this.position.x = point.x - nx * maxCenterDist;
        this.position.z = point.z - nz * maxCenterDist;

        this.position.y = targetSuspensionY;
        this.verticalVelocity = 0;
        this.isAirborne = false;
        this.isJumping = false;
        this.jumpAirTimer = 0;

        const signDir = dotTangent >= 0 ? 1 : -1;
        const targetBarrierHeading = Math.atan2(tangent.x * signDir, tangent.z * signDir);
        const angleDiff = shortestAngleDiff(this.headingAngle, targetBarrierHeading);
        this.headingAngle = normalizeAngle(this.headingAngle + angleDiff * Math.min(1.0, delta * 12.0));

        this.lateralSlipVelocity = 0;
        this.velocity.z *= Math.max(0.75, 1.0 - delta * 1.6);
        this.speedKmh = Math.abs(Math.round((this.velocity.z * 3600) / 1000));
        this.hadBarrierCollision = true;
      }
    }

    // 10. Dynamic Suspension Pitch (Hill Slope + Throttle Squat / Brake Dive) & Body Roll
    this.smoothedRoadPitch = THREE.MathUtils.lerp(this.smoothedRoadPitch, targetRoadSlopePitch, Math.min(1, delta * 9.5));
    const airPitch = this.isAirborne ? THREE.MathUtils.clamp(-this.verticalVelocity * 0.015, -0.22, 0.22) : 0;
    const targetRoll = this.isDrifting ? -this.currentSteerAngle * 0.42 : -this.currentSteerAngle * 0.16;
    const drivePitchSign = this.gear === 'R' ? 0.025 : -0.032;
    const targetPitch = this.smoothedRoadPitch + airPitch + this.smoothedThrottle * drivePitchSign + input.brake * 0.068;

    this.rotation.set(targetPitch, this.headingAngle + this.driftYawAngle, targetRoll, 'YXZ');
    this.quaternion.setFromEuler(this.rotation);

    // 10b. Transmission Management (AUTO: upshift + downshift; MANUAL: player control + standstill stall protection)
    if (input.brake > 0.1 || this.hadBarrierCollision) {
      this.manualUpshiftHoldTimer = 0;
    }

    if (typeof this.gear === 'number') {
      if (this.transmissionMode === 'auto') {
        const gearTopKmh = this.getGearTopSpeedKmh(this.gear);
        const upshiftTriggerKmh = gearTopKmh * 0.945;
        if (
          this.gear < 6 &&
          (this.rpm >= 7750 || this.speedKmh >= upshiftTriggerKmh) &&
          this.smoothedThrottle > 0.22 &&
          this.autoShiftCooldown <= 0 &&
          this.manualUpshiftHoldTimer <= 0 &&
          (!this.isDrifting || this.rpm >= 8200)
        ) {
          this.gear = this.gear + 1;
          this.didAutoShiftUp = true;
          this.autoShiftCooldown = 0.28;
        } else if (
          this.gear > 1 &&
          this.speedKmh < this.getGearDownshiftSpeedKmh(this.gear) &&
          this.manualUpshiftHoldTimer <= 0 &&
          this.autoShiftCooldown <= 0
        ) {
          this.gear = this.gear - 1;
          this.didAutoShiftDown = true;
          this.autoShiftCooldown = 0.18;
        }
      } else {
        // Manual mode: let player downshift & upshift cleanly; only rescue from complete stop stall (< 3 km/h idle)
        if (this.gear > 1 && this.speedKmh < 3 && this.smoothedThrottle < 0.08) {
          this.manualIdleTimer += delta;
          if (this.manualIdleTimer > 0.55) {
            this.gear = 1;
            this.manualIdleTimer = 0;
          }
        } else {
          this.manualIdleTimer = 0;
        }
      }
    }

    // 11. RPM Curve + Rev Limiter Bounce
    this.calculateManualRpm(delta);

    // 12. Manual Reset
    if (input.reset) {
      this.resetPosition();
    }

    const shouldShiftUp =
      this.transmissionMode === 'manual' &&
      typeof this.gear === 'number' &&
      this.gear < 6 &&
      this.rpm > 7250 &&
      this.smoothedThrottle > 0.1;

    return {
      speedKmh: this.speedKmh,
      rpm: Math.round(this.rpm),
      gear: this.gear,
      transmissionMode: this.transmissionMode,
      nitroFuel: Math.round(this.nitroFuel),
      isDrifting: this.isDrifting,
      driftScore: this.driftScore,
      totalScore: this.totalScore,
      lastBankedDrift: this.lastBankedDrift,
      isAirborne: this.isAirborne,
      isJumping: this.isJumping,
      didJustLand: this.didJustLand,
      isNewBestLap: this.newBestLapBannerTimer > 0,
      health: Math.max(0, Math.round(this.health)),
      lap: this.lap,
      lapTimeMs: Math.round(this.lapTimeMs),
      bestLapTimeMs: this.bestLapTimeMs,
      raceTimeMs: Math.round(this.raceTimeMs),
      trackProgress: this.trackProgress,
      isWrongWay: this.isWrongWay,
      shouldShiftUp
    };
  }

  private calculateManualRpm(delta: number) {
    if (this.gear === 'N') {
      const targetRev = THREE.MathUtils.lerp(850, 8250, this.smoothedThrottle);
      this.neutralFreeRev += (targetRev - this.neutralFreeRev) * Math.min(1, delta * 9.0);
      this.rpm = this.neutralFreeRev;
      return;
    }

    if (this.gear === 'R') {
      const targetRev = 950 + (Math.min(55, this.speedKmh) / 55) * 6200 + this.smoothedThrottle * 600;
      this.rpm += (Math.min(8400, targetRev) - this.rpm) * Math.min(1, delta * 12.0);
      return;
    }

    const gearNum = typeof this.gear === 'number' ? this.gear : 1;
    const gearTopKmh = this.getGearTopSpeedKmh(gearNum);
    const ratio = Math.max(0, this.speedKmh / Math.max(1, gearTopKmh));

    let targetRpm = 880 + ratio * 7550;
    if (ratio >= 0.985 && this.smoothedThrottle > 0.2) {
      // Audible/visible rev-limiter flutter at 8350–8550 RPM prompting player to press Shift!
      targetRpm = 8420 + Math.sin(performance.now() * 0.09) * 140;
    } else if (this.speedKmh < 5) {
      targetRpm = THREE.MathUtils.lerp(850, 2600, this.smoothedThrottle);
    }

    this.rpm += (Math.min(8600, targetRpm) - this.rpm) * Math.min(1, delta * 14.0);
  }

  public applyObstacleCollision(normalX: number, normalZ: number, impactSpeedKmh: number) {
    this.position.x += normalX * 1.25;
    this.position.z += normalZ * 1.25;

    const speedDropRatio = THREE.MathUtils.clamp(impactSpeedKmh / 200, 0.35, 0.72);
    this.velocity.z *= 1.0 - speedDropRatio;
    this.speedKmh = Math.abs(Math.round((this.velocity.z * 3600) / 1000));

    this.driftScore = 0;
    this.isDrifting = false;

    this.health = Math.max(10, this.health - 15);
    this.nitroFuel = Math.max(0, this.nitroFuel - 20);
  }

  public getHeadingAngle(): number {
    return this.headingAngle;
  }

  public launchRamp(upwardImpulse: number = 14.0) {
    this.verticalVelocity = upwardImpulse;
    this.velocity.z += 2.2;
    this.isAirborne = true;
    this.isJumping = true;
    this.jumpAirTimer = 0.01;
  }

  public resetPosition(spawnPos: THREE.Vector3 = new THREE.Vector3(0, 0.64, 10)) {
    this.position.copy(spawnPos);
    this.velocity.set(0, 0, 0);
    this.headingAngle = 0;
    this.currentSteerAngle = 0;
    this.verticalVelocity = 0;
    this.gear = 1;
    this.rpm = 880;
    this.manualUpshiftHoldTimer = 0;
    this.autoShiftCooldown = 0;
    this.autoReverseHoldTimer = 0;
    this.manualIdleTimer = 0;
    this.didAutoShiftDown = false;
    this.didAutoShiftUp = false;
    this.didJustLand = false;
    this.prevAirborne = false;
    this.airbornePeakVel = 0;
    this.smoothedRoadPitch = 0;
    this.driftScore = 0;
    this.isDrifting = false;
    this.isAirborne = false;
    this.isJumping = false;
    this.jumpAirTimer = 0;
    this.driftYawAngle = 0;
    this.lateralSlipVelocity = 0;
    this.smoothedThrottle = 0;
    this.health = 100;
    this.isWrongWay = false;
    this.wrongWayTimer = 0;
    this.rotation.set(0, 0, 0, 'YXZ');
    this.quaternion.setFromEuler(this.rotation);
  }

  public resetRace(spawnPos: THREE.Vector3 = new THREE.Vector3(0, 0.64, 10)) {
    this.resetPosition(spawnPos);
    this.lap = 1;
    this.lapTimeMs = 0;
    this.raceTimeMs = 0;
    this.trackProgress = 0;
    this.prevSplineT = 0.001;
    this.passedMidpoint = false;
    this.didCompleteLap = false;
    this.didSetBestLap = false;
    this.newBestLapBannerTimer = 0;
    this.totalScore = 0;
    this.lastBankedDrift = 0;
  }
}
