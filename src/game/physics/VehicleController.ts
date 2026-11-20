import * as THREE from 'three';
import { ControllerInput, VehicleTelemetry } from '../../types';

export class VehiclePhysics {
  public position: THREE.Vector3 = new THREE.Vector3(0, 0.42, 10);
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
  public isAirborne: boolean = false;
  public isJumping: boolean = false;
  public jumpAirTimer: number = 0;
  public health: number = 100;

  // Real Supercar Specs (Calibrated for Asphalt 9 / NFS arcade-realism)
  public maxSpeedKmh: number = 295;
  public maxNitroSpeedKmh: number = 345;
  public accelerationRate: number = 10.5; // m/s^2 (0-100 km/h in ~2.9s)
  public brakingRate: number = 22.0;      // Strong progressive disc brakes
  public naturalFriction: number = 2.8;   // Rolling resistance
  public aeroDragCoeff: number = 0.00065; // Aerodynamic drag (proportional to v^2)
  public maxSteerAngleRad: number = THREE.MathUtils.degToRad(30);

  // Internal Dynamics
  private headingAngle: number = 0;
  private currentSteerAngle: number = 0;
  private verticalVelocity: number = 0;
  private groundHeight: number = 0;
  private lateralSlipVelocity: number = 0;

  // Collision state
  public hadBarrierCollision: boolean = false;

  constructor(initialPosition: THREE.Vector3 = new THREE.Vector3(0, 0.42, 10)) {
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
      nitroThrust = 11.5; // Extra boost m/s^2
      this.nitroFuel = Math.max(0, this.nitroFuel - delta * 24);
    } else {
      // Passive clean driving refill
      this.nitroFuel = Math.min(100, this.nitroFuel + delta * 4.5);
    }

    // 3. Longitudinal Dynamics (Progressive throttle, drag & gears)
    let forwardSpeed = this.velocity.z;
    const speedRatio = Math.min(1.0, Math.abs(this.speedKmh) / currentMaxSpeed);

    // Gear torque multiplier (Gear 1 has highest launch torque, 6 has high speed cruise)
    const gearTorque = [1.8, 1.45, 1.2, 1.0, 0.85, 0.72][(typeof this.gear === 'number' ? this.gear : 1) - 1] || 1.0;

    if (input.throttle > 0) {
      const topSpeedMs = (currentMaxSpeed * 1000) / 3600;
      if (forwardSpeed < topSpeedMs) {
        // Authentic power delivery: high low-end grunt tapering with speed
        const engineAccel = input.throttle * this.accelerationRate * gearTorque * (1.0 - speedRatio * 0.45);
        forwardSpeed += (engineAccel + nitroThrust) * delta;
      }
    } else if (input.brake > 0) {
      if (forwardSpeed > 0.5) {
        forwardSpeed -= input.brake * this.brakingRate * delta;
      } else {
        // Reverse
        forwardSpeed -= input.brake * (this.accelerationRate * 0.4) * delta;
        forwardSpeed = Math.max(-14, forwardSpeed);
      }
    } else {
      // Natural rolling resistance and aerodynamic drag (v^2)
      const dragForce = this.naturalFriction + (forwardSpeed * forwardSpeed * this.aeroDragCoeff);
      if (Math.abs(forwardSpeed) > 0.1) {
        forwardSpeed -= Math.sign(forwardSpeed) * dragForce * delta;
      } else {
        forwardSpeed = 0;
      }
    }

    this.velocity.z = forwardSpeed;
    this.speedKmh = Math.abs(Math.round((forwardSpeed * 3600) / 1000));

    // 4. Realistic Dynamic Steering & Drift Dynamics
    const steerSpeedScale = THREE.MathUtils.lerp(1.0, 0.42, Math.min(1.0, this.speedKmh / 220));
    const targetSteerAngle = -input.steer * this.maxSteerAngleRad;

    // Responsive EMA smoothing
    this.currentSteerAngle += (targetSteerAngle - this.currentSteerAngle) * Math.min(1.0, delta * 14);

    const isEbrake = input.handbrake && this.speedKmh > 30;
    const isHardSteerDrift = Math.abs(input.steer) > 0.75 && this.speedKmh > 85;

    let turnRate = 0;
    if (Math.abs(forwardSpeed) > 1.0) {
      const dir = Math.sign(forwardSpeed);

      if (isEbrake || isHardSteerDrift) {
        this.isDrifting = true;
        // Oversteer drift angle
        turnRate = this.currentSteerAngle * (2.1 * steerSpeedScale) * dir;
        this.driftScore += Math.round(this.speedKmh * delta * 8);

        // Lateral slip sliding
        this.lateralSlipVelocity = THREE.MathUtils.lerp(
          this.lateralSlipVelocity,
          -input.steer * (forwardSpeed * 0.35),
          delta * 4
        );
      } else {
        this.isDrifting = false;
        turnRate = this.currentSteerAngle * steerSpeedScale * dir;
        this.lateralSlipVelocity = THREE.MathUtils.lerp(this.lateralSlipVelocity, 0, delta * 8);
      }
    } else {
      this.isDrifting = false;
      this.lateralSlipVelocity = 0;
    }

    this.headingAngle += turnRate * delta;
    this.driftAngle = this.isDrifting ? Math.abs(Math.round(THREE.MathUtils.radToDeg(this.currentSteerAngle))) : 0;

    // 5. Vertical Suspension & Asphalt 9 Jump Ramps
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

    // 7. Track Boundary & Armco Guardrail Collision (Keeps car safely on asphalt)
    if (closestPointFunc) {
      const { point, dist } = closestPointFunc(this.position.x, this.position.z);
      const roadHalfWidth = 5.5; // Road is 12m wide, guardrails at +/-5.5m

      if (dist > roadHalfWidth) {
        // Compute pushback direction vector towards track centerline
        const dx = point.x - this.position.x;
        const dz = point.z - this.position.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const nx = dx / len;
        const nz = dz / len;

        // Position clamped firmly inside guardrail
        this.position.x = point.x - nx * roadHalfWidth;
        this.position.z = point.z - nz * roadHalfWidth;

        // Scrub forward velocity and bounce inward
        this.velocity.z *= 0.85;
        this.speedKmh = Math.abs(Math.round((this.velocity.z * 3600) / 1000));
        this.headingAngle += nx * 0.12;
        this.hadBarrierCollision = true;
      }
    }

    // 8. Dynamic Chassis Roll & Pitch Visuals
    const targetRoll = this.isDrifting ? -this.currentSteerAngle * 0.42 : -this.currentSteerAngle * 0.18;
    const targetPitch = (input.throttle * 0.045) - (input.brake * 0.09);

    this.rotation.set(targetPitch, this.headingAngle, targetRoll, 'YXZ');
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
    // Physical pushback
    this.position.x += normalX * 1.2;
    this.position.z += normalZ * 1.5;

    // Momentum drop based on severity
    const speedDropRatio = THREE.MathUtils.clamp(impactSpeedKmh / 200, 0.35, 0.75);
    this.velocity.z *= (1.0 - speedDropRatio);
    this.speedKmh = Math.abs(Math.round((this.velocity.z * 3600) / 1000));

    // Damage
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
      this.rpm = 1200 + (Math.abs(this.speedKmh) / 25) * 5500;
      return;
    }

    if (this.speedKmh < 1) {
      this.gear = 1;
      this.rpm = 850;
      return;
    }

    const gearRatios = [0, 55, 105, 155, 215, 275, 360];
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

    this.rpm = THREE.MathUtils.lerp(2400, 8400, progressInGear);
  }

  public resetPosition(spawnPos: THREE.Vector3 = new THREE.Vector3(0, 0.42, 10)) {
    this.position.copy(spawnPos);
    this.velocity.set(0, 0, 0);
    this.headingAngle = 0;
    this.verticalVelocity = 0;
    this.isDrifting = false;
    this.isAirborne = false;
    this.isJumping = false;
    this.lateralSlipVelocity = 0;
    this.health = 100;
  }
}
