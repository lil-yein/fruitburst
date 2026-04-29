// Audio system.
//
// Background music uses two Audio elements in a ping-pong crossfade so
// each loop boundary is a smooth ~2s fade rather than a hard cut. SFX
// are short one-shots; we keep a small pool of clones per sound so
// rapid successive triggers don't cut each other off.

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
    // Start crossfading when ~FADE_MS remains.
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
    // Swap active/idle.
    [this.active, this.idle] = [this.idle, this.active];
    // After fade-out finishes, pause the now-idle track so we can rewind.
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
      // Autoplay blocked. Caller can retry on user interaction.
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

class SfxPool {
  private pool: HTMLAudioElement[] = [];
  private nextIdx = 0;

  constructor(url: string, size: number, volume: number = SFX_VOLUME) {
    for (let i = 0; i < size; i++) {
      const a = new Audio(url);
      a.preload = 'auto';
      a.volume = volume;
      this.pool.push(a);
    }
  }

  play(): void {
    const a = this.pool[this.nextIdx];
    this.nextIdx = (this.nextIdx + 1) % this.pool.length;
    a.currentTime = 0;
    void a.play().catch(() => {});
  }
}

export class AudioSystem {
  private music = new BackgroundMusic();
  private pop = new SfxPool(POP_URL, 6);
  private bomb = new SfxPool(BOMB_URL, 3);
  private mistake = new SfxPool(MISTAKE_URL, 3);
  private gameover = new SfxPool(GAMEOVER_URL, 1);

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

// ─── Global UI click pool ─────────────────────────────────────────────
//
// Lives outside AudioSystem because button clicks fire from non-game
// contexts too (start screen, modals, leaderboard). Lazily constructed
// on first use so the file is cheap to import in SSR / tests.
let uiClickPool: SfxPool | null = null;

export function playUiClick(): void {
  if (!uiClickPool) {
    uiClickPool = new SfxPool(CLICK_URL, 4, CLICK_VOLUME);
  }
  uiClickPool.play();
}
