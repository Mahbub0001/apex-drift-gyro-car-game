# Product Requirements Document (PRD)
## Project Name: Apex Drift: Web & Gyro
**Subtitle:** Next-Gen Browser Racing with Zero-Install Smartphone Gyroscope Wheel  
**Document Version:** 1.0.0  
**Status:** Approved for Architecture & Implementation  

---

## 1. Executive Summary & Vision

**Apex Drift** is an ultra-responsive, visually stunning, browser-based arcade racing game engineered with modern WebGL/WebGPU technologies (Three.js + Rapier WASM Physics). 

The game delivers a console-grade racing experience directly in the desktop browser with zero downloads, while pioneering a **Zero-Friction Dual-Screen Controller**:
* Players open the game on their PC or laptop screen.
* With standard input, players can immediately drive using their Keyboard (WASD / Arrows) or standard Gamepad.
* As the **Killer Feature**, a dynamic QR code on screen allows players to scan using any modern smartphone camera. Without installing any app, the mobile browser opens an ultra-ergonomic, low-latency Web Steering Wheel with haptic feedback, real-time tilt angle HUD, and analogue pedals.
* Features dynamic obstacle traffic, procedural or spline-based scenic highway environments (autumn mountain passes, coastal expressways), Asphalt 9-style cinematic jump cameras, an interactive real-time minimap, and both Single Player and Real-Time Multiplayer modes.

---

## 2. Target Audience & Core Value Proposition

1. **Casual & Enthusiast Web Gamers:** Players who want the visual thrills of *Forza Horizon* or *Asphalt 9* without a 90 GB download or expensive wheel peripheral.
2. **Social & Party Gaming:** Instant multiplayer room lobbies where friends scan QR codes on their phones and race against each other on a shared display or online.
3. **Showcase of Web Capabilities:** Pushing the boundaries of WebGL, Web Audio, WebRTC, and Device Orientation APIs to deliver a 60 FPS AAA-level aesthetic.

---

## 3. High-Level Game Modes & Features

### 3.1 Game Modes
* **Single Player - Traffic Rush:** Drive through dynamic scenic highways dodging randomized civilian traffic, taking jumps, drifting around hairpin turns, and achieving high-speed combo scores.
* **Single Player - Time Attack:** Ghost car racing on designated track layouts with high-precision lap timings and global leaderboards.
* **Multiplayer - Custom Lobby (1v1 to 4 Players):** Create or join private rooms with unique room codes. Real-time vehicle position synchronization, synchronized traffic obstacles, and dynamic live minimap tracking.

### 3.2 Vehicle & Driving Mechanics
* **Realistic Raycast Vehicle Physics:** Realistic suspension travel, tire friction slip curves, chassis inertia, roll stabilization, and authentic weight transfer.
* **Drift Dynamics:** Handbrake-initiated oversteer with controllable counter-steering via smartphone gyroscope tilt or keyboard.
* **Nitro Boost System:** Rechargeable nitro gauge fueled by clean overtakes, high-speed drifts, and airtime. Visual warp-speed effects, FOV expansion, and exhaust flames.
* **Cinematic Jump Dynamics (Asphalt 9 Style):** Hitting ramp obstacles launches the car into dramatic airtime. The camera shifts into a dynamic cinematic tracking angle with subtle time dilation / dynamic motion blur, smoothly snapping back to chase-cam upon landing.

### 3.3 Dynamic Obstacle Traffic System
* Procedural or waypoint-governed civilian cars (sedans, SUVs, trucks) driving at realistic speeds in traffic lanes.
* Dynamic collision boxes: clipping or hitting traffic triggers sparks, paint scrapes, speed penalty, and physical rebound.
* "Near-Miss" reward mechanism that boosts score and nitro gauge.

### 3.4 Interactive Minimap System
* **Curved Vector Minimap (Radial & Full Track):** Positioned in the corner HUD.
* **Single Player:** Renders current track section, player indicator, upcoming corners, and nearby obstacle traffic dots.
* **Multiplayer:** Renders live colored blips for all connected players with player tags, position ranks (1st, 2nd, 3rd), and distance gaps.

---

## 4. Control Paradigm: Dual-Screen Web Gyroscope

### 4.1 Onboarding Flow (Zero-Install)
1. **Desktop Host:** Displays a sleek HUD widget with "Connect Gyro Wheel" button -> Opens high-resolution QR Code containing `https://<domain>/controller?room=<ROOM_ID>&token=<SESSION_TOKEN>`.
2. **Mobile Device:** User scans QR code with standard iOS/Android camera.
3. **Permission Handshake:** Mobile page prompts "Tap to Start Engine" (satisfying iOS Safari `DeviceOrientationEvent.requestPermission()` security requirements and activating the Screen Wake Lock API).
4. **Instant Pairing:** P2P WebRTC DataChannel connects in $< 500\text{ ms}$. Phone immediately transforms into a landscape digital racing cockpit.

### 4.2 Mobile Controller Cockpit UI/UX
* **Center Display:** Real-time steering angle readout in degrees ($-90^\circ$ to $+90^\circ$), digital speedometer, current gear, and connection ping.
* **Right Thumb Zone:** Vertical touch-slider for Throttle (Gas) with linear resistance; Quick-tap Nitro Burst button.
* **Left Thumb Zone:** Vertical touch-slider for Brake / Reverse; Thumb-tap Handbrake (E-Brake) button for initiating drifts.
* **Header Bar:** "Recalibrate Center" button (sets current phone orientation as neutral $0^\circ$), Haptic toggle, Fullscreen toggle.
* **Haptics:** Device vibration on engine redline, curbs, crashes, and nitro ignition via `navigator.vibrate`.

### 4.3 Fallback Inputs
* **Desktop Keyboard:** Standard WASD / Arrow keys, Space (Handbrake), Shift (Nitro), C (Camera Switch), R (Reset Car).
* **Gamepad:** Native HTML5 Gamepad API support (Xbox / PlayStation / generic controllers).

---

## 5. Non-Functional Requirements & Performance Targets

| Metric | Target Standard | Notes |
| :--- | :--- | :--- |
| **Frame Rate** | Locked 60 FPS (90/120 FPS on high-refresh) | On standard GTX 1650 / Apple M1 or equivalent modern GPU. |
| **Input Latency (Gyro to PC)** | $\le 15\text{ ms}$ (Local Wi-Fi P2P) / $\le 35\text{ ms}$ (Relayed) | WebRTC DataChannel unordered/unreliable UDP mode. |
| **Initial Asset Load** | $< 15\text{ MB}$ compressed initial bundle | Draco-compressed GLB models and KTX2/Basis textures. |
| **Mobile Battery & Thermals** | Low CPU/GPU load on mobile | Mobile controller runs lightweight 2D canvas/HTML5 without 3D overhead. |
| **Screen Persistence** | Zero screen timeout during gameplay | Utilizes `navigator.wakeLock.request('screen')`. |
| **Browser Compatibility** | Chrome, Edge, Safari, Firefox (Desktop & Mobile) | WebGL 2.0 / WebRTC standards compliant. |

---

## 6. Success Metrics & Quality Criteria

1. **Non-AI Aesthetic:** The visual presentation, typography, audio synthesis, and lighting must feel handcrafted, polished, and commercial-grade (modern dark-mode glassmorphic styling, bespoke racing typography, realistic PBR car paint shaders).
2. **Physical Tangibility:** The car must have palpable weight, realistic tire screeching on lateral drift slip, and suspension dip under heavy braking.
3. **Frictionless Sharing:** A user can share a room link with a friend and be racing within 10 seconds.
