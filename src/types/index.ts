export interface ControllerInput {
  steer: number;        // -1.0 (full left) to +1.0 (full right)
  throttle: number;     // 0.0 to 1.0
  brake: number;        // 0.0 to 1.0
  handbrake: boolean;   // e-brake for drifting
  nitro: boolean;       // nitro boost
  reset: boolean;       // reset car position
  cameraSwitch: boolean;// toggle camera view
  angleDegrees: number; // raw tilt angle for HUD display
  horn?: boolean;       // honk supercar horn
  shiftUpSeq?: number;  // monotonic counter for manual upshift (WebRTC safe)
  shiftDownSeq?: number;// monotonic counter for manual downshift (WebRTC safe)
  toggleTransmissionSeq?: number; // monotonic counter to toggle auto/manual gearbox from phone
  cameraSeq?: number;   // monotonic counter for camera toggle (WebRTC safe)
  resetSeq?: number;    // monotonic counter for car reset (WebRTC safe)
  timestamp: number;
}

export type TransmissionMode = 'auto' | 'manual';

export interface GhostFrame {
  timeMs: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
}

export interface VehicleTelemetry {
  speedKmh: number;
  rpm: number;
  gear: number | string; // 'R', 'N', 1..6
  transmissionMode?: TransmissionMode;
  nitroFuel: number;    // 0 to 100
  isDrifting: boolean;
  driftScore: number;
  totalScore?: number;
  lastBankedDrift?: number;
  isAirborne: boolean;
  isJumping: boolean;   // Asphalt 9 cinematic jump active
  didJustLand?: boolean;
  isNewBestLap?: boolean;
  health: number;       // 0 to 100
  isOnCurb?: boolean;   // Wheels riding red/white rumble strip
  isWrongWay?: boolean;
  cameraMode?: 'chase' | 'hood';
  lap?: number;
  lapTimeMs?: number;
  bestLapTimeMs?: number | null;
  raceTimeMs?: number;
  trackProgress?: number; // 0..1 normalized position along track loop
  shouldShiftUp?: boolean; // Manual transmission redline cue (7400+ RPM)
}

export interface GameSettings {
  graphicsQuality: 'ultra' | 'high' | 'medium';
  defaultCamera: 'chase' | 'hood';
  transmissionMode: TransmissionMode;
  isMuted: boolean;
  gyroSensitivity: number;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  graphicsQuality: 'ultra',
  defaultCamera: 'chase',
  transmissionMode: 'auto',
  isMuted: false,
  gyroSensitivity: 1.2
};

export interface PeerMessage {
  type: 'INPUT' | 'PING' | 'PONG' | 'CALIBRATE' | 'FEEDBACK' | 'ROOM_STATE';
  payload: any;
}

export interface TrafficCarState {
  id: string;
  type: 'sedan' | 'suv' | 'truck' | 'van' | 'taxi';
  position: [number, number, number];
  rotation: [number, number, number];
  speed: number;
  lane: number;
  color: string;
}

export interface RaceFinishEntry {
  id: string;
  username: string;
  carId: string;
  color: string;
  finishTimeMs: number;
  rank: number;
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
  lap?: number;
  trackProgress?: number;
  finishedAtMs?: number | null;
}

export interface SuperCarConfig {
  id: 'raptor' | 'phantom' | 'apex' | 'spark' | 'titan';
  name: string;
  subtitle: string;
  bodyColorHex: number;
  accentColorHex: number;
  topSpeedKmh: number;
  accelerationRate: number;
  handlingScore: number;
  driftFactor: number;
  nitroMultiplier: number;
  description: string;
}

export const SUPER_CARS: SuperCarConfig[] = [
  {
    id: 'raptor',
    name: 'RAPTOR',
    subtitle: 'Track Hypercar Spec',
    bodyColorHex: 0xd90429, // Crimson Red
    accentColorHex: 0x111115,
    topSpeedKmh: 310,
    accelerationRate: 7.4,
    handlingScore: 9.6,
    driftFactor: 1.6,
    nitroMultiplier: 1.8,
    description: 'High-downforce aerodynamic flagship engineered for record-breaking cornering and top-end straightaway speeds.'
  },
  {
    id: 'phantom',
    name: 'PHANTOM',
    subtitle: 'Midnight Aero Spec',
    bodyColorHex: 0x5a189a, // Midnight Violet
    accentColorHex: 0x00f2fe, // Cyan Accents
    topSpeedKmh: 325,
    accelerationRate: 7.8,
    handlingScore: 9.3,
    driftFactor: 1.9,
    nitroMultiplier: 2.0,
    description: 'Ultra-low drag dual-motor hybrid hypercar with active aero flaps and high-output nitro delivery.'
  },
  {
    id: 'apex',
    name: 'APEX',
    subtitle: 'Competition GT3 Livery',
    bodyColorHex: 0xff6b00, // Competition Orange
    accentColorHex: 0xffffff, // White Racing Stripe
    topSpeedKmh: 295,
    accelerationRate: 7.0,
    handlingScore: 9.9,
    driftFactor: 1.5,
    nitroMultiplier: 1.6,
    description: 'FIA GT3 homologated racer with ultra-sticky slick tires, immense mechanical grip, and surgical steering.'
  },
  {
    id: 'spark',
    name: 'SPARK',
    subtitle: 'Radical Track Beast',
    bodyColorHex: 0x38b000, // Acid Green
    accentColorHex: 0x111115,
    topSpeedKmh: 305,
    accelerationRate: 7.6,
    handlingScore: 9.7,
    driftFactor: 1.8,
    nitroMultiplier: 1.7,
    description: 'Raw naturally-aspirated V12 track weapon featuring razor-sharp carbon canards and instantaneous throttle response.'
  },
  {
    id: 'titan',
    name: 'TITAN',
    subtitle: 'Widebody Drift King',
    bodyColorHex: 0xffb703, // Sunburst Yellow
    accentColorHex: 0x1a1a20, // Matte Carbon
    topSpeedKmh: 300,
    accelerationRate: 7.2,
    handlingScore: 9.1,
    driftFactor: 2.2,
    nitroMultiplier: 1.9,
    description: 'Twin-turbocharged widebody brute tuned for maximum lateral smoke, high-angle drifts, and massive low-end torque.'
  }
];
