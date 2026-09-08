/**
 * Zero-latency Web Audio API sound synthesizer
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.5;

  private initCtx() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public setVolume(vol?: number) {
    if (vol === undefined || vol === null || isNaN(vol)) {
      this.volume = 0.5;
      return;
    }
    this.volume = Math.max(0, Math.min(1, vol));
  }

  /**
   * General purpose tone generator
   */
  public playTone(
    freq: number,
    type: OscillatorType = 'sine',
    duration: number = 0.15,
    rampDown: boolean = true,
    gainBoost: number = 1.0
  ) {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const targetGain = this.volume * gainBoost;
      gain.gain.setValueAtTime(targetGain, ctx.currentTime);

      if (rampDown) {
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio context might be restricted before user gesture
    }
  }

  /**
   * Ready lock-in sound (rising clean tone)
   */
  public playLockIn() {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);

      gain.gain.setValueAtTime(this.volume * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Ignore audio error
    }
  }

  /**
   * Drag race countdown yellow light beep (500Hz)
   */
  public playCountdownBeep(stage: number = 1) {
    // 500Hz standard drag beep with slight punch
    const freq = 500 + (stage - 1) * 40;
    this.playTone(freq, 'sine', 0.12, true, 0.6);
  }

  /**
   * Drag race START green light tone (1000Hz crisp & bright)
   */
  public playGoTone() {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Dual oscillator for punchy stadium fanfare start
      [1000, 2000].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(this.volume * (idx === 0 ? 0.7 : 0.3), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.4);
      });
    } catch {
      // Ignore
    }
  }

  /**
   * False start harsh buzzer (140Hz sawtooth)
   */
  public playFalseStart() {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.35);

      gain.gain.setValueAtTime(this.volume * 0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // Ignore
    }
  }

  /**
   * Finish chime when an individual player stops their timer
   */
  public playFinishChime(rank: number = 1) {
    if (!this.enabled) return;
    // Pentatonic scale based on rank
    const scale = [784, 659.25, 587.33, 523.25, 440, 392, 329.63, 293.66, 261.63, 220];
    const freq = scale[Math.min(rank - 1, scale.length - 1)] || 523.25;
    this.playTone(freq, 'triangle', 0.18, true, 0.45);
  }

  /**
   * Victory Fanfare when a Match or Set is captured
   */
  public playVictoryFanfare() {
    if (!this.enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((note, i) => {
      setTimeout(() => {
        this.playTone(note, 'triangle', 0.35, true, 0.6);
      }, i * 110);
    });
  }
}

export const soundEngine = new SoundEngine();
