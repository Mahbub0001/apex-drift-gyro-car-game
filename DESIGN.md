# Game Design & UI/UX Specification (DESIGN.md)
## Project Name: Apex Drift: Web & Gyro
**Design Language:** Cyber-Tactile Glassmorphism & High-Octane Arcade Realism  
**Target Visual Fidelity:** AAA Browser 3D (Non-AI Aesthetic, Console Feel)  

---

## 1. Art Direction & Visual Aesthetics

### 1.1 Aesthetic Philosophy
Apex Drift rejects blocky, voxel, or low-poly toy designs. Instead, the game adopts a **photorealistic arcade aesthetic** inspired by *Forza Horizon 4* (Autumn countryside) and *Asphalt 9: Legends* (high-speed cinematic spectacle).

```
+-----------------------------------------------------------------------------------+
|                              VISUAL FIDELITY PILLARS                              |
|                                                                                   |
|  1. Realistic Car Paint     2. Scenic Autumn Track     3. Asphalt 9 Jump Cam      |
|  - Dual-coat clearcoat      - Wet-look asphalt tarmac  - Slow-mo time dilation    |
|  - Realtime HDR reflections - Golden hour sun glare    - Low-angle Dutch tilt     |
|  - Emissive LED light bars  - Instanced autumn foliage - Cinematic letterboxing   |
|  - Metallic flake shimmer   - Guardrail reflections    - Dynamic radial blur      |
+-----------------------------------------------------------------------------------+
```

### 1.2 Color Palette & Design Tokens
* **Void Background:** `#08090C` (Deepest carbon black)
* **Cockpit Surface:** `rgba(18, 20, 29, 0.75)` with `backdrop-filter: blur(16px)`
* **Turbo Cyan (Primary Accent):** `#00F2FE` (Speed, telemetry, standard nitro)
* **Electric Violet (Secondary Accent):** `#8A2BE2` / `#A855F7` (Drift zones, gyro tilt)
* **Redline Crimson (Critical Alert):** `#FF0055` (Max RPM, crashes, brake lights)
* **Gold Amber (Rewards & Ranks):** `#FFB800` (Near-miss combos, 1st place badge)

---

## 2. In-Game Desktop HUD Layout

```
+-----------------------------------------------------------------------------------+
| [1st / 4]  LAP 1/2   TIME 01:24.32                    [ROOM: DRIFT7]  PING 14ms   |
|                                                                                   |
|                                                                                   |
|                                                                                   |
|                                                                                   |
|                                  [GAME WORLD]                                     |
|                                                                                   |
|                                                                                   |
|                                                                                   |
|  +--------------------+                                   +--------------------+  |
|  |     MINIMAP        |                                   |    TACHOMETER      |  |
|  |  (Curved Road,     |                                   |   184 KM/H  [GEAR4]|  |
|  |   Player & Traffic)|                                   |   [||||||||||..]RPM|  |
|  +--------------------+                                   +--------------------+  |
|  [P1: Cyan] [P2: Amber]                                   [NITRO: ============]   |
+-----------------------------------------------------------------------------------+
```

### 2.1 HUD Components Detail
1. **Interactive Vector Minimap (Bottom-Left):**
   * High-contrast curved track rendering with directional glowing player blip.
   * Civilian traffic rendered as subtle amber/gray dots.
   * Multiplayer rivals rendered with distinct team colors and floating nametags.
2. **Radial Tachometer & Gear Indicator (Bottom-Right):**
   * Curving digital tachometer arc sweeping from $0$ to $9000\text{ RPM}$.
   * High-impact digital speedometer font (Rajdhani/Chakra Petch Bold).
   * Segmented Nitro booster bar glowing with cyan/purple particle discharge when active.
3. **Dynamic Event Notifications (Center Screen Overlay):**
   * "NEAR MISS! +150 NITRO"
   * "DRIFT COMBO 840 PTS (x2.5)"
   * "AIR TIME! 1.4s"

---

## 3. Asphalt 9-Style Cinematic Jump System

When the vehicle hits an elevation kicker or ramp:
1. **Airborne Trigger:** Physics engine flags all four raycast wheels as ungrounded and vertical velocity $V_y > 8.0\text{ m/s}$.
2. **Camera Transition:**
   * Instant smooth interpolation from rear chase position to a **Low-Angle Dutch-Tilt Side Camera** ($30^\circ$ roll offset, tilted up towards the car undercarriage).
   * Field of View snaps from $65^\circ \to 80^\circ$ creating a dramatic sense of scale and altitude.
3. **Cinematic Letterboxing:** Sleek $2.35:1$ cinematic black bars glide into the top and bottom of the desktop display.
4. **Time Dilation:** Game physics momentarily scales to $0.75\times$ speed for $0.8$ seconds, heightening tension.
5. **Impact Landing:** On tire touchdown:
   * Subtle camera shake ($0.15$ intensity damping over $300\text{ ms}$).
   * Spark and tire puff particles burst from the wheel arches.
   * Letterbox bars smoothly retract and camera snaps back to rear chase alignment.

---

## 4. Mobile Web Controller UI/UX (Smartphone Landscape)

The mobile controller is engineered specifically for two-thumb ergonomics with zero clutter.

```
+-----------------------------------------------------------------------------------+
| [GYRO CALIBRATE]                  STEERING HUD                [FULLSCREEN] [VIBE] |
|                                                                                   |
|  +-------------+                 /-------------\                 +-------------+  |
|  |             |                |     24°       |                |             |  |
|  |    BRAKE    |                |    RIGHT      |                |     GAS     |  |
|  |   SLIDER    |                |               |                |   SLIDER    |  |
|  |             |                 \-------------/                 |             |  |
|  +-------------+                                                 +-------------+  |
|                                                                                   |
|  [ HANDBRAKE ]                    [ RE-CENTER ]                  [ NITRO BURST ]  |
+-----------------------------------------------------------------------------------+
```

### 4.1 Zone Breakdown
* **Center Gyroscope Telemetry:**
  * Animated circular angle gauge that dynamically rotates with the physical phone tilt.
  * Real-time numeric degree indicator (e.g. `0°`, `18° LEFT`, `45° RIGHT`).
  * Glow intensity increases dynamically as the angle sharpens.
* **Right Hand (Dominant Drive):**
  * Vertical touch slider for analog Gas/Throttle. Floating thumb capture allows the player to place their thumb anywhere on the right half without missing.
  * Dedicated "NITRO BURST" button located directly beneath the thumb rest.
* **Left Hand (Braking & Drift):**
  * Vertical touch slider for analog Brake / Reverse.
  * Dedicated "HANDBRAKE" button for initiating instant drift oversteer.
* **Top Header Controls:**
  * "Recalibrate Center" button (tappable at any moment to set the current physical tilt as $0^\circ$).
  * Connection health badge (`P2P ACTIVE: 12ms`).
  * Haptic vibration toggle & Fullscreen toggle.

---

## 5. Obstacle Civilian Traffic Design

* **Traffic Models:** 3 detailed realistic civilian models (Executive Sedan, Compact SUV, Box Delivery Truck).
* **AI Pathfinding Behavior:**
  * Civilian cars maintain steady cruising speeds in designated road lanes.
  * Tail lights light up if an obstacle appears ahead.
  * Natural turn-signal blinkers before executing lane changes.
* **Collision Feedback:**
  * Scraping: Showers of high-velocity orange sparks, metallic friction screech audio, and light directional impulse.
  * Direct Impact: Physical collision rebound, hood denting/crumple visual effect, speed loss, and phone haptic vibration shudder.

---

## 6. Procedural Audio & Haptic Feedback Architecture

### 6.1 Audio Frequency Mapping
* **Idle Engine:** $800\text{ RPM} \to 45\text{ Hz}$ dual-sawtooth drone.
* **Accelerating:** Linear frequency modulation up to $8500\text{ RPM} \to 680\text{ Hz}$ with sub-harmonic distortion.
* **Gear Shifts:** Instantaneous $120\text{ ms}$ drop in frequency accompanied by a turbo blow-off valve hiss (`BiquadFilterNode` highpass sweep).
* **Tire Slip / Drift:** White noise bandpassed at $1200\text{ Hz}$ modulating with lateral G-force.

### 6.2 Mobile Haptic Patterns
* **Gear Upshift:** Short tactile pulse (`vibrate(25)`).
* **Tire Loss of Traction / Curb Rumble:** Intermittent micro-pulses (`vibrate([15, 30, 15])`).
* **Nitro Ignition:** Prolonged energetic buzz (`vibrate([40, 20, 80])`).
* **Crash Impact:** Heavy dual-impact shudder (`vibrate([100, 50, 150])`).
