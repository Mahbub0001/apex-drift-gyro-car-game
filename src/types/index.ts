export interface ControllerInput {
  steer: number;        // -1.0 (full left) to +1.0 (full right)
  throttle: number;     // 0.0 to 1.0
  brake: number;        // 0.0 to 1.0
  handbrake: boolean;   // e-brake for drifting
  nitro: boolean;       // nitro boost
  reset: boolean;       // reset car position
  cameraSwitch: boolean;// toggle camera view
  angleDegrees: number; // raw tilt angle for HUD display
  timestamp: number;
}

export interface VehicleTelemetry {
  speedKmh: number;
  rpm: number;
  gear: number | string; // 'R', 'N', 1..6
  nitroFuel: number;    // 0 to 100
  isDrifting: boolean;
  driftScore: number;
  isAirborne: boolean;
  isJumping: boolean;   // Asphalt 9 cinematic jump active
  health: number;       // 0 to 100
}

export interface PeerMessage {
  type: 'INPUT' | 'PING' | 'PONG' | 'CALIBRATE' | 'FEEDBACK' | 'ROOM_STATE';
  payload: any;
}

export interface TrafficCarState {
  id: string;
  type: 'sedan' | 'suv' | 'truck';
  position: [number, number, number];
  rotation: [number, number, number];
  speed: number;
  lane: number;
  color: string;
}

export interface RemotePlayerState {
  id: string;
  username: string;
  carId: string;
  color: string;
  position: [number, number, number];
  rotation: [number, number, number, number]; // quaternion
  speedKmh: number;
  isDrifting: boolean;
  isNitro: boolean;
  ping: number;
}
