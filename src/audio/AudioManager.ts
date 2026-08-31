/**
 * Centralized Audio Manager (GAME_RULES.md is silent on audio; see
 * ASSET_SPECIFICATION.md for the rationale). Every sound is synthesized live
 * with the Web Audio API rather than loaded from a file. This is a
 * deliberate choice: it guarantees zero copyright risk (nothing is sourced
 * from anywhere), zero missing-file risk (there are no files to fail to
 * load), and a tiny production bundle. The manager still exposes an
 * `loadExternalVoiceClip` hook so real recorded voice lines can be dropped in
 * later (see VOICE_MANIFEST.md) without changing calling code, and any load
 * failure there falls back to silence rather than breaking the game.
 */

export type SfxName =
  | 'buttonClick'
  | 'diceRollNormal'
  | 'diceRollGati'
  | 'diceLand'
  | 'kukriMove'
  | 'kukriEnter'
  | 'capture'
  | 'moksha'
  | 'turnChange'
  | 'victory'
  | 'error';

interface Volumes {
  master: number;
  music: number;
  sfx: number;
  voice: number;
  muted: boolean;
}

const DEFAULT_VOLUMES: Volumes = { master: 0.8, music: 0.5, sfx: 0.9, voice: 0.9, muted: false };

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private volumes: Volumes = { ...DEFAULT_VOLUMES };
  private musicNodes: { stop: () => void } | null = null;
  private musicPlaying = false;
  private voiceClips = new Map<string, AudioBuffer>();

  setVolumes(v: Partial<Volumes>): void {
    this.volumes = { ...this.volumes, ...v };
    if (this.masterGain) this.masterGain.gain.value = this.volumes.muted ? 0 : this.volumes.master;
    if (this.musicGain) this.musicGain.gain.value = this.volumes.music;
    if (this.sfxGain) this.sfxGain.gain.value = this.volumes.sfx;
    if (this.voiceGain) this.voiceGain.gain.value = this.volumes.voice;
  }

  getVolumes(): Volumes {
    return { ...this.volumes };
  }

  /** Must be called from within a user gesture handler (click/tap) to satisfy
   * browser autoplay policies. Safe to call multiple times. */
  ensureStarted(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volumes.muted ? 0 : this.volumes.master;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.volumes.music;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.volumes.sfx;
      this.sfxGain.connect(this.masterGain);

      this.voiceGain = this.ctx.createGain();
      this.voiceGain.gain.value = this.volumes.voice;
      this.voiceGain.connect(this.masterGain);
    } catch (e) {
      // Web Audio unavailable - the game must still run silently rather than break.
      console.warn('AudioManager: Web Audio unavailable, running silent.', e);
      this.ctx = null;
    }
  }

  setMuted(muted: boolean): void {
    this.setVolumes({ muted });
  }

  private tone(
    freq: number,
    duration: number,
    opts: { type?: OscillatorType; gain?: number; delay?: number; slideTo?: number } = {},
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const { type = 'sine', gain = 0.3, delay = 0, slideTo } = opts;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.02, duration / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noiseBurst(duration: number, opts: { gain?: number; delay?: number; filterFreq?: number } = {}): void {
    if (!this.ctx || !this.sfxGain) return;
    const { gain = 0.25, delay = 0, filterFreq = 1800 } = opts;
    const t0 = this.ctx.currentTime + delay;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  playSfx(name: SfxName): void {
    if (!this.ctx) return;
    switch (name) {
      case 'buttonClick':
        this.tone(720, 0.06, { type: 'triangle', gain: 0.25 });
        break;
      case 'diceRollNormal':
        for (let i = 0; i < 5; i++) this.noiseBurst(0.06, { delay: i * 0.05, gain: 0.18, filterFreq: 2400 });
        break;
      case 'diceRollGati':
        for (let i = 0; i < 5; i++) this.tone(300 + Math.random() * 500, 0.05, { delay: i * 0.05, type: 'square', gain: 0.12 });
        break;
      case 'diceLand':
        this.tone(180, 0.12, { type: 'sine', gain: 0.3, slideTo: 90 });
        break;
      case 'kukriMove':
        this.tone(520, 0.08, { type: 'triangle', gain: 0.22 });
        break;
      case 'kukriEnter':
        this.tone(440, 0.1, { type: 'sine', gain: 0.25 });
        this.tone(660, 0.12, { delay: 0.06, type: 'sine', gain: 0.2 });
        break;
      case 'capture':
        this.tone(500, 0.18, { type: 'sawtooth', gain: 0.22, slideTo: 120 });
        this.noiseBurst(0.08, { delay: 0.1, gain: 0.15 });
        break;
      case 'moksha': {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f, i) => this.tone(f, 0.35, { delay: i * 0.09, type: 'sine', gain: 0.22 }));
        break;
      }
      case 'turnChange':
        this.tone(392, 0.1, { type: 'sine', gain: 0.18 });
        break;
      case 'victory': {
        const notes = [523.25, 523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f, i) => this.tone(f, 0.28, { delay: i * 0.15, type: 'triangle', gain: 0.25 }));
        break;
      }
      case 'error':
        this.tone(180, 0.15, { type: 'square', gain: 0.15 });
        break;
    }
  }

  startAmbientMusic(): void {
    if (!this.ctx || !this.musicGain || this.musicPlaying) return;
    const ctx = this.ctx;
    const gain = this.musicGain;
    const droneFreqs = [130.81, 164.81, 196.0]; // C3-E3-G3, warm and calm
    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain);
    lfo.start();

    droneFreqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.06 / (i + 1), ctx.currentTime + 2);
      lfoGain.connect(g.gain);
      osc.connect(g);
      g.connect(gain);
      osc.start();
      oscillators.push(osc);
      gains.push(g);
    });

    this.musicPlaying = true;
    this.musicNodes = {
      stop: () => {
        const now = ctx.currentTime;
        gains.forEach((g) => {
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(g.gain.value, now);
          g.gain.linearRampToValueAtTime(0, now + 0.6);
        });
        oscillators.forEach((o) => o.stop(now + 0.7));
        lfo.stop(now + 0.7);
      },
    };
  }

  stopAmbientMusic(): void {
    if (this.musicNodes) this.musicNodes.stop();
    this.musicNodes = null;
    this.musicPlaying = false;
  }

  /** Optional hook for future recorded voice lines (see VOICE_MANIFEST.md).
   * If a clip was never loaded, this silently does nothing - voice is always
   * optional and the game must work fully without it. */
  async loadExternalVoiceClip(id: string, url: string): Promise<void> {
    if (!this.ctx) return;
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const arrayBuffer = await res.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.voiceClips.set(id, buffer);
    } catch {
      // Missing/failed voice file must never break gameplay.
    }
  }

  playVoiceLine(id: string): void {
    if (!this.ctx || !this.voiceGain) return;
    const buffer = this.voiceClips.get(id);
    if (!buffer) return; // silent fallback - see class doc comment
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.voiceGain);
    src.start();
  }
}

export const audioManager = new AudioManager();
