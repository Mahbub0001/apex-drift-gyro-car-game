import * as THREE from 'three';
import { ControllerInput, VehicleTelemetry } from '../../types';

export class VehiclePhysics {
  public position: THREE.Vector3 = new THREE.Vector3(0, 0.4, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public rotation: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
  public quaternion: THREE.Quaternion = new THREE.Quaternion();

  // Dynamics Parameters
  public speedKmh: number = 0;
  public rpm: number = 800;
  public gear: number | string = 1;
  public nitroFuel: number = 100;
  public isDrifting: boolean = false;
  public driftAngle: number = 0;
  public driftScore: number = 0;
  public isAirborne: boolean = false;
  public isJumping: boolean = false;
  public jumpAirTimer: number = 0;

  // Vehicle Specs
  public maxSpeedKmh: number = 250;
  public maxNitroSpeedKmh: number = 320;
  public accelerationRate: number = 22.0; // m/s^2
  public brakingRate: number = 35.0;
  public naturalDeceleration: number = 6.0;
  public maxSteerAngleRad: number = THREE.MathUtils.degToRad(32);

  // Internal state
  private headingAngle: number = 0;
  private currentSteerAngle: number = 0;
  private verticalVelocity: number = 0;
  private groundHeight: number = 0;

  constructor(initialPosition: THREE.Vector3 = new THREE.Vector3(0, 0.4, 0)) {
    this.position.copy(initialPosition);
  }

  public update(delta: number, input: ControllerInput, roadElevationFunc?: (x: number, z: number) => number): VehicleTelemetry {
    // 1. Determine road ground height at vehicle position
    this.groundHeight = roadElevationFunc ? roadElevationFunc(this.position.x, this.position.z) : 0;

    // 2. Nitro Management
    let currentMaxSpeed = this.maxSpeedKmh;
    let accelMultiplier = 1.0;

    if (input.nitro && this.nitroFuel > 0 && input.throttle > 0.1) {
      currentMaxSpeed = this.maxNitroSpeedKmh;
      accelMultiplier = 1.8;
      this.nitroFuel = Math.max(0, this.nitroFuel - delta * 25);
    } else {
      // Slow refill when driving clean
      this.nitroFuel = Math.min(100, this.nitroFuel + delta * 5);
    }

    // 3. Speed & Longitudinal Dynamics
    let forwardSpeed = this.velocity.z;

    if (input.throttle > 0) {
      const topSpeedMs = (currentMaxSpeed * 1000) / 3600;
      if (forwardSpeed < topSpeedMs) {
        forwardSpeed += input.throttle * this.accelerationRate * accelMultiplier * delta;
      }
    } else if (input.brake > 0) {
      if (forwardSpeed > 0.5) {
        forwardSpeed -= input.brake * this.brakingRate * delta;
      } else {
        // Reverse
        forwardSpeed -= input.brake * (this.accelerationRate * 0.4) * delta;
        forwardSpeed = Math.max(-12, forwardSpeed); // Max reverse speed
      }
    } else {
      // Natural rolling resistance & aerodynamic drag
      if (Math.abs(forwardSpeed) > 0.1) {
        forwardSpeed -= Math.sign(forwardSpeed) * this.naturalDeceleration * delta;
      } else {
        forwardSpeed = 0;
      }
    }

    this.velocity.z = forwardSpeed;
    this.speedKmh = Math.abs(Math.round((forwardSpeed * 3600) / 1000));

    // 4. Steering & Lateral Drift Dynamics
    const targetSteerAngle = -input.steer * this.maxSteerAngleRad;
    // Steering responds faster with gyro
    this.currentSteerAngle += (targetSteerAngle - this.currentSteerAngle) * Math.min(1, delta * 12);

    // High speed steering sensitivity adjustment
    const speedRatio = Math.min(1, this.speedKmh / 200);
    const speedFactor = THREE.MathUtils.lerp(1.0, 0.45, speedRatio);

    // Handbrake initiates drift oversteer
    const isEbrakePressed = input.handbrake && this.speedKmh > 35;
    let turnRate = 0;

    if (Math.abs(forwardSpeed) > 1.0) {
      const direction = Math.sign(forwardSpeed);
      if (isEbrakePressed) {
        this.isDrifting = true;
        turnRate = this.currentSteerAngle * (2.2 * speedFactor) * direction;
        this.driftScore += Math.round(this.speedKmh * delta * 10);
      } else if (Math.abs(input.steer) > 0.6 && this.speedKmh > 80) {
        // High-speed power drift
        this.isDrifting = true;
        turnRate = this.currentSteerAngle * (1.5 * speedFactor) * direction;
        this.driftScore += Math.round(this.speedKmh * delta * 5);
      } else {
        this.isDrifting = false;
        turnRate = this.currentSteerAngle * speedFactor * direction;
      }
    } else {
      this.isDrifting = false;
    }

    this.headingAngle += turnRate * delta;

    // Calculate Drift Slip Angle
    this.driftAngle = this.isDrifting ? Math.abs(Math.round(THREE.MathUtils.radToDeg(this.currentSteerAngle))) : 0;

    // 5. Vertical Dynamics & Asphalt 9 Jump Ramps
    const targetSuspensionY = this.groundHeight + 0.38;
    const isAboveGround = this.position.y > targetSuspensionY + 0.08;

    if (isAboveGround) {
      this.isAirborne = true;
      this.verticalVelocity -= 22.0 * delta; // Gravity
      this.position.y += this.verticalVelocity * delta;

      if (this.verticalVelocity > 6.0 || this.jumpAirTimer > 0) {
        this.isJumping = true;
        this.jumpAirTimer += delta;
      }

      // Touchdown landing check
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
      // Smooth suspension snap
      this.position.y += (targetSuspensionY - this.position.y) * Math.min(1, delta * 15);
      this.verticalVelocity = 0;
    }

    // 6. World Position Update
    const forwardX = Math.sin(this.headingAngle) * forwardSpeed * delta;
    const forwardZ = Math.cos(this.headingAngle) * forwardSpeed * delta;

    this.position.x += forwardX;
    this.position.z += forwardZ;

    // 7. Chassis Roll & Pitch Visuals
    // Roll when turning / drifting
    const targetRoll = this.isDrifting ? -this.currentSteerAngle * 0.45 : -this.currentSteerAngle * 0.18;
    // Pitch when accelerating or braking
    const targetPitch = (input.throttle * 0.04) - (input.brake * 0.12);

    this.rotation.set(targetPitch, this.headingAngle, targetRoll, 'YXZ');
    this.quaternion.setFromEuler(this.rotation);

    // 8. Transmission & RPM Simulation
    this.calculateGearAndRpm();

    // 9. Reset action
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
      health: 100
    };
  }

  // Launch car airborne off a ramp
  public launchRamp(upwardImpulse: number = 14.0) {
    this.verticalVelocity = upwardImpulse;
    this.isAirborne = true;
    this.isJumping = true;
  }

  private calculateGearAndRpm() {
    if (this.velocity.z < -0.1) {
      this.gear = 'R';
      this.rpm = 1200 + (Math.abs(this.speedKmh) / 25) * 5500;
      return;
    }

    if (this.speedKmh < 1) {
      this.gear = 1;
      this.rpm = 850;
      return;
    }

    const gearRatios = [0, 45, 95, 145, 195, 245, 320];
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
    const progressInGear = (this.speedKmh - prevGearSpeed) / gearSpan;

    this.rpm = THREE.MathUtils.lerp(2200, 8200, progressInGear);
  }

  public resetPosition(spawnPos: THREE.Vector3 = new THREE.Vector3(0, 0.4, 0)) {
    this.position.copy(spawnPos);
    this.velocity.set(0, 0, 0);
    this.headingAngle = 0;
    this.verticalVelocity = 0;
    this.isDrifting = false;
    this.isAirborne = false;
    this.isJumping = false;
  }
}
