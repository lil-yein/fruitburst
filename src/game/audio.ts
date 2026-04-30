// Audio system.
//
// Two paths:
//   • Background music — HTMLAudioElement with two-element ping-pong
//     crossfade for smooth ~2s loop boundaries. Doesn't need low
//     latency; HTMLAudio is fine.
//   • SFX (pop, bomb, mistake, gameover, ui click) — Web Audio API.
//     We fetch each clip once, decode to an AudioBuffer, and trigger
//     a fresh AudioBufferSourceNode per play. Latency is ~zero
//     (microseconds) once the buffer is loaded, vs HTMLAudio.play()
//     which scheduled a perceptible delay especially on first call.

const MUSIC_URL = '/assets/music/background.mp3';
const POP_URL = '/assets/sfx/pop.mp3';
const BOMB_URL = '/assets/sfx/bomb.mp3';
const MISTAKE_URL = '/assets/sfx/mistake.mp3';
const GAMEOVER_URL = '/assets/sfx/gameover.mp3';
const CLICK_URL = '/assets/sfx/click.mp3';

const MUSIC_VOLUME = 0.4;
const SFX_VOLUME = 0.7;
const CLICK_VOLUME = 0.5;
const FADE_MS = 1800;

// ─── Background music (HTMLAudio crossfade) ──────────────────────────

type FadeAnim = { id: number };

function fadeVolume(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  durationMs: number,
  state: FadeAnim
): void {
  const startedAt = performance.now();
  audio.volume = from;
  const tick = () => {
    const elapsed = performance.now() - startedAt;
    const t = Math.min(1, elapsed / durationMs);
    audio.volume = from + (to - from) * t;
    if (t < 1) state.id = requestAnimationFrame(tick);
    else state.id = 0;
  };
  if (state.id) cancelAnimationFrame(state.id);
  state.id = requestAnimationFrame(tick);
}

class BackgroundMusic {
  private a: HTMLAudioElement;
  private b: HTMLAudioElement;
  private active: HTMLAudioElement;
  private idle: HTMLAudioElement;
  private fadeA: FadeAnim = { id: 0 };
  private fadeB: FadeAnim = { id: 0 };
  private started = false;

  constructor() {
    this.a = new Audio(MUSIC_URL);
    this.b = new Audio(MUSIC_URL);
    this.a.preload = 'auto';
    this.b.preload = 'auto';
    this.a.volume = 0;
    this.b.volume = 0;
    this.active = this.a;
    this.idle = this.b;

    this.a.addEventListener('timeupdate', () => this.checkLoopBoundary(this.a));
    this.b.addEventListener('timeupdate', () => this.checkLoopBoundary(this.b));
  }

  private checkLoopBoundary(track: HTMLAudioElement): void {
    if (track !== this.active) return;
    if (!Number.isFinite(track.duration)) return;
    const remaining = track.duration - track.currentTime;
    if (remaining < FADE_MS / 1000 + 0.05 && this.idle.paused) {
      this.crossfade();
    }
  }

  private crossfade(): void {
    const next = this.idle;
    next.currentTime = 0;
    next.volume = 0;
    void next.play().catch(() => {});
    fadeVolume(next, 0, MUSIC_VOLUME, FADE_MS, next === this.a ? this.fadeA : this.fadeB);
    fadeVolume(
      this.active,
      this.active.volume,
      0,
      FADE_MS,
      this.active === this.a ? this.fadeA : this.fadeB
    );
    [this.active, this.idle] = [this.idle, this.active];
    setTimeout(() => {
      if (this.idle.volume === 0) this.idle.pause();
    }, FADE_MS + 100);
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.active.currentTime = 0;
    try {
      await this.active.play();
      fadeVolume(this.active, 0, MUSIC_VOLUME, FADE_MS, this.fadeA);
    } catch {
      this.started = false;
    }
  }

  stop(): void {
    fadeVolume(this.active, this.active.volume, 0, 600, this.fadeA);
    fadeVolume(this.idle, this.idle.volume, 0, 600, this.fadeB);
    setTimeout(() => {
      this.a.pause();
      this.b.pause();
    }, 700);
  }
}

// ─── Web Audio SFX ───────────────────────────────────────────────────

/** Lazily-created shared AudioContext. Browsers limit how many an app
 *  can have, and they fire warnings if one isn't reused. */
let sharedCtx: AudioContext | null = null;

type AudioContextCtor = typeof AudioContext;
type WindowWithWebkit = typeof window & {
  webkitAudioContext?: AudioContextCtor;
};

function getAudioContext(): AudioContext | null {
  if (sharedCtx) return sharedCtx;
  const w = window as WindowWithWebkit;
  const Ctor = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null; // Web Audio unsupported (very old browsers)
  sharedCtx = new Ctor();
  return sharedCtx;
}

/** Most autoplay policies suspend the AudioContext until the page
 *  receives a user gesture. This wires a one-shot pointerdown listener
 *  that resumes it. After resume the listener self-removes. */
let resumeListenerAttached = false;
function ensureResumeOnGesture(): void {
  if (resumeListenerAttached) return;
  resumeListenerAttached = true;
  const resume = () => {
    sharedCtx?.resume().catch(() => {});
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
    window.removeEventListener('touchstart', resume);
  };
  window.addEventListener('pointerdown', resume, { once: true });
  window.addEventListener('keydown', resume, { once: true });
  window.addEventListener('touchstart', resume, { once: true });
}

/**
 * Single-clip Web Audio player. Fetches + decodes once on construction,
 * then `play()` is a microsecond-cost call (creates a new buffer source
 * node and starts it). Multiple plays overlap freely.
 */
class SfxPlayer {
  private buffer: AudioBuffer | null = null;
  private gain: GainNode | null = null;
  private ready = false;

  constructor(url: string, volume: number) {
    const ctx = getAudioContext();
    if (!ctx) return; // Web Audio unsupported — play() will be a no-op.
    ensureResumeOnGesture();

    this.gain = ctx.createGain();
    this.gain.gain.value = volume;
    this.gain.connect(ctx.destination);

    void this.load(url, ctx);
  }

  private async load(url: string, ctx: AudioContext): Promise<void> {
    try {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      // decodeAudioData accepts a callback in older Safari; the modern
      // promise form covers everything we target.
      this.buffer = await ctx.decodeAudioData(arr);
      this.ready = true;
    } catch {
      // leave ready=false → play() is a no-op
    }
  }

  play(): void {
    if (!this.ready || !this.buffer || !this.gain) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(this.gain);
    src.start(0);
  }
}

// ─── AudioSystem (per-GameView) ──────────────────────────────────────

export class AudioSystem {
  private music = new BackgroundMusic();
  private pop = new SfxPlayer(POP_URL, SFX_VOLUME);
  private bomb = new SfxPlayer(BOMB_URL, SFX_VOLUME);
  private mistake = new SfxPlayer(MISTAKE_URL, SFX_VOLUME);
  private gameover = new SfxPlayer(GAMEOVER_URL, SFX_VOLUME);

  startMusic(): Promise<void> {
    return this.music.start();
  }

  stopMusic(): void {
    this.music.stop();
  }

  playPop(): void {
    this.pop.play();
  }

  playBomb(): void {
    this.bomb.play();
  }

  /** Life-lost cue — fires on a missed fruit (-0.5) or shot bomb (-1). */
  playMistake(): void {
    this.mistake.play();
  }

  /** One-shot played as the run ends (lives → 0). */
  playGameOver(): void {
    this.gameover.play();
  }
}

// ─── Global UI click ─────────────────────────────────────────────────
//
// Eagerly constructed at module load so the buffer is fetched + decoded
// before the user's first click. The Player tolerates being created
// while the AudioContext is suspended; the resume happens on first
// gesture and play() works from there on.

const uiClickPlayer = new SfxPlayer(CLICK_URL, CLICK_VOLUME);

export function playUiClick(): void {
  uiClickPlayer.play();
}
