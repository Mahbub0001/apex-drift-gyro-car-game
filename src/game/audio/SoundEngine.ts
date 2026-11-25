export class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // 1. Engine Core Synthesis
  private subOsc: OscillatorNode | null = null;
  private mainOsc: OscillatorNode | null = null;
  private harmOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private exhaustFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private distortionNode: WaveShaperNode | null = null;

  // 2. Turbocharger Spool & Blow-Off Valve
  private turboOsc: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;
  private lastThrottle: number = 0;
  private lastRpm: number = 850;
  private noiseBuffer: AudioBuffer | null = null;

  // 3. High-Speed Aerodynamic Wind Rush
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  // 4. Tire Skid & Drift Screech
  private skidSource: AudioBufferSourceNode | null = null;
  private skidFilter: BiquadFilterNode | null = null;
  private skidGain: GainNode | null = null;

  // 5. Nitro Roar
  private nitroSource: AudioBufferSourceNode | null = null;
  private nitroFilter: BiquadFilterNode | null = null;
  private nitroGain: GainNode | null = null;

  // 6. Curb Rumble Strip & Ceramic Brake Squeal
  private curbOsc: OscillatorNode | null = null;
  private curbFilter: BiquadFilterNode | null = null;
  private curbGain: GainNode | null = null;
  private brakeSquealOsc: OscillatorNode | null = null;
  private brakeSquealGain: GainNode | null = null;

  // Master Gain
  private masterGain: GainNode | null = null;

  // Backfire timer
  private nextBackfireTime: number = 0;

  constructor() {
    // Initialized on first user interaction
  }

  public init() {
    if (this.isInitialized) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.85, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Procedural White Noise Buffer
      const sampleRate = this.ctx.sampleRate;
      const noiseSecs = 2.5;
      const noiseBuffer = this.ctx.createBuffer(1, sampleRate * noiseSecs, sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = noiseBuffer;

      // ----------------------------------------------------
      // A. Supercar V8/V10 Engine Synthesizer
      // ----------------------------------------------------
      // Sub-bass engine block rumble
      this.subOsc = this.ctx.createOscillator();
      this.subOsc.type = 'triangle';
      this.subOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

      // Cylinder combustion firing pulses
      this.mainOsc = this.ctx.createOscillator();
      this.mainOsc.type = 'sawtooth';
      this.mainOsc.frequency.setValueAtTime(60, this.ctx.currentTime);

      // Upper mechanical harmonics
      this.harmOsc = this.ctx.createOscillator();
      this.harmOsc.type = 'sawtooth';
      this.harmOsc.frequency.setValueAtTime(120, this.ctx.currentTime);

      // Warm analog-style tube distortion for throaty roar
      this.distortionNode = this.ctx.createWaveShaper();
      this.distortionNode.curve = this.makeDistortionCurve(18);
      this.distortionNode.oversample = '2x';

      // Acoustic exhaust filters
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
      this.engineFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

      this.exhaustFilter = this.ctx.createBiquadFilter();
      this.exhaustFilter.type = 'peaking';
      this.exhaustFilter.frequency.setValueAtTime(280, this.ctx.currentTime);
      this.exhaustFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);
      this.exhaustFilter.gain.setValueAtTime(7.0, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.24, this.ctx.currentTime);

      // Wire engine synthesis graph
      this.subOsc.connect(this.engineGain);
      this.mainOsc.connect(this.distortionNode);
      this.harmOsc.connect(this.distortionNode);
      this.distortionNode.connect(this.engineFilter);
      this.engineFilter.connect(this.exhaustFilter);
      this.exhaustFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.subOsc.start();
      this.mainOsc.start();
      this.harmOsc.start();

      // ----------------------------------------------------
      // B. Turbocharger High-Pitch Spool
      // ----------------------------------------------------
      this.turboOsc = this.ctx.createOscillator();
      this.turboOsc.type = 'sine';
      this.turboOsc.frequency.setValueAtTime(1300, this.ctx.currentTime);

      this.turboGain = this.ctx.createGain();
      this.turboGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.turboOsc.connect(this.turboGain);
      this.turboGain.connect(this.masterGain);
      this.turboOsc.start();

      // ----------------------------------------------------
      // C. High-Speed Aerodynamic Wind Rush
      // ----------------------------------------------------
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.setValueAtTime(500, this.ctx.currentTime);
      this.windFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

      this.windGain = this.ctx.createGain();
      this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.masterGain);

      this.windSource = this.ctx.createBufferSource();
      this.windSource.buffer = noiseBuffer;
      this.windSource.loop = true;
      this.windSource.connect(this.windFilter);
      this.windSource.start();

      // ----------------------------------------------------
      // D. Tire Skid & Drift Screech
      // ----------------------------------------------------
      this.skidFilter = this.ctx.createBiquadFilter();
      this.skidFilter.type = 'bandpass';
      this.skidFilter.frequency.setValueAtTime(1600, this.ctx.currentTime);
      this.skidFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

      this.skidGain = this.ctx.createGain();
      this.skidGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.skidFilter.connect(this.skidGain);
      this.skidGain.connect(this.masterGain);

      this.skidSource = this.ctx.createBufferSource();
      this.skidSource.buffer = noiseBuffer;
      this.skidSource.loop = true;
      this.skidSource.connect(this.skidFilter);
      this.skidSource.start();

      // ----------------------------------------------------
      // E. Nitro Rocket Jet
      // ----------------------------------------------------
      this.nitroFilter = this.ctx.createBiquadFilter();
      this.nitroFilter.type = 'lowpass';
      this.nitroFilter.frequency.setValueAtTime(750, this.ctx.currentTime);
      this.nitroFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

      this.nitroGain = this.ctx.createGain();
      this.nitroGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.nitroFilter.connect(this.nitroGain);
      this.nitroGain.connect(this.masterGain);

      this.nitroSource = this.ctx.createBufferSource();
      this.nitroSource.buffer = noiseBuffer;
      this.nitroSource.loop = true;
      this.nitroSource.connect(this.nitroFilter);
      this.nitroSource.start();

      // ----------------------------------------------------
      // F. Apex Curb Rumble Strip Synthesizer
      // ----------------------------------------------------
      this.curbOsc = this.ctx.createOscillator();
      this.curbOsc.type = 'sawtooth';
      this.curbOsc.frequency.setValueAtTime(65, this.ctx.currentTime);

      this.curbFilter = this.ctx.createBiquadFilter();
      this.curbFilter.type = 'lowpass';
      this.curbFilter.frequency.setValueAtTime(140, this.ctx.currentTime);

      this.curbGain = this.ctx.createGain();
      this.curbGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.curbOsc.connect(this.curbFilter);
      this.curbFilter.connect(this.curbGain);
      this.curbGain.connect(this.masterGain);
      this.curbOsc.start();

      // ----------------------------------------------------
      // G. High-Performance Carbon Ceramic Brake Squeal
      // ----------------------------------------------------
      this.brakeSquealOsc = this.ctx.createOscillator();
      this.brakeSquealOsc.type = 'sine';
      this.brakeSquealOsc.frequency.setValueAtTime(2850, this.ctx.currentTime);

      this.brakeSquealGain = this.ctx.createGain();
      this.brakeSquealGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.brakeSquealOsc.connect(this.brakeSquealGain);
      this.brakeSquealGain.connect(this.masterGain);
      this.brakeSquealOsc.start();

      this.isInitialized = true;
    } catch (e) {
      console.warn('[SoundEngine] AudioContext init failed:', e);
    }
  }

  // Soft saturation distortion curve
  private makeDistortionCurve(amount: number = 20): Float32Array {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public update(
    rpm: number,
    speedKmh: number,
    isDrifting: boolean,
    isNitro: boolean,
    throttle: number = 0,
    isOnCurb: boolean = false,
    isBraking: boolean = false
  ) {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const clampedRpm = Math.max(800, Math.min(8800, rpm));
    const rpmFactor = clampedRpm / 8800;

    // 1. Precise 4-Stroke Engine Cylinder Pulse Firing Frequency
    const baseFreq = Math.max(36, (clampedRpm / 60) * 1.85);
    const subFreq = baseFreq * 0.5;
    const harmFreq = baseFreq * 2.05;

    if (this.subOsc && this.mainOsc && this.harmOsc) {
      this.subOsc.frequency.setTargetAtTime(subFreq, now, 0.04);
      this.mainOsc.frequency.setTargetAtTime(baseFreq, now, 0.04);
      this.harmOsc.frequency.setTargetAtTime(harmFreq, now, 0.04);
    }

    // 2. Dynamic Engine Load Acoustic Response (Throttle open vs closed)
    if (this.engineFilter && this.exhaustFilter && this.engineGain) {
      // When accelerating (throttle > 0): open filter wide for roaring growl
      // When coasting (throttle = 0): muffled overrun burble
      const loadBoost = throttle > 0.05 ? 1.0 + throttle * 0.8 : 0.65;
      const targetFilterFreq = (380 + Math.pow(rpmFactor, 1.8) * 3500) * loadBoost;
      this.engineFilter.frequency.setTargetAtTime(Math.min(7000, targetFilterFreq), now, 0.06);

      const peakFreq = 220 + rpmFactor * 750;
      this.exhaustFilter.frequency.setTargetAtTime(peakFreq, now, 0.06);

      const targetVol = (0.16 + rpmFactor * 0.22 + (throttle * 0.14));
      this.engineGain.gain.setTargetAtTime(targetVol, now, 0.05);
    }

    // 3. Exhaust Overrun Backfire Crackles ("pop-pop-crack!")
    // Triggers when lifting off throttle at high RPM (> 4500 RPM)
    if (this.lastThrottle > 0.6 && throttle < 0.1 && clampedRpm > 4200 && now > this.nextBackfireTime) {
      this.triggerBackfireCrackle();
      this.nextBackfireTime = now + 0.65;
    }

    // Blow-off valve pressure release on throttle drop
    if (this.lastThrottle > 0.75 && throttle < 0.15 && clampedRpm > 4800) {
      this.playBlowOffValve();
    }
    this.lastThrottle = throttle;
    this.lastRpm = clampedRpm;

    // 4. Turbocharger Spool
    if (this.turboOsc && this.turboGain) {
      if (throttle > 0.2 && speedKmh > 30) {
        const turboPitch = 1250 + rpmFactor * 2400;
        this.turboOsc.frequency.setTargetAtTime(turboPitch, now, 0.1);
        this.turboGain.gain.setTargetAtTime(Math.min(0.09, throttle * 0.09), now, 0.1);
      } else {
        this.turboGain.gain.setTargetAtTime(0, now, 0.18);
      }
    }

    // 5. High-Speed Aerodynamic Wind Rush (Increases naturally with speed)
    if (this.windGain && this.windFilter) {
      if (speedKmh > 60) {
        const windRatio = Math.min(1.0, (speedKmh - 60) / 220);
        this.windGain.gain.setTargetAtTime(windRatio * 0.18, now, 0.1);
        this.windFilter.frequency.setTargetAtTime(600 + windRatio * 1800, now, 0.1);
      } else {
        this.windGain.gain.setTargetAtTime(0, now, 0.2);
      }
    }

    // 6. Tire Screech (Drifting or hard cornering)
    if (this.skidGain && this.skidFilter) {
      if (isDrifting && speedKmh > 32) {
        const skidIntensity = Math.min(1.0, speedKmh / 140);
        this.skidGain.gain.setTargetAtTime(0.26 * skidIntensity, now, 0.05);
        this.skidFilter.frequency.setTargetAtTime(1400 + Math.sin(now * 18) * 350, now, 0.05);
      } else {
        this.skidGain.gain.setTargetAtTime(0, now, 0.08);
      }
    }

    // 7. Nitro Jet Roar
    if (this.nitroGain && this.nitroFilter) {
      if (isNitro && throttle > 0.1) {
        this.nitroGain.gain.setTargetAtTime(0.38, now, 0.04);
        this.nitroFilter.frequency.setTargetAtTime(1700, now, 0.05);
      } else {
        this.nitroGain.gain.setTargetAtTime(0, now, 0.1);
      }
    }

    // 8. Apex Curb Rumble Strip ("th-th-th-th-th")
    if (this.curbGain && this.curbOsc) {
      if (isOnCurb && speedKmh > 20) {
        const curbPitch = 55 + (speedKmh / 220) * 45;
        this.curbOsc.frequency.setTargetAtTime(curbPitch, now, 0.03);
        const rumbleAmp = 0.22 + Math.sin(now * (speedKmh * 0.4)) * 0.08;
        this.curbGain.gain.setTargetAtTime(rumbleAmp, now, 0.03);
      } else {
        this.curbGain.gain.setTargetAtTime(0, now, 0.06);
      }
    }

    // 9. Carbon-Ceramic Performance Brake Squeal
    if (this.brakeSquealGain && this.brakeSquealOsc) {
      if (isBraking && speedKmh > 75) {
        const brakeIntensity = Math.min(1.0, (speedKmh - 75) / 130);
        this.brakeSquealGain.gain.setTargetAtTime(0.045 * brakeIntensity, now, 0.08);
      } else {
        this.brakeSquealGain.gain.setTargetAtTime(0, now, 0.12);
      }
    }
  }

  // Realistic exhaust overrun pop / crackle
  private triggerBackfireCrackle() {
    if (!this.ctx || !this.noiseBuffer || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const numPops = 2 + Math.floor(Math.random() * 3); // 2 to 4 rapid pops

      for (let i = 0; i < numPops; i++) {
        const delay = i * (0.05 + Math.random() * 0.06);

        // Pop source
        const popSource = this.ctx.createBufferSource();
        popSource.buffer = this.noiseBuffer;

        const popFilter = this.ctx.createBiquadFilter();
        popFilter.type = 'bandpass';
        popFilter.frequency.setValueAtTime(600 + Math.random() * 600, now + delay);
        popFilter.Q.setValueAtTime(3.0, now + delay);

        const popGain = this.ctx.createGain();
        popGain.gain.setValueAtTime(0.28, now + delay);
        popGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);

        popSource.connect(popFilter);
        popFilter.connect(popGain);
        popGain.connect(this.masterGain!);

        popSource.start(now + delay);
        popSource.stop(now + delay + 0.07);
      }
    } catch (_) {}
  }

  // Blow-off valve "psshhh"
  private playBlowOffValve() {
    if (!this.ctx || !this.noiseBuffer || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const bov = this.ctx.createBufferSource();
      bov.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2400, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.19, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      bov.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      bov.start(now);
      bov.stop(now + 0.36);
    } catch (_) {}
  }

  // Heavy metal impact crunch & collision sound
  public playCrashImpact(severity: number = 1.0) {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;

      // 1. Deep impact thud
      const thudOsc = this.ctx.createOscillator();
      thudOsc.type = 'sine';
      thudOsc.frequency.setValueAtTime(130, now);
      thudOsc.frequency.exponentialRampToValueAtTime(28, now + 0.38);

      const thudGain = this.ctx.createGain();
      thudGain.gain.setValueAtTime(Math.min(0.75, 0.45 * severity), now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      thudOsc.connect(thudGain);
      thudGain.connect(this.masterGain!);
      thudOsc.start(now);
      thudOsc.stop(now + 0.42);

      // 2. Metal crunch noise burst
      if (this.noiseBuffer) {
        const crunchSource = this.ctx.createBufferSource();
        crunchSource.buffer = this.noiseBuffer;

        const crunchFilter = this.ctx.createBiquadFilter();
        crunchFilter.type = 'bandpass';
        crunchFilter.frequency.setValueAtTime(850, now);
        crunchFilter.Q.setValueAtTime(1.8, now);

        const crunchGain = this.ctx.createGain();
        crunchGain.gain.setValueAtTime(Math.min(0.6, 0.4 * severity), now);
        crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        crunchSource.connect(crunchFilter);
        crunchFilter.connect(crunchGain);
        crunchGain.connect(this.masterGain!);

        crunchSource.start(now);
        crunchSource.stop(now + 0.3);
      }
    } catch (e) {
      console.warn('[SoundEngine] playCrashImpact error:', e);
    }
  }

  // 10. Interactive Race Countdown Beeps (3... 2... 1... GO!)
  public playCountdownBeep(isGo: boolean = false) {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      if (!isGo) {
        // Red lights: Crisp, focused 480 Hz beep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, now);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now);
        osc.stop(now + 0.18);
      } else {
        // Green light: Triumphant dual-harmonic 960 Hz + 1440 Hz chord
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(960, now);
        gain.gain.setValueAtTime(0.48, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1440, now);
        const gain2 = this.ctx.createGain();
        gain2.gain.setValueAtTime(0.32, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        osc.connect(gain);
        osc2.connect(gain2);
        gain.connect(this.masterGain!);
        gain2.connect(this.masterGain!);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.58);
        osc2.stop(now + 0.58);
      }
    } catch (_) {}
  }

  // 11. Interactive UI Click Feedback
  public playUiClick() {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch (_) {}
  }

  // 12. Interactive UI Hover Tick
  public playUiHover() {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.025);
    } catch (_) {}
  }

  // 13. Supercar Throttle Rev Burst (Used in Showroom / Starting Grid)
  public playRevPulse() {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const revOsc = this.ctx.createOscillator();
      const revGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      revOsc.type = 'sawtooth';
      revOsc.frequency.setValueAtTime(55, now);
      revOsc.frequency.exponentialRampToValueAtTime(260, now + 0.28);
      revOsc.frequency.exponentialRampToValueAtTime(75, now + 0.75);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, now);
      filter.frequency.exponentialRampToValueAtTime(1800, now + 0.28);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.75);

      revGain.gain.setValueAtTime(0.42, now);
      revGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

      revOsc.connect(filter);
      filter.connect(revGain);
      revGain.connect(this.masterGain!);

      revOsc.start(now);
      revOsc.stop(now + 0.85);

      // Follow up with exhaust pop at the tail
      setTimeout(() => this.triggerBackfireCrackle(), 380);
    } catch (_) {}
  }

  // 14. Dual-Tone European Supercar Horn
  public playHorn() {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(430, now);
      osc2.frequency.setValueAtTime(510, now);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain!);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.36);
      osc2.stop(now + 0.36);
    } catch (_) {}
  }

  // 15. Rewarding Drift Level-Up Chime
  public playDriftChime() {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const freqs = [659.25, 880, 1174.66]; // E5, A5, D6
      freqs.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const t = now + idx * 0.08;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(t);
        osc.stop(t + 0.38);
      });
    } catch (_) {}
  }

  // 16. Mechanical Sequential Dog-Box Gear Shift Clack + Turbo Pop
  public playGearShift(isUpshift: boolean = true) {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;

      // Crisp metallic mechanical clack
      const clack = this.ctx.createOscillator();
      const clackGain = this.ctx.createGain();
      clack.type = 'triangle';
      clack.frequency.setValueAtTime(isUpshift ? 260 : 185, now);
      clack.frequency.exponentialRampToValueAtTime(65, now + 0.075);

      clackGain.gain.setValueAtTime(0.32, now);
      clackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

      clack.connect(clackGain);
      clackGain.connect(this.masterGain!);
      clack.start(now);
      clack.stop(now + 0.09);

      // Subtle exhaust burst on high-load upshift or downshift blip
      if (this.noiseBuffer) {
        const puff = this.ctx.createBufferSource();
        puff.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(isUpshift ? 520 : 780, now);
        filter.Q.setValueAtTime(2.5, now);

        const puffGain = this.ctx.createGain();
        puffGain.gain.setValueAtTime(0.22, now);
        puffGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        puff.connect(filter);
        filter.connect(puffGain);
        puffGain.connect(this.masterGain!);
        puff.start(now);
        puff.stop(now + 0.1);
      }
    } catch (_) {}
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.85, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public dispose() {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.isInitialized = false;
    }
  }
}
