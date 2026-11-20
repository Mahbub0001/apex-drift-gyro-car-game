export class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // Engine Oscillators & Filters
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Tire Skid Noise
  private skidNoise: AudioBufferSourceNode | null = null;
  private skidFilter: BiquadFilterNode | null = null;
  private skidGain: GainNode | null = null;

  // Nitro Sound
  private nitroGain: GainNode | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  public init() {
    if (this.isInitialized) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();

      // 1. Dual-Sawtooth Engine Synthesizer
      this.osc1 = this.ctx.createOscillator();
      this.osc2 = this.ctx.createOscillator();
      this.osc1.type = 'sawtooth';
      this.osc2.type = 'sawtooth';

      // Detune for throaty sports car engine growl
      this.osc1.frequency.setValueAtTime(65, this.ctx.currentTime);
      this.osc2.frequency.setValueAtTime(67.5, this.ctx.currentTime);

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
      this.engineFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

      this.osc1.connect(this.engineFilter);
      this.osc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.osc1.start();
      this.osc2.start();

      // 2. White Noise Tire Skid Buffer
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.skidFilter = this.ctx.createBiquadFilter();
      this.skidFilter.type = 'bandpass';
      this.skidFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
      this.skidFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

      this.skidGain = this.ctx.createGain();
      this.skidGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.skidFilter.connect(this.skidGain);
      this.skidGain.connect(this.ctx.destination);

      this.skidNoise = this.ctx.createBufferSource();
      this.skidNoise.buffer = noiseBuffer;
      this.skidNoise.loop = true;
      this.skidNoise.connect(this.skidFilter);
      this.skidNoise.start();

      // 3. Nitro Whoosh
      this.nitroGain = this.ctx.createGain();
      this.nitroGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.nitroGain.connect(this.ctx.destination);

      this.isInitialized = true;
    } catch (e) {
      console.warn('[SoundEngine] AudioContext failed:', e);
    }
  }

  public update(rpm: number, speedKmh: number, isDrifting: boolean, isNitro: boolean) {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;

    // 1. Modulate Engine Pitch & Resonance with RPM
    if (this.osc1 && this.osc2 && this.engineFilter) {
      // 800 RPM -> 55 Hz, 8500 RPM -> 420 Hz
      const baseFreq = 55 + (rpm / 8500) * 365;
      this.osc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
      this.osc2.frequency.setTargetAtTime(baseFreq * 1.035, now, 0.05);

      // Lowpass cutoff opens up as engine revs
      const filterCutoff = 350 + (rpm / 8500) * 2200;
      this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.05);
    }

    // 2. Modulate Tire Screech on Drift
    if (this.skidGain) {
      const targetSkidGain = isDrifting && speedKmh > 35 ? Math.min(0.35, (speedKmh / 160) * 0.35) : 0;
      this.skidGain.gain.setTargetAtTime(targetSkidGain, now, 0.08);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setValueAtTime(this.isMuted ? 0 : 0.18, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public playCrash() {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.4);
    } catch {}
  }

  public dispose() {
    this.ctx?.close();
  }
}
