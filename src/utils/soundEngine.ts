// Pure Web Audio API Sound Generator for Speedcubing & Casino Mechanics
// Zero latency, zero external asset dependencies, crystal clear synthesized audio.

type SoundPackType = 'classic' | 'mechanical' | 'retro8bit' | 'cyber' | 'casino';

class SoundEngine {
    private ctx: AudioContext | null = null;
    private isMuted: boolean = false;
    private volume: number = 0.3;

    private getContext(): AudioContext | null {
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

    public setMuted(muted: boolean) {
        this.isMuted = muted;
    }

    public setVolume(vol: number) {
        this.volume = Math.max(0, Math.min(1, vol));
    }

    public isSoundMuted(): boolean {
        return this.isMuted;
    }

    // Play a single oscillator tone with envelope
    private playTone(freq: number, type: OscillatorType, duration: number, startTime = 0, gainLevel = 1): void {
        if (this.isMuted) return;
        const ctx = this.getContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

        const targetGain = this.volume * gainLevel;
        gain.gain.setValueAtTime(0.001, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(targetGain, ctx.currentTime + startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration + 0.05);
    }

    // Timer: Priming hold hum
    public playPriming(progress: number): void {
        if (this.isMuted) return;
        const ctx = this.getContext();
        if (!ctx) return;

        const baseFreq = 220 + progress * 220; // 220Hz (A3) up to 440Hz (A4)
        this.playTone(baseFreq, 'sine', 0.08, 0, 0.15);
    }

    // Timer: Spacebar Released / Solve Start
    public playStart(pack: SoundPackType = 'classic'): void {
        if (this.isMuted) return;
        switch (pack) {
            case 'mechanical':
                this.playTone(1800, 'triangle', 0.03, 0, 0.4);
                this.playTone(320, 'square', 0.04, 0.01, 0.25);
                break;
            case 'retro8bit':
                this.playTone(587.33, 'square', 0.04, 0, 0.25); // D5
                this.playTone(880.00, 'square', 0.06, 0.04, 0.25); // A5
                break;
            case 'cyber':
                this.playTone(300, 'sawtooth', 0.05, 0, 0.2);
                this.playTone(900, 'sine', 0.08, 0.02, 0.3);
                break;
            case 'casino':
                this.playTone(1046.50, 'sine', 0.08, 0, 0.35); // C6
                break;
            case 'classic':
            default:
                this.playTone(880, 'sine', 0.06, 0, 0.3);
                break;
        }
    }

    // Timer: Stop Solve
    public playStop(pack: SoundPackType = 'classic'): void {
        if (this.isMuted) return;
        switch (pack) {
            case 'mechanical':
                this.playTone(1200, 'triangle', 0.04, 0, 0.5);
                this.playTone(220, 'square', 0.06, 0.02, 0.35);
                break;
            case 'retro8bit':
                this.playTone(880, 'square', 0.05, 0, 0.3);
                this.playTone(1174.66, 'square', 0.08, 0.05, 0.35);
                break;
            case 'cyber':
                this.playTone(1200, 'sawtooth', 0.04, 0, 0.25);
                this.playTone(400, 'sine', 0.12, 0.02, 0.35);
                break;
            case 'casino':
                this.playTone(1318.51, 'sine', 0.08, 0, 0.35); // E6
                this.playTone(1567.98, 'sine', 0.12, 0.06, 0.4); // G6
                break;
            case 'classic':
            default:
                this.playTone(523.25, 'sine', 0.05, 0, 0.35); // C5
                this.playTone(659.25, 'sine', 0.09, 0.04, 0.4); // E5
                break;
        }
    }

    // Inspection Alerts (8s / 12s)
    public playInspectionAlert(type: '8s' | '12s'): void {
        if (this.isMuted) return;
        if (type === '8s') {
            this.playTone(700, 'sine', 0.09, 0, 0.35);
            this.playTone(700, 'sine', 0.09, 0.12, 0.35);
        } else {
            this.playTone(950, 'triangle', 0.12, 0, 0.45);
            this.playTone(1100, 'triangle', 0.14, 0.14, 0.5);
        }
    }

    // Gambling: Wager Won Celebration
    public playWagerWin(): void {
        if (this.isMuted) return;
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
        notes.forEach((freq, idx) => {
            this.playTone(freq, 'sine', 0.15, idx * 0.07, 0.45);
        });
        // Coin cascade sound
        for (let i = 0; i < 6; i++) {
            this.playTone(1800 + Math.random() * 800, 'triangle', 0.05, 0.35 + i * 0.04, 0.3);
        }
    }

    // Gambling: Wager Lost Thud
    public playWagerLoss(): void {
        if (this.isMuted) return;
        this.playTone(220, 'sawtooth', 0.18, 0, 0.35);
        this.playTone(146.83, 'sawtooth', 0.25, 0.12, 0.4);
    }

    // Gambling: Push-Your-Luck Streak Multiplier Increase
    public playStreakLevelUp(streakLevel: number): void {
        if (this.isMuted) return;
        const base = Math.min(streakLevel, 8);
        const root = 440 * Math.pow(1.12, base);
        this.playTone(root, 'triangle', 0.1, 0, 0.4);
        this.playTone(root * 1.25, 'sine', 0.12, 0.06, 0.45);
        this.playTone(root * 1.5, 'sine', 0.18, 0.12, 0.5);
    }

    // Gambling: Streak Busted (Pot Lost)
    public playStreakBust(): void {
        if (this.isMuted) return;
        this.playTone(350, 'sawtooth', 0.12, 0, 0.35);
        this.playTone(280, 'sawtooth', 0.15, 0.09, 0.4);
        this.playTone(180, 'sawtooth', 0.3, 0.18, 0.45);
    }

    // Gambling: Bank Pot (Collecting Coins)
    public playBankCoins(): void {
        if (this.isMuted) return;
        for (let i = 0; i < 4; i++) {
            this.playTone(1400 + i * 180, 'sine', 0.08, i * 0.05, 0.35);
        }
    }

    // Gambling: Near Miss / Heartbreak Shatter (Pity Token Awarded)
    public playHeartbreak(): void {
        if (this.isMuted) return;
        const ctx = this.getContext();
        if (!ctx) return;

        // Discordant Glass Shatter / Tension resonance
        this.playTone(880, 'triangle', 0.15, 0, 0.4);
        this.playTone(932.33, 'sawtooth', 0.25, 0.02, 0.35); // Dissonant half step
        this.playTone(1760, 'sine', 0.3, 0.04, 0.45);
        this.playTone(2200, 'triangle', 0.35, 0.08, 0.3);

        // Sub-bass thump
        this.playTone(90, 'sine', 0.4, 0.05, 0.5);
    }

    // Gacha: Suspenseful Spin Tick
    public playGachaTick(speedPitch = 1): void {
        if (this.isMuted) return;
        this.playTone(900 * speedPitch, 'triangle', 0.03, 0, 0.25);
    }

    // Gacha: Reveal Sound by Rarity
    public playGachaReveal(rarity: 'common' | 'rare' | 'epic' | 'legendary'): void {
        if (this.isMuted) return;
        switch (rarity) {
            case 'legendary':
                // Celestial Grand Chords
                const legNotes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00];
                legNotes.forEach((f, idx) => {
                    this.playTone(f, 'sine', 0.4, idx * 0.08, 0.45);
                });
                break;
            case 'epic':
                // Rich Synth Fanfare
                [440, 554.37, 659.25, 880, 1108.73].forEach((f, idx) => {
                    this.playTone(f, 'triangle', 0.3, idx * 0.08, 0.4);
                });
                break;
            case 'rare':
                // Bright Ascending Triad
                [523.25, 659.25, 783.99, 1046.50].forEach((f, idx) => {
                    this.playTone(f, 'sine', 0.25, idx * 0.08, 0.35);
                });
                break;
            case 'common':
            default:
                // Standard Success Chime
                this.playTone(523.25, 'sine', 0.15, 0, 0.3);
                this.playTone(659.25, 'sine', 0.2, 0.1, 0.35);
                break;
        }
    }
}

export const soundEngine = new SoundEngine();
export type { SoundPackType };
