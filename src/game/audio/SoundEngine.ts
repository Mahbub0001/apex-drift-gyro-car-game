export class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // 1. Engine Core Synthesis Nodes
  private subOsc: OscillatorNode | null = null;
  private mainOsc: OscillatorNode | null = null;
  private harmOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private exhaustFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // 2. Turbocharger Spool & Blow-Off Valve
  private turboOsc: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;
  private lastThrottle: number = 0;
  private bovNoiseBuffer: AudioBuffer | null = null;

  // 3. Tire Skid & Drift Screech
  private skidSource: AudioBufferSourceNode | null = null;
  private skidFilter: BiquadFilterNode | null = null;
  private skidGain: GainNode | null = null;

  // 4. Nitro Jet Roar
  private nitroSource: AudioBufferSourceNode | null = null;
  private nitroFilter: BiquadFilterNode | null = null;
  private nitroGain: GainNode | null = null;

  // Master Output
  private masterGain: GainNode | null = null;

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

      // Noise buffer for tire skid, BOV, and nitro
      const sampleRate = this.ctx.sampleRate;
      const noiseSecs = 2.0;
      const noiseBuffer = this.ctx.createBuffer(1, sampleRate * noiseSecs, sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }
      this.bovNoiseBuffer = noiseBuffer;

      // ----------------------------------------------------
      // A. Supercar V8/V10 Engine Synthesizer
      // ----------------------------------------------------
      // Sub-bass rumble (30-120 Hz)
      this.subOsc = this.ctx.createOscillator();
      this.subOsc.type = 'triangle';
      this.subOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

      // Main cylinder firing pulse
      this.mainOsc = this.ctx.createOscillator();
      this.mainOsc.type = 'sawtooth';
      this.mainOsc.frequency.setValueAtTime(65, this.ctx.currentTime);

      // Upper harmonics (throaty exhaust rasp)
      this.harmOsc = this.ctx.createOscillator();
      this.harmOsc.type = 'sawtooth';
      this.harmOsc.frequency.setValueAtTime(130, this.ctx.currentTime);

      // Engine acoustic filters
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(400, this.ctx.currentTime);
      this.engineFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

      this.exhaustFilter = this.ctx.createBiquadFilter();
      this.exhaustFilter.type = 'peaking';
      this.exhaustFilter.frequency.setValueAtTime(280, this.ctx.currentTime);
      this.exhaustFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);
      this.exhaustFilter.gain.setValueAtTime(8.0, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

      // Connect engine graph
      this.subOsc.connect(this.engineGain);
      this.mainOsc.connect(this.engineFilter);
      this.harmOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.exhaustFilter);
      this.exhaustFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.subOsc.start();
      this.mainOsc.start();
      this.harmOsc.start();

      // ----------------------------------------------------
      // B. Turbocharger High-Pitch Whistle
      // ----------------------------------------------------
      this.turboOsc = this.ctx.createOscillator();
      this.turboOsc.type = 'sine';
      this.turboOsc.frequency.setValueAtTime(1400, this.ctx.currentTime);

      this.turboGain = this.ctx.createGain();
      this.turboGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.turboOsc.connect(this.turboGain);
      this.turboGain.connect(this.masterGain);
      this.turboOsc.start();

      // ----------------------------------------------------
      // C. Tire Skid & Drift Screech
      // ----------------------------------------------------
      this.skidFilter = this.ctx.createBiquadFilter();
      this.skidFilter.type = 'bandpass';
      this.skidFilter.frequency.setValueAtTime(1600, this.ctx.currentTime);
      this.skidFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);

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
      // D. Nitro Jet Flame Roar
      // ----------------------------------------------------
      this.nitroFilter = this.ctx.createBiquadFilter();
      this.nitroFilter.type = 'lowpass';
      this.nitroFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
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

      this.isInitialized = true;
    } catch (e) {
      console.warn('[SoundEngine] AudioContext init failed:', e);
    }
  }

  public update(rpm: number, speedKmh: number, isDrifting: boolean, isNitro: boolean, throttle: number = 0) {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const clampedRpm = Math.max(800, Math.min(8800, rpm));
    const rpmFactor = clampedRpm / 8800; // 0.0 to 1.0

    // 1. Calculate realistic V8 engine firing frequency (8-cylinders = 4 pulses per rev)
    const baseFreq = Math.max(38, (clampedRpm / 60) * 1.8);
    const subFreq = baseFreq * 0.5;
    const harmFreq = baseFreq * 2.1;

    if (this.subOsc && this.mainOsc && this.harmOsc) {
      this.subOsc.frequency.setTargetAtTime(subFreq, now, 0.04);
      this.mainOsc.frequency.setTargetAtTime(baseFreq, now, 0.04);
      this.harmOsc.frequency.setTargetAtTime(harmFreq, now, 0.04);
    }

    // 2. Open up exhaust acoustic filters under throttle and high RPM
    if (this.engineFilter && this.exhaustFilter) {
      const targetFilterFreq = 380 + Math.pow(rpmFactor, 1.8) * 3200 + (throttle * 600);
      this.engineFilter.frequency.setTargetAtTime(targetFilterFreq, now, 0.05);

      const targetPeakFreq = 220 + rpmFactor * 800;
      this.exhaustFilter.frequency.setTargetAtTime(targetPeakFreq, now, 0.05);
    }

    // Engine volume: deep at idle, roars under acceleration
    if (this.engineGain) {
      const targetVol = 0.18 + (rpmFactor * 0.22) + (throttle * 0.12);
      this.engineGain.gain.setTargetAtTime(targetVol, now, 0.05);
    }

    // 3. Turbocharger whistle
    if (this.turboOsc && this.turboGain) {
      if (throttle > 0.2 && speedKmh > 30) {
        const turboPitch = 1200 + rpmFactor * 2200;
        this.turboOsc.frequency.setTargetAtTime(turboPitch, now, 0.1);
        this.turboGain.gain.setTargetAtTime(Math.min(0.08, throttle * 0.08), now, 0.1);
      } else {
        this.turboGain.gain.setTargetAtTime(0, now, 0.15);
      }
    }

    // Blow-off valve when letting off throttle suddenly at high RPM
    if (this.lastThrottle > 0.7 && throttle < 0.2 && clampedRpm > 4500) {
      this.playBlowOffValve();
    }
    this.lastThrottle = throttle;

    // 4. Tire Screech (Drifting or hard braking)
    if (this.skidGain && this.skidFilter) {
      if (isDrifting && speedKmh > 30) {
        const skidIntensity = Math.min(1.0, speedKmh / 140);
        this.skidGain.gain.setTargetAtTime(0.28 * skidIntensity, now, 0.05);
        this.skidFilter.frequency.setTargetAtTime(1400 + Math.sin(now * 15) * 400, now, 0.05);
      } else {
        this.skidGain.gain.setTargetAtTime(0, now, 0.08);
      }
    }

    // 5. Nitro Jet Flame Roar
    if (this.nitroGain && this.nitroFilter) {
      if (isNitro && throttle > 0.1) {
        this.nitroGain.gain.setTargetAtTime(0.35, now, 0.04);
        this.nitroFilter.frequency.setTargetAtTime(1600, now, 0.05);
      } else {
        this.nitroGain.gain.setTargetAtTime(0, now, 0.1);
      }
    }
  }

  // Blow-off valve "psshhh" pressure release
  private playBlowOffValve() {
    if (!this.ctx || !this.bovNoiseBuffer || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const bov = this.ctx.createBufferSource();
      bov.buffer = this.bovNoiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2200, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      bov.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      bov.start(now);
      bov.stop(now + 0.36);
    } catch (_) {}
  }

  // Heavy metal impact crunch & collision blast
  public playCrashImpact(severity: number = 1.0) {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;

      // 1. Heavy bass impact thud (decaying sine 140Hz -> 30Hz)
      const thudOsc = this.ctx.createOscillator();
      thudOsc.type = 'sine';
      thudOsc.frequency.setValueAtTime(140, now);
      thudOsc.frequency.exponentialRampToValueAtTime(25, now + 0.4);

      const thudGain = this.ctx.createGain();
      thudGain.gain.setValueAtTime(Math.min(0.8, 0.5 * severity), now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      thudOsc.connect(thudGain);
      thudGain.connect(this.masterGain!);
      thudOsc.start(now);
      thudOsc.stop(now + 0.46);

      // 2. Metallic crunch & glass noise burst
      if (this.bovNoiseBuffer) {
        const crunchSource = this.ctx.createBufferSource();
        crunchSource.buffer = this.bovNoiseBuffer;

        const crunchFilter = this.ctx.createBiquadFilter();
        crunchFilter.type = 'bandpass';
        crunchFilter.frequency.setValueAtTime(800, now);
        crunchFilter.Q.setValueAtTime(1.5, now);

        const crunchGain = this.ctx.createGain();
        crunchGain.gain.setValueAtTime(Math.min(0.65, 0.45 * severity), now);
        crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        crunchSource.connect(crunchFilter);
        crunchFilter.connect(crunchGain);
        crunchGain.connect(this.masterGain!);

        crunchSource.start(now);
        crunchSource.stop(now + 0.32);
      }
    } catch (e) {
      console.warn('[SoundEngine] playCrashImpact error:', e);
    }
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
