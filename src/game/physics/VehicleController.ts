import * as THREE from 'three';
import { ControllerInput, VehicleTelemetry } from '../../types';

export class VehiclePhysics {
  public position: THREE.Vector3 = new THREE.Vector3(0, 0.64, 10);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public rotation: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
  public quaternion: THREE.Quaternion = new THREE.Quaternion();

  // Telemetry & States
  public speedKmh: number = 0;
  public rpm: number = 850;
  public gear: number | string = 1;
  public nitroFuel: number = 100;
  public isDrifting: boolean = false;
  public driftAngle: number = 0;
  public driftScore: number = 0;
  public driftYawAngle: number = 0; // Visual oversteer slip angle (chassis yaw relative to velocity)
  private driftTimer: number = 0;
  public isAirborne: boolean = false;
  public isJumping: boolean = false;
  public jumpAirTimer: number = 0;
  public health: number = 100;

  // Real Supercar Specs (Calibrated for Authentic Gran Turismo / NFS Driving Physics)
  public maxSpeedKmh: number = 295;
  public maxNitroSpeedKmh: number = 335;
  public accelerationRate: number = 7.4; // Real supercar launch ~0-100 km/h in 3.4s
  public brakingRate: number = 20.0;     // Progressive multi-piston carbon ceramic disc brakes
  public naturalFriction: number = 2.4;  // Rolling road friction
  public aeroDragCoeff: number = 0.00075;// Real aerodynamic drag proportional to v^2

  // Internal Dynamics
  private headingAngle: number = 0;
  private currentSteerAngle: number = 0;
  private verticalVelocity: number = 0;
  private groundHeight: number = 0;
  private lateralSlipVelocity: number = 0;
  private smoothedThrottle: number = 0;

  // Collision state
  public hadBarrierCollision: boolean = false;

  constructor(initialPosition: THREE.Vector3 = new THREE.Vector3(0, 0.64, 10)) {
    this.position.copy(initialPosition);
  }

  public update(
    delta: number,
    input: ControllerInput,
    roadElevationFunc?: (x: number, z: number) => number,
    closestPointFunc?: (x: number, z: number) => { point: THREE.Vector3; tangent: THREE.Vector3; dist: number }
  ): VehicleTelemetry {
    this.hadBarrierCollision = false;

    // 1. Terrain Ground Height
    this.groundHeight = roadElevationFunc ? roadElevationFunc(this.position.x, this.position.z) : 0;

    // 2. Nitro Management
    let currentMaxSpeed = this.maxSpeedKmh;
    let nitroThrust = 0;

    if (input.nitro && this.nitroFuel > 0 && input.throttle > 0.05) {
      currentMaxSpeed = this.maxNitroSpeedKmh;
      nitroThrust = 6.5; // Controlled, powerful turbo boost
      this.nitroFuel = Math.max(0, this.nitroFuel - delta * 20);
    } else {
      // Passive clean driving refill
      this.nitroFuel = Math.min(100, this.nitroFuel + delta * 3.5);
    }

    // 3. Realistic Progressive Throttle & Power Delivery (Authentic Car Inertia)
    // Smooth fly-by-wire throttle response (eliminates instant uncontrollable rocket jump)
    this.smoothedThrottle = THREE.MathUtils.lerp(this.smoothedThrottle, input.throttle, delta * 5.2);

    let forwardSpeed = this.velocity.z;
    const speedRatio = Math.min(1.0, Math.abs(this.speedKmh) / currentMaxSpeed);

    // Gear torque multiplier (Gear 1 has solid mechanical launch, tapering naturally through gears)
    const currentGearNum = typeof this.gear === 'number' ? this.gear : 1;
    const gearTorque = [1.32, 1.12, 0.98, 0.86, 0.74, 0.64][currentGearNum - 1] || 1.0;

    if (this.smoothedThrottle > 0.01) {
      const topSpeedMs = (currentMaxSpeed * 1000) / 3600;
      if (forwardSpeed < topSpeedMs) {
        // Authentic internal combustion torque curve: progressive low-to-mid grunt tapering at high RPM
        const engineAccel = this.smoothedThrottle * this.accelerationRate * gearTorque * Math.max(0.12, 1.0 - speedRatio * 0.55);
        forwardSpeed += (engineAccel + nitroThrust) * delta;
      }
    } else if (input.brake > 0) {
      if (forwardSpeed > 0.5) {
        forwardSpeed -= input.brake * this.brakingRate * delta;
      } else {
        // Reverse gear
        forwardSpeed -= input.brake * (this.accelerationRate * 0.45) * delta;
        forwardSpeed = Math.max(-12, forwardSpeed);
      }
    } else {
      // Natural engine braking, rolling resistance, and aerodynamic drag (proportional to v^2)
      const dragForce = this.naturalFriction + (forwardSpeed * forwardSpeed * this.aeroDragCoeff);
      if (Math.abs(forwardSpeed) > 0.1) {
        forwardSpeed -= Math.sign(forwardSpeed) * dragForce * delta;
      } else {
        forwardSpeed = 0;
      }
    }

    this.velocity.z = forwardSpeed;
    this.speedKmh = Math.abs(Math.round((forwardSpeed * 3600) / 1000));

    // 4. Realistic Dynamic Steering & Physics-Based Handling
    // Speed-sensitive steering angle attenuation:
    // Low speed (0-40 km/h): up to 28 deg for hairpins & tight curves
    // Medium speed (60-120 km/h): ~18 deg for agile road carving
    // High speed (180+ km/h): ~9 deg for rock-solid, stable highway driving (prevents twitchy spins)
    const speedNorm = Math.min(1.0, this.speedKmh / 220);
    const speedSteerAngleRad = THREE.MathUtils.lerp(
      THREE.MathUtils.degToRad(28),
      THREE.MathUtils.degToRad(8.8),
      speedNorm * speedNorm
    );

    const targetSteerAngle = -input.steer * speedSteerAngleRad;
    // Ultra-responsive steering: Continuous analog gyro input receives instant 24.0 rate for zero-lag (<5ms) handling
    const isAnalogGyro = Math.abs(input.steer) > 0 && Math.abs(input.steer) !== 1.0;
    const steerFilterRate = isAnalogGyro ? 24.0 : (Math.abs(input.steer) > 0.05 ? 14.0 : 18.0);
    this.currentSteerAngle += (targetSteerAngle - this.currentSteerAngle) * Math.min(1.0, delta * steerFilterRate);

    // Need for Speed / Asphalt Style Multi-Trigger Drift System:
    // 1. Handbrake tap (Space / Mobile E-Brake)
    // 2. Brake-to-Drift: Tapping brake while steering into a turn at speed
    // 3. Hard flick: Quick aggressive steering angle at high speed
    // 4. Drift Sustain: Maintaining steering angle while sliding
    const isEbrake = input.handbrake && this.speedKmh > 20;
    const isBrakeFlick = input.brake > 0.25 && Math.abs(input.steer) > 0.32 && this.speedKmh > 40;
    const isHardSteerFlick = Math.abs(input.steer) > 0.65 && this.speedKmh > 65;
    const isSustainedDrift = this.isDrifting && Math.abs(input.steer) > 0.18 && this.speedKmh > 25;

    const shouldDrift = (isEbrake || isBrakeFlick || isHardSteerFlick || isSustainedDrift) && Math.abs(forwardSpeed) > 1.0;

    const wheelbase = 2.7; // Standard supercar wheelbase (Ferrari 458 / GT3)
    let turnRate = 0;

    if (Math.abs(forwardSpeed) > 0.4) {
      const dir = Math.sign(forwardSpeed);

      if (shouldDrift) {
        this.isDrifting = true;
        this.driftTimer += delta;
        turnRate = this.currentSteerAngle * 2.65 * dir;
        this.driftScore += Math.round(this.speedKmh * delta * 12);
        // Fast nitro refill during continuous drift
        this.nitroFuel = Math.min(100, this.nitroFuel + delta * 16);

        // Calculate visual oversteer chassis yaw angle (car body pitches sideways into the corner)
        const steerSign = Math.sign(input.steer || -this.currentSteerAngle || 1);
        const targetSlip = -steerSign * THREE.MathUtils.degToRad(20 + Math.min(18, (this.speedKmh / 180) * 18));
        this.driftYawAngle = THREE.MathUtils.lerp(this.driftYawAngle, targetSlip, Math.min(1.0, delta * 7.5));

        // Lateral velocity pushes the car along the road in a glorious arc
        this.lateralSlipVelocity = THREE.MathUtils.lerp(
          this.lateralSlipVelocity,
          -input.steer * (forwardSpeed * 0.46),
          delta * 4.8
        );

        // Power slide throttle sustain: engine keeps wheelspinning, maintaining forward momentum
        if (this.smoothedThrottle > 0.15) {
          forwardSpeed += this.accelerationRate * 0.45 * delta;
        }
      } else {
        // Drift Exit Boost: Exiting a solid drift rewards player with punch forward
        if (this.isDrifting && this.driftTimer > 0.65 && this.speedKmh > 45) {
          forwardSpeed = Math.min((currentMaxSpeed * 1000) / 3600, forwardSpeed + 3.8); // +14 km/h surge!
        }

        this.isDrifting = false;
        this.driftTimer = 0;
        this.driftYawAngle = THREE.MathUtils.lerp(this.driftYawAngle, 0, Math.min(1.0, delta * 8.5));

        // Clean mechanical grip cornering with speed scaling
        const gripTurnSpeed = Math.min(forwardSpeed, 42.0);
        turnRate = (this.currentSteerAngle / wheelbase) * gripTurnSpeed * 0.46 * dir;
        this.lateralSlipVelocity = THREE.MathUtils.lerp(this.lateralSlipVelocity, 0, delta * 9.5);
      }
    } else {
      this.isDrifting = false;
      this.driftTimer = 0;
      this.driftYawAngle = 0;
      this.lateralSlipVelocity = 0;
    }

    this.headingAngle += turnRate * delta;
    this.driftAngle = this.isDrifting
      ? Math.abs(Math.round(THREE.MathUtils.radToDeg(this.driftYawAngle)))
      : 0;

    // 5. Vertical Suspension & Ground Adhesion
    const targetSuspensionY = this.groundHeight + 0.42;
    const isAboveGround = this.position.y > targetSuspensionY + 0.05;

    if (isAboveGround) {
      this.isAirborne = true;
      this.verticalVelocity -= 22.0 * delta; // Gravity
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
        this.jumpAirTimer = 0;
      }
    } else {
      this.isAirborne = false;
      this.isJumping = false;
      this.jumpAirTimer = 0;
      this.position.y = targetSuspensionY;
      this.verticalVelocity = 0;
    }

    // 6. World Position Translation
    const forwardX = Math.sin(this.headingAngle) * forwardSpeed * delta;
    const forwardZ = Math.cos(this.headingAngle) * forwardSpeed * delta;

    const latX = Math.cos(this.headingAngle) * this.lateralSlipVelocity * delta;
    const latZ = -Math.sin(this.headingAngle) * this.lateralSlipVelocity * delta;

    this.position.x += forwardX + latX;
    this.position.z += forwardZ + latZ;

    // 7. Track Boundary & Armco Guardrail Collision (Strict Containment - Cannot Mount Railing!)
    if (closestPointFunc) {
      const { point, tangent, dist } = closestPointFunc(this.position.x, this.position.z);

      // Road is 18.5m wide (center to edge is 9.25m). Guardrail centerline is at 10.45m.
      // Car is 2.0m wide (half-width 1.0m).
      // Max allowed center distance = 10.45m - 1.0m - 0.25m buffer = 9.2m.
      // At 9.2m, the outer edge of the car lightly brushes the Armco guardrail and CANNOT mount on top!
      const maxCenterDist = 9.2;

      if (dist > maxCenterDist) {
        // Vector from car position towards track centerline
        const dx = point.x - this.position.x;
        const dz = point.z - this.position.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const nx = dx / len;
        const nz = dz / len;

        // 1. Rigidly clamp car position strictly inside the barrier (ZERO penetration)
        this.position.x = point.x - nx * maxCenterDist;
        this.position.z = point.z - nz * maxCenterDist;

        // 2. Rigidly lock vertical suspension to asphalt road plane (CANNOT CLIMB ON RAILING!)
        this.position.y = targetSuspensionY;
        this.verticalVelocity = 0;
        this.isAirborne = false;
        this.isJumping = false;
        this.jumpAirTimer = 0;

        // 3. Need for Speed / Forza style barrier glance:
        // Deflect heading to seamlessly align with track tangent direction
        const trackHeading = Math.atan2(tangent.x, tangent.z);
        this.headingAngle = THREE.MathUtils.lerp(this.headingAngle, trackHeading, Math.min(1.0, delta * 12.0));

        // 4. Cancel outward lateral velocity
        this.lateralSlipVelocity = 0;

        // 5. Realistic friction scrub along metal barrier
        this.velocity.z *= Math.max(0.72, 1.0 - delta * 1.8);
        this.speedKmh = Math.abs(Math.round((this.velocity.z * 3600) / 1000));

        this.hadBarrierCollision = true;
      }
    }

    // 8. Dynamic Chassis Roll & Pitch Visuals with Drift Slip Angle
    const targetRoll = this.isDrifting ? -this.currentSteerAngle * 0.45 : -this.currentSteerAngle * 0.16;
    const targetPitch = (this.smoothedThrottle * 0.038) - (input.brake * 0.075);

    // Apply heading angle PLUS visual drift slip angle so car model turns sideways during drift!
    this.rotation.set(targetPitch, this.headingAngle + this.driftYawAngle, targetRoll, 'YXZ');
    this.quaternion.setFromEuler(this.rotation);

    // 9. Transmission & RPM Simulation
    this.calculateGearAndRpm();

    // 10. Manual Reset
    if (input.reset) {
      this.resetPosition();
    }

    return {
      speedKmh: this.speedKmh,
      rpm: Math.round(this.rpm),
      gear: this.gear,
      nitroFuel: Math.round(this.nitroFuel),
      isDrifting: this.isDrifting,
      driftScore: this.driftScore,
      isAirborne: this.isAirborne,
      isJumping: this.isJumping,
      health: Math.max(0, Math.round(this.health))
    };
  }

  // Handle Collision Impact with Civilian Traffic Car
  public applyObstacleCollision(normalX: number, normalZ: number, impactSpeedKmh: number) {
    this.position.x += normalX * 1.2;
    this.position.z += normalZ * 1.5;

    const speedDropRatio = THREE.MathUtils.clamp(impactSpeedKmh / 200, 0.35, 0.75);
    this.velocity.z *= (1.0 - speedDropRatio);
    this.speedKmh = Math.abs(Math.round((this.velocity.z * 3600) / 1000));

    this.health = Math.max(10, this.health - 15);
    this.nitroFuel = Math.max(0, this.nitroFuel - 25);
  }

  public launchRamp(upwardImpulse: number = 14.0) {
    this.verticalVelocity = upwardImpulse;
    this.isAirborne = true;
    this.isJumping = true;
    this.jumpAirTimer = 0.01;
  }

  private calculateGearAndRpm() {
    if (this.velocity.z < -0.1) {
      this.gear = 'R';
      this.rpm = 1100 + (Math.abs(this.speedKmh) / 25) * 4500;
      return;
    }

    if (this.speedKmh < 1) {
      this.gear = 1;
      this.rpm = THREE.MathUtils.lerp(850, 2200, this.smoothedThrottle);
      return;
    }

    // Realistic 6-speed dual-clutch transmission speeds (km/h)
    const gearRatios = [0, 58, 108, 158, 215, 275, 360];
    let selectedGear = 1;

    for (let g = 1; g < gearRatios.length; g++) {
      if (this.speedKmh <= gearRatios[g]) {
        selectedGear = g;
        break;
      }
    }
    this.gear = selectedGear;

    const prevGearSpeed = gearRatios[selectedGear - 1];
    const nextGearSpeed = gearRatios[selectedGear];
    const gearSpan = nextGearSpeed - prevGearSpeed;
    const progressInGear = THREE.MathUtils.clamp((this.speedKmh - prevGearSpeed) / gearSpan, 0, 1);

    // Idle at 2400 RPM in gear, redline at 8500 RPM
    this.rpm = THREE.MathUtils.lerp(2400, 8500, progressInGear);
  }

  public resetPosition(spawnPos: THREE.Vector3 = new THREE.Vector3(0, 0.64, 10)) {
    this.position.copy(spawnPos);
    this.velocity.set(0, 0, 0);
    this.headingAngle = 0;
    this.verticalVelocity = 0;
    this.isDrifting = false;
    this.isAirborne = false;
    this.isJumping = false;
    this.lateralSlipVelocity = 0;
    this.smoothedThrottle = 0;
    this.health = 100;
  }
}
