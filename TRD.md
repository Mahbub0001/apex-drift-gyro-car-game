# Technical Requirements Document (TRD)
## Project Name: Apex Drift: Web & Gyro
**Document Version:** 1.0.0  
**Target Environments:** Modern Web Browsers (Chrome, Edge, Safari, Firefox)  
**Deployment Platform:** Vercel (Frontend & Static Assets) + Supabase / WebRTC Signaling  

---

## 1. System Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                                 DESKTOP HOST CLIENT                               |
|                                                                                   |
|  +--------------------+   +-----------------------+   +------------------------+  |
|  |  Three.js WebGL    |   |  Rapier.js Physics    |   |  Cinematic Camera      |  |
|  |  - PBR Car Shaders |   |  - Raycast Vehicle    |   |  - Dynamic FOV         |  |
|  |  - Spline Road Mesh|   |  - Suspension & Wheels|   |  - Jump Action Cam     |  |
|  |  - Post-Processing |   |  - Obstacle Colliders |   |  - Drift Counter Cam   |  |
|  +--------------------+   +-----------------------+   +------------------------+  |
|             ^                         ^                            ^              |
|             |                         |                            |              |
|             +-------------------------+----------------------------+              |
|                                       |                                           |
|                           +-----------------------+                               |
|                           |   Input Manager Engine|                               |
|                           |   (Keyboard / Gyro)   |                               |
|                           +-----------------------+                               |
|                                       ^                                           |
|                                       | WebRTC DataChannel (Unordered/Unreliable) |
+---------------------------------------|-------------------------------------------+
                                        | (P2P Direct Network, Ping < 15ms)
+---------------------------------------v-------------------------------------------+
|                              MOBILE WEB CONTROLLER                                |
|                                                                                   |
|  +--------------------+   +-----------------------+   +------------------------+  |
|  | DeviceOrientation  |   | Math Filter Pipeline  |   | Mobile HUD & Pedals    |  |
|  | - Gamma / Beta Axis|   | - Low-Pass EMA Filter |   | - Touch Gas Slider     |  |
|  | - 60Hz Polling Rate|   | - Deadzone & Exponents|   | - Touch Brake Slider   |  |
|  | - Zero Drift Offset|   | - Angle Normalization |   | - Haptics (Vibrate API)|  |
|  +--------------------+   +-----------------------+   +------------------------+  |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|                        BACKEND & MULTIPLAYER CLOUD SERVICES                       |
|                                                                                   |
|  +--------------------+   +-----------------------+   +------------------------+  |
|  | Supabase Realtime  |   | PeerJS / STUN/TURN    |   | PostgreSQL Database    |  |
|  | - Room Matchmaking |   | - WebRTC Signaling    |   | - User Profiles & XP   |  |
|  | - Lobby State Sync |   | - NAT Traversal       |   | - Global Leaderboards  |  |
|  +--------------------+   +-----------------------+   +------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Technology Stack & Specifications

### 2.1 Core Frameworks & Libraries
* **Build System & Runtime:** Vite 6 + React 19 + TypeScript (Strict Mode).
* **3D Graphics Engine:** `three` (r172+) with WebGL 2.0 and optional WebGPU fallback.
* **Physics Engine:** `@dimforge/rapier3d-compat` (WASM-based high-performance physics engine with native Raycast Vehicle model).
* **Post-Processing:** `@react-three/postprocessing` or Three.js native `EffectComposer` (UnrealBloomPass, SMAAPass, Vignette, ChromaticAberration).
* **Networking & Communications:**
  * Peer-to-Peer Controller: WebRTC `RTCDataChannel` via `peerjs`.
  * Multiplayer Lobby Sync: Supabase Realtime (WebSockets) + REST API.
* **Audio Synthesis:** Native Web Audio API (`AudioContext`, procedural engine audio synthesis, spatial sound nodes).
* **UI & Styling:** Tailwind CSS v4, Lucide Icons, Framer Motion for desktop HUD and mobile cockpit.

---

## 3. Gyroscope Sensor & Input Pipeline

### 3.1 Device Orientation Extraction
* Mobile browsers report angles via `window.addEventListener('deviceorientation', handleOrientation)`.
* In Landscape mode:
  * Steering axis uses `event.gamma` (or `event.beta` depending on landscape-left vs landscape-right orientation, normalized using `window.screen.orientation.angle`).
  * Target raw steering angle: $\theta \in [-90^\circ, +90^\circ]$.

### 3.2 Filtering & Anti-Jitter Algorithm (Exponential Moving Average)
Raw accelerometer/gyroscope sensors have high-frequency thermal and micro-hand jitter. We apply a calibrated Low-Pass Filter:
$$\theta_{\text{filtered}}(t) = \alpha \cdot \theta_{\text{raw}}(t) + (1 - \alpha) \cdot \theta_{\text{filtered}}(t - \Delta t)$$
* Standard $\alpha = 0.35$ (provides responsive steering while eliminating noisy vibration).

### 3.3 Deadzone & Non-Linear Sensitivity Shaping
To ensure precision in straight highway driving and aggressive steering in hairpins:
1. **Deadzone:** If $|\theta| < 2.5^\circ$, normalized steer output is $0.0$.
2. **Exponential Curve:**
   $$x = \frac{|\theta| - \text{deadzone}}{90^\circ - \text{deadzone}}$$
   $$\text{Steer}(x) = \text{sign}(\theta) \times x^{1.4}$$
   The power of $1.4$ allows micro-adjustments near center while retaining maximum steering lock at wide angles.

### 3.4 Zero-Calibration Offset
Players may hold phones at varying resting tilts. The "Calibrate" action stores $\theta_{\text{offset}} = \theta_{\text{current}}$, and all future inputs compute $\theta = \theta_{\text{raw}} - \theta_{\text{offset}}$.

### 3.5 Packet Protocol (WebRTC Binary Packets)
Packets are transmitted at 60 Hz over an unreliable, unordered `RTCDataChannel` using a compact Float32Array (16 bytes payload):
```
[0]: Steer Float (-1.0 to +1.0)
[1]: Throttle Float (0.0 to 1.0)
[2]: Brake Float (0.0 to 1.0)
[3]: Bitmask Flags (Bit 0: Handbrake, Bit 1: Nitro, Bit 2: Reset, Bit 3: CamSwitch)
```

---

## 4. 3D Graphics, Environment & Vehicle Engine

### 4.1 Vehicle Model & PBR Clearcoat Shaders
* **Car Body Material:** `MeshPhysicalMaterial` with:
  * `roughness`: 0.15
  * `metalness`: 0.85
  * `clearcoat`: 1.0
  * `clearcoatRoughness`: 0.05
  * `reflectivity`: 1.0
* **Equirectangular Environment Map:** HDR skybox (sunset golden hour with high dynamic range reflections on car curves).
* **Lighting Rig:**
  * Directional Sun light with Cascaded Shadow Maps (CSM) or dynamic soft shadows.
  * Ambient fill hemisphere light.
  * Point lights on car headlights and rear red LED light bars with emissive materials.

### 4.2 Spline-Based Dynamic Road Generation
* Catmull-Rom 3D Curve defines the highway geometry.
* Road cross-section extruded along the curve with:
  * 3 lanes in each direction with dashed white road markings.
  * Concrete side barriers and steel guardrails with collision bounds.
  * Road banking: dynamically banked corners ($5^\circ$ to $12^\circ$) on high-speed turns.
  * Environment clutter: Instanced meshes for autumn trees, roadside lamps, rocks, and distance mountain billboards.

### 4.3 Asphalt 9-Style Cinematic Camera System
The camera controller is a state machine:
1. **State 1: Chase Cam (Default Driving)**
   * Position interpolated smoothly behind the vehicle with spring-damper physics.
   * Dynamic Field of View (FOV): Base $60^\circ \to 78^\circ$ at top speed + Nitro.
2. **State 2: Drift Cam**
   * Sways slightly to the outside of the drift arc, framing the car's slide angle.
3. **State 3: Cinematic Airborne Jump Cam (Asphalt 9 Inspired)**
   * **Trigger Condition:** Car hits a jump ramp, vertical velocity $V_y > 8\text{ m/s}$, and all 4 wheels airborne.
   * **Behavior:** Camera transitions to a low, dynamic Dutch-tilt angle tracking the car from the 3/4 front-quarter view.
   * **Effects:** Radial speed blur vignette, subtle slow-motion time dilation ($0.75\times$ speed factor for 0.8 seconds), camera shake on heavy impact landing, and instant blend back to Chase Cam.

---

## 5. Traffic Obstacle Simulation & Raycast Physics

### 5.1 Civilian Traffic AI
* Waypoint-following civilian cars (Sedan, SUV, Truck).
* Spawned within a dynamic window $[+80\text{ m}, +400\text{ m}]$ ahead of the player.
* Speed randomized between $60\text{ km/h}$ and $110\text{ km/h}$.
* Lane-keeping logic with smooth lane shifts and obstacle-avoidance raycasting.

### 5.2 Collision & Scraping Physics
* Rapier RigidBody colliders on all vehicles.
* High-speed collisions calculate impulse vector:
  * Glancing blow: Triggers scrape sparks (particle system) and speed reduction.
  * Direct crash: Vehicle spins out, triggering screen shake, dramatic audio crash thud, and controller haptic vibration.

---

## 6. Procedural Web Audio Engine

No external heavy sound files required for core engine mechanics:
* **Engine Sound:** Web Audio API procedural synthesis using 2 detuned saw-tooth oscillators feeding into a `BiquadFilterNode` whose cutoff frequency and gain modulate linearly with engine RPM ($800\text{ RPM} \to 8500\text{ RPM}$).
* **Tire Screech:** White noise buffer passed through a high-Q bandpass filter ($800\text{ Hz} - 1800\text{ Hz}$), dynamically amplified whenever lateral tire slip ratio $> 0.25$.
* **Nitro Whoosh & Exhaust Pops:** Sub-bass rumble combined with resonant high-pass noise burst and randomized backfire pops.

---

## 7. Real-Time Minimap & Vector HUD

* 2D Canvas or SVG layer rendered at 60 FPS in the HUD overlay.
* Computes player position relative to track spline coordinates $(u, v)$.
* Translates track curvature into local mini-map coordinates.
* Draws player arrow (red/cyan), traffic obstacle dots (gray), and remote multiplayer opponents (yellow/purple blips with username badges).

---

## 8. Multiplayer Architecture & State Synchronization

* **Lobby Management:** Supabase Realtime channel for room discovery, player ping, car selection, and countdown sync.
* **In-Game State Replication:**
  * Host-authoritative or Client-predicted snapshot synchronization.
  * Every $50\text{ ms}$ (20 Hz), players broadcast their compact state:
    $$\{ \vec{P}_{x,y,z}, \vec{Q}_{x,y,z,w}, \vec{V}_{x,y,z}, \text{steeringAngle}, \text{nitroActive} \}$$
  * Remote clients use Hermite / Catmull-Rom cubic interpolation with a $60\text{ ms}$ jitter buffer for buttery-smooth opponent vehicle rendering.
