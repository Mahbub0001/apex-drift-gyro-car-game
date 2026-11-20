# Implementation Phases & Roadmap (PHASES.md)
## Project Name: Apex Drift: Web & Gyro
**Methodology:** Incremental Feature-Driven Development with Continuous Verification  
**Target:** Production-Ready Vercel Deployment with GitHub CI/CD  

---

## Roadmap Overview

```
+-----------------------------------------------------------------------------------+
|  PHASE 1: Foundation & WebRTC Gyroscope Remote Controller Bridge                  |
|  - Vite + React + TS setup, QR pairing, Low-pass EMA gyro stream, Haptics & HUD  |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|  PHASE 2: 3D High-Fidelity Rendering & Raycast Vehicle Physics                   |
|  - Three.js PBR shaders, Rapier.js physics, suspension tuning, drift dynamics     |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|  PHASE 3: Scenic Highway, Spline Curves & Asphalt 9 Cinematic Jump Ramps         |
|  - Autumn mountain environment, banked turns, jump kicker, cinematic camera cam   |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|  PHASE 4: Dynamic Traffic Obstacle System & Realtime Vector Minimap               |
|  - Waypoint AI civilian cars, collision scraping, 60 FPS track radar HUD          |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|  PHASE 5: Supabase Integration & Multiplayer Lobby System                         |
|  - Room codes, state replication (20Hz snapshots), player interpolation, sync     |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|  PHASE 6: Audio Synthesis, VFX Polish, Vercel Production & QA                     |
|  - Web Audio engine sound, tire smoke/sparks, Vercel deploy, mobile field testing  |
+-----------------------------------------------------------------------------------+
```

---

## Detailed Phase Breakdown

### Phase 1: Foundation, Tooling & WebRTC Gyroscope Remote Controller
* **Goals:**
  * Initialize repository with Vite + React 19 + TypeScript + Tailwind CSS.
  * Implement desktop pairing modal with dynamic SVG QR code generation.
  * Build the mobile controller page (`/controller`) with DeviceOrientation permission handshake, screen wake lock, and low-pass filtered tilt calculation.
  * Establish WebRTC P2P DataChannel connection via PeerJS with fallback signaling.
* **Verification & Acceptance Criteria:**
  * QR code scans directly from phone camera without third-party apps.
  * Moving the phone streams smooth steering data ($-90^\circ$ to $+90^\circ$) to the desktop with $< 20\text{ ms}$ roundtrip latency.
  * "Recalibrate Center" resets neutral position instantly.

---

### Phase 2: High-Fidelity 3D Rendering & Raycast Vehicle Physics
* **Goals:**
  * Configure Three.js scene with ACESFilmicToneMapping, HDR environment map, and soft shadows.
  * Integrate `@dimforge/rapier3d-compat` physics world with a Raycast Vehicle controller.
  * Implement realistic sports car body (PBR clearcoat metallic paint, glowing LED headlights/taillights, spinning wheels).
  * Map both Keyboard (WASD) and Gyroscope/Touch inputs seamlessly into vehicle throttle, steering angle, braking force, and handbrake slip.
* **Verification & Acceptance Criteria:**
  * Car drives smoothly with realistic acceleration curves, suspension bounce, and weight transfer.
  * Steering via phone feels analog and responsive; drifting feels controlled with counter-steering.
  * Stable 60 FPS maintained in WebGL viewport.

---

### Phase 3: Scenic Highway Track & Asphalt 9-Style Cinematic Jump Ramps
* **Goals:**
  * Construct a Catmull-Rom spline road system with 3 lanes, asphalt road markings, metal guardrails, and dynamic banking on turns.
  * Create scenic autumn environment: instanced colorful autumn trees, road signs, distant mountains, and golden-hour skybox.
  * Build ramp kickers that launch the vehicle airborne.
  * Implement the **Cinematic Jump Camera State Machine**:
    * Detect airtime ($V_y > 8\text{ m/s}$ and ungrounded wheels).
    * Smoothly cut to low Dutch-tilt tracking angle with letterbox borders and temporary $0.75\times$ time dilation.
    * Recover to chase camera upon suspension compression on landing.
* **Verification & Acceptance Criteria:**
  * Driving along the highway feels scenic, winding, and visually rich (non-blocky, AAA feel).
  * Hitting ramps triggers dramatic, Hollywood-style jump camera dynamics without disorienting the player.

---

### Phase 4: Dynamic Obstacle Traffic AI & Interactive Minimap HUD
* **Goals:**
  * Implement procedural civilian traffic spawner ahead of the player with realistic speeds and lane-keeping AI.
  * Add vehicle-to-vehicle collision detection, scraping sparks particle system, and near-miss bonus detections.
  * Build an interactive curved vector minimap showing track layout, current player position, upcoming turns, and traffic blips.
* **Verification & Acceptance Criteria:**
  * Traffic adds realistic urgency to driving; overtaking between cars rewards score/nitro.
  * Minimap updates in real-time with zero frame drops.

---

### Phase 5: Supabase Integration & Real-Time Multiplayer Racing
* **Goals:**
  * Connect Supabase project for rooms, player profiles, and leaderboards.
  * Implement Room creation (`/create`) and join via 6-digit room code (`/join`).
  * Synchronize opponent positions and rotations over WebRTC / Supabase Realtime using Hermite cubic interpolation and dead-reckoning.
  * Multiplayer minimap showing all connected competitors with custom color tags.
* **Verification & Acceptance Criteria:**
  * 2 to 4 players can enter the same room code, see each other's cars, and race with smooth position synchronization.

---

### Phase 6: Audio Synthesis, VFX Polish, Vercel Production & QA
* **Goals:**
  * Integrate procedural Web Audio API engine sound (dynamic RPM pitch), tire squeal on drift, nitro sound, and crash audio.
  * Add particle systems for tire smoke trails, nitro exhaust plumes, and impact sparks.
  * Configure production build optimizations (tree shaking, texture compression, lazy loading).
  * Deploy to Vercel and verify live performance on various devices (iOS Safari, Android Chrome, Windows PC, Mac).
* **Verification & Acceptance Criteria:**
  * Production URL loads in $< 3$ seconds on desktop and mobile.
  * Game is completely playable end-to-end with both keyboard and phone gyro.
  * All documentation and code committed cleanly to GitHub.
