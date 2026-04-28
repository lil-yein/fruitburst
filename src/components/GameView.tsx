import { useEffect, useRef, useState } from 'react';
import { HandTracker, type HandSnapshot } from '../game/tracking';
import { FlickDetector } from '../game/gesture';
import { AssetRegistry } from '../game/assets';
import { Spawner, type SpawnRequest } from '../game/spawner';
import { updateEntity } from '../game/physics';
import {
  isOffScreenBottom,
  newEntityId,
  type Entity,
} from '../game/entities';
import { resolveFlickHit } from '../game/collision';
import {
  createBurstEffect,
  createExplosionEffect,
  createHealEffect,
  decayShake,
  updateEffects,
  type Effect,
  type Shake,
} from '../game/effects';
import {
  createGameState,
  damageLives,
  healLives,
  type GameState,
} from '../game/state';
import { AudioSystem } from '../game/audio';
import { GESTURE, LIVES, PHYSICS, TRACKING } from '../game/config';
import { Alert } from './ui/Alert';
import './GameView.css';

type Status = 'asking' | 'loading' | 'ready' | 'error';

const HAND_LOST_TIMEOUT_MS = 300;
const SHOT_EFFECT_MS = 280;
const MAX_DT_SEC = 0.05;
const SHAKE_KICK_PX = 22;
const PARTICLE_GRAVITY = 1500;
/** Pause after lives hit 0 before handing off to the game-over screen — lets
 *  the killing-blow explosion / shake play out so the transition feels
 *  earned instead of jarring. */
const GAME_OVER_HOLD_MS = 1500;

/** Snapshot of a finished run, handed off to the game-over screen. */
export type GameRunResult = {
  timeSec: number;
  fruitsBurst: number;
  bombsHit: number;
  bombsAvoided: number;
  fruitsMissed: number;
  flicksTotal: number;
  flicksHit: number;
};

type ShotEffect = { x: number; y: number; t: number };

type HudSnapshot = {
  elapsedSec: number;
  lives: number;
  gameOver: boolean;
  fruitsBurst: number;
  bombsHit: number;
  bombsAvoided: number;
  fruitsMissed: number;
  flicksTotal: number;
  flicksHit: number;
  finalElapsedSec: number;
  handLost: boolean;
};

const INITIAL_HUD: HudSnapshot = {
  elapsedSec: 0,
  lives: LIVES.start,
  gameOver: false,
  fruitsBurst: 0,
  bombsHit: 0,
  bombsAvoided: 0,
  fruitsMissed: 0,
  flicksTotal: 0,
  flicksHit: 0,
  finalElapsedSec: 0,
  handLost: false,
};

export type GameViewProps = {
  /** Called once the game ends and the death animation has played out.
   *  Parent should switch to the game-over screen with this run's stats. */
  onGameOver: (result: GameRunResult) => void;
};

export function GameView({ onGameOver }: GameViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<Status>('asking');
  const [errorMsg, setErrorMsg] = useState('');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  // Keep onGameOver in a ref so the long-lived rAF loop always sees the
  // current callback without resubscribing.
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  useEffect(() => {
    const tracker = new HandTracker();
    const flick = new FlickDetector();
    const assets = new AssetRegistry();
    const spawner = new Spawner();
    const audio = new AudioSystem();
    const entities: Entity[] = [];
    const effects: Effect[] = [];
    const shake: Shake = { intensity: 0 };
    const gameState: GameState = createGameState();

    let raf = 0;
    let stream: MediaStream | null = null;
    let cancelled = false;
    let onResize: (() => void) | null = null;
    let gameOverHandoffScheduled = false;
    let gameOverHandoffTimer = 0;

    const run = async () => {
      try {
        setStatus('asking');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        video.srcObject = stream;
        await video.play();

        setStatus('loading');
        await Promise.all([tracker.init(), assets.load()]);
        if (cancelled) return;
        setStatus('ready');

        // Kick off background music once everything is loaded.
        // Some browsers block autoplay until first user gesture; if so it's
        // a no-op and the user's first flick will be silent. Fine.
        void audio.startMusic();

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');

        const dpr = window.devicePixelRatio || 1;
        onResize = () => {
          canvas.width = canvas.clientWidth * dpr;
          canvas.height = canvas.clientHeight * dpr;
        };
        onResize();
        window.addEventListener('resize', onResize);

        let smoothed: { x: number; y: number } | null = null;
        let lastSeenMs = 0;
        const shots: ShotEffect[] = [];
        const crosshairImg = assets.crosshairImage();
        let lastFrameMs = performance.now();

        const loop = (ts: number) => {
          raf = requestAnimationFrame(loop);
          if (video.readyState < 2) return;

          const dt = Math.min((ts - lastFrameMs) / 1000, MAX_DT_SEC);
          lastFrameMs = ts;

          const w = canvas.width;
          const h = canvas.height;

          // ── Hand tracking + flick detection ────────────────────────
          const snap: HandSnapshot | null = tracker.detect(video, ts);
          if (snap) {
            const { fingertip, wrist } = snap;
            const targetX = (1 - fingertip.x) * w;
            const targetY = fingertip.y * h;
            if (!smoothed) {
              smoothed = { x: targetX, y: targetY };
            } else {
              const a = TRACKING.smoothing;
              smoothed.x += (targetX - smoothed.x) * a;
              smoothed.y += (targetY - smoothed.y) * a;
            }
            lastSeenMs = ts;

            const result = flick.push(
              fingertip.x,
              fingertip.y,
              wrist.x,
              wrist.y,
              ts
            );
            if (result.fired && smoothed && !gameState.gameOver) {
              gameState.flicksTotal++;
              shots.push({ x: smoothed.x, y: smoothed.y, t: ts });

              const hitRadius = GESTURE.hitRadius * dpr;
              const hit = resolveFlickHit(
                smoothed.x,
                smoothed.y,
                entities,
                hitRadius
              );
              if (hit) {
                gameState.flicksHit++;
                hit.alive = false;
                if (hit.kind === 'fruit') {
                  gameState.fruitsBurst++;
                  effects.push(createBurstEffect(hit.x, hit.y, ts, dpr));
                  audio.playPop();
                  // Reward: +0.5 HP per fruit, capped at LIVES.max. The
                  // floating cue swaps to "Perfect!" the moment we top
                  // out; subsequent hits at max are silent.
                  const heal = healLives(gameState, LIVES.fruitBurstReward);
                  if (heal.applied) {
                    const label = heal.reachedMax
                      ? 'Perfect!'
                      : `+${LIVES.fruitBurstReward}`;
                    effects.push(createHealEffect(hit.x, hit.y, ts, label));
                  }
                } else {
                  gameState.bombsHit++;
                  effects.push(createExplosionEffect(hit.x, hit.y, ts));
                  shake.intensity = SHAKE_KICK_PX * dpr;
                  audio.playBomb();
                  damageLives(
                    gameState,
                    LIVES.shootBombPenalty,
                    ts,
                    spawner.getElapsed()
                  );
                }
              }
            }
          }

          const handLost = !smoothed || ts - lastSeenMs > HAND_LOST_TIMEOUT_MS;
          if (handLost) flick.reset();

          // ── Spawn + physics ────────────────────────────────────────
          if (!gameState.gameOver) {
            const requests = spawner.update(dt);
            for (const req of requests) {
              entities.push(buildEntity(req, w, h, dpr, assets));
            }
          }
          for (const e of entities) {
            updateEntity(e, dt);
            if (e.alive && isOffScreenBottom(e, h)) {
              if (!gameState.gameOver) {
                if (e.kind === 'fruit') {
                  gameState.fruitsMissed++;
                  damageLives(
                    gameState,
                    LIVES.missFruitPenalty,
                    ts,
                    spawner.getElapsed()
                  );
                } else {
                  gameState.bombsAvoided++;
                }
              }
              e.alive = false;
            }
          }
          for (let i = entities.length - 1; i >= 0; i--) {
            if (!entities[i].alive) entities.splice(i, 1);
          }

          // Once lives hit zero, hand the run off to the parent after a
          // short delay — lets the killing-blow effects play out first.
          if (gameState.gameOver && !gameOverHandoffScheduled) {
            gameOverHandoffScheduled = true;
            audio.stopMusic();
            gameOverHandoffTimer = window.setTimeout(() => {
              if (cancelled) return;
              onGameOverRef.current({
                timeSec: gameState.finalElapsedSec,
                fruitsBurst: gameState.fruitsBurst,
                bombsHit: gameState.bombsHit,
                bombsAvoided: gameState.bombsAvoided,
                fruitsMissed: gameState.fruitsMissed,
                flicksTotal: gameState.flicksTotal,
                flicksHit: gameState.flicksHit,
              });
            }, GAME_OVER_HOLD_MS);
          }

          // ── Effect physics + shake decay ───────────────────────────
          updateEffects(effects, dt, PARTICLE_GRAVITY * dpr);
          for (let i = effects.length - 1; i >= 0; i--) {
            const eff = effects[i];
            if (ts - eff.startedAt > eff.duration) effects.splice(i, 1);
          }
          decayShake(shake, dt);

          // ── Render playfield (canvas) ──────────────────────────────
          ctx.clearRect(0, 0, w, h);
          ctx.save();
          if (shake.intensity > 0) {
            const sx = (Math.random() - 0.5) * 2 * shake.intensity;
            const sy = (Math.random() - 0.5) * 2 * shake.intensity;
            ctx.translate(sx, sy);
          }

          for (const e of entities) drawEntity(ctx, e);

          for (const eff of effects) {
            const age = (ts - eff.startedAt) / eff.duration;
            if (eff.kind === 'burst') drawBurst(ctx, eff, age);
            else if (eff.kind === 'explosion') drawExplosion(ctx, eff, age, dpr);
            else drawHealEffect(ctx, eff, age, dpr);
          }

          for (let i = shots.length - 1; i >= 0; i--) {
            if (ts - shots[i].t > SHOT_EFFECT_MS) shots.splice(i, 1);
          }
          for (const s of shots) {
            drawShotEffect(ctx, s.x, s.y, (ts - s.t) / SHOT_EFFECT_MS, dpr);
          }

          if (smoothed && !handLost) {
            drawCrosshair(ctx, smoothed.x, smoothed.y, dpr, crosshairImg);
          }
          ctx.restore();

          // ── Push HUD snapshot to React ─────────────────────────────
          const elapsed = gameState.gameOver
            ? gameState.finalElapsedSec
            : spawner.getElapsed();
          setHud({
            elapsedSec: elapsed,
            lives: gameState.lives,
            gameOver: gameState.gameOver,
            fruitsBurst: gameState.fruitsBurst,
            bombsHit: gameState.bombsHit,
            bombsAvoided: gameState.bombsAvoided,
            fruitsMissed: gameState.fruitsMissed,
            flicksTotal: gameState.flicksTotal,
            flicksHit: gameState.flicksHit,
            finalElapsedSec: gameState.finalElapsedSec,
            handLost,
          });
        };
        raf = requestAnimationFrame(loop);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMsg(msg);
        setStatus('error');
      }
    };

    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (gameOverHandoffTimer) clearTimeout(gameOverHandoffTimer);
      if (onResize) window.removeEventListener('resize', onResize);
      stream?.getTracks().forEach((t) => t.stop());
      tracker.dispose();
      audio.stopMusic();
    };
  }, []);

  return (
    <div className="game-frame">
      <div className="playfield">
        <canvas ref={canvasRef} className="game-canvas" />
      </div>

      <Scoreboard lives={hud.lives} fruitsBurst={hud.fruitsBurst} />
      <TimerPanel elapsedSec={hud.elapsedSec} />
      <WebcamPreview videoRef={videoRef} />

      {hud.handLost && status === 'ready' && !hud.gameOver && (
        <div className="hand-lost-wrapper">
          <Alert>⚠️ Show your hand!</Alert>
        </div>
      )}

      {status !== 'ready' && (
        <div className="status-overlay">
          {status === 'asking' && <p>Please allow webcam access to play.</p>}
          {status === 'loading' && <p>Loading hand tracking + assets…</p>}
          {status === 'error' && (
            <>
              <p className="status-error">Webcam error</p>
              <p className="status-detail">{errorMsg}</p>
              <p className="status-detail">
                Check that no other app is using the camera, then refresh.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── HUD components ──────────────────────────────────────────────────

function Scoreboard({
  lives,
  fruitsBurst,
}: {
  lives: number;
  fruitsBurst: number;
}) {
  // Each heart represents 1 life with half-heart granularity.
  const hearts: Array<'full' | 'half' | 'empty'> = [];
  for (let i = 0; i < 5; i++) {
    if (lives >= i + 1) hearts.push('full');
    else if (lives >= i + 0.5) hearts.push('half');
    else hearts.push('empty');
  }

  return (
    <div className="scoreboard">
      <div className="scoreboard-card">
        <div className="scoreboard-fruit">Fruit {fruitsBurst}</div>
        <div className="scoreboard-divider" />
        <div className="scoreboard-hp">
          <span className="scoreboard-hp-label">HP</span>
          <div className="scoreboard-hearts">
            {hearts.map((kind, i) => (
              <img
                key={i}
                className="scoreboard-heart"
                src={`/assets/ui/heart-${kind}.png`}
                alt={kind === 'full' ? '♥' : kind === 'half' ? '◐' : '♡'}
              />
            ))}
          </div>
        </div>
      </div>
      {/* Pearl border. Top/bottom rows include the corner pearls; left/right
          cols sit between them. Centers align on the card's outer edge. */}
      <PearlLine side="top" count={12} />
      <PearlLine side="bottom" count={12} />
      <PearlLine side="left" count={4} />
      <PearlLine side="right" count={4} />
    </div>
  );
}

function PearlLine({
  side,
  count,
}: {
  side: 'top' | 'bottom' | 'left' | 'right';
  count: number;
}) {
  return (
    <div className={`scoreboard-pearls scoreboard-pearls--${side}`}>
      {Array.from({ length: count }).map((_, i) => (
        <img
          key={i}
          className="pearl"
          src="/assets/ui/silverball.png"
          alt=""
        />
      ))}
    </div>
  );
}

function TimerPanel({ elapsedSec }: { elapsedSec: number }) {
  const totalCs = Math.floor(elapsedSec * 100);
  const minutes = Math.floor(totalCs / 6000);
  const seconds = Math.floor((totalCs % 6000) / 100);
  const mm = String(Math.min(99, minutes)).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return (
    <div className="timer-panel">
      <img className="timer-bg" src="/assets/ui/time.png" alt="" />
      <div className="timer-text">
        {mm} : {ss}
      </div>
    </div>
  );
}

function WebcamPreview({
  videoRef,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  return (
    <div className="webcam-preview">
      <video ref={videoRef} className="webcam-video" playsInline muted />
    </div>
  );
}

// ─── Entity construction (unchanged from CP4) ────────────────────────

function buildEntity(
  req: SpawnRequest,
  canvasW: number,
  canvasH: number,
  dpr: number,
  assets: AssetRegistry
): Entity {
  const margin = PHYSICS.spawnEdgeMargin * dpr;
  const x = margin + Math.random() * (canvasW - 2 * margin);
  const size =
    (req.kind === 'bomb' ? PHYSICS.bombSize : PHYSICS.fruitSize) * dpr;
  const y = canvasH + size;

  const k = req.speedMultiplier;
  const vyMin = PHYSICS.initialVyMin * dpr * k;
  const vyMax = PHYSICS.initialVyMax * dpr * k;
  const vy = vyMin + Math.random() * (vyMax - vyMin);
  const vxRange = PHYSICS.initialVxRange * dpr * k;
  const centerOffset = (x - canvasW / 2) / (canvasW / 2);
  const vx =
    -centerOffset * vxRange * 0.7 +
    (Math.random() * 2 - 1) * vxRange * 0.3;
  const gravity = PHYSICS.gravity * dpr * k * k;
  const angularVelocity = (Math.random() * 2 - 1) * PHYSICS.spinRange * k;

  return {
    id: newEntityId(),
    kind: req.kind,
    x,
    y,
    vx,
    vy,
    rotation: 0,
    angularVelocity,
    gravity,
    size,
    image: req.kind === 'bomb' ? assets.bombImage() : assets.randomFruit(),
    alive: true,
    missed: false,
  };
}

// ─── Canvas drawing helpers ──────────────────────────────────────────

function drawEntity(ctx: CanvasRenderingContext2D, e: Entity): void {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.rotation);
  const ready = e.image.complete && e.image.naturalWidth > 0;
  if (ready) {
    const nw = e.image.naturalWidth;
    const nh = e.image.naturalHeight;
    let drawW: number;
    let drawH: number;
    if (nw >= nh) {
      drawW = e.size;
      drawH = e.size * (nh / nw);
    } else {
      drawH = e.size;
      drawW = e.size * (nw / nh);
    }
    ctx.drawImage(e.image, -drawW / 2, -drawH / 2, drawW, drawH);
  } else {
    const half = e.size / 2;
    ctx.beginPath();
    ctx.arc(0, 0, half, 0, Math.PI * 2);
    ctx.fillStyle = e.kind === 'bomb' ? '#1a1a1a' : '#ff8fcd';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = e.kind === 'bomb' ? '#ff5050' : '#ffffff';
    ctx.stroke();
  }
  ctx.restore();
}

function drawBurst(
  ctx: CanvasRenderingContext2D,
  eff: Extract<Effect, { kind: 'burst' }>,
  age: number
): void {
  const alpha = 1 - age;
  ctx.save();
  for (const p of eff.particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1 - age * 0.4), 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.fill();
  }
  ctx.restore();
}

function drawExplosion(
  ctx: CanvasRenderingContext2D,
  eff: Extract<Effect, { kind: 'explosion' }>,
  age: number,
  dpr: number
): void {
  const eased = 1 - Math.pow(1 - age, 2);
  const radius = (40 + eased * 220) * dpr;
  const alpha = 1 - age;

  ctx.save();
  if (age < 0.3) {
    ctx.beginPath();
    ctx.arc(eff.x, eff.y, radius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 230, 240, ${(0.3 - age) * 2.5})`;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(eff.x, eff.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 79, 100, ${alpha * 0.95})`;
  ctx.lineWidth = (8 - age * 6) * dpr;
  ctx.shadowColor = `rgba(255, 130, 130, ${alpha})`;
  ctx.shadowBlur = 28 * dpr;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(255, 220, 180, ${alpha * 0.8})`;
  ctx.lineWidth = 3 * dpr;
  const sparkCount = 8;
  for (let i = 0; i < sparkCount; i++) {
    const ang = (i / sparkCount) * Math.PI * 2;
    const r0 = radius * 0.6;
    const r1 = radius * 1.15;
    ctx.beginPath();
    ctx.moveTo(eff.x + Math.cos(ang) * r0, eff.y + Math.sin(ang) * r0);
    ctx.lineTo(eff.x + Math.cos(ang) * r1, eff.y + Math.sin(ang) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHealEffect(
  ctx: CanvasRenderingContext2D,
  eff: Extract<Effect, { kind: 'heal' }>,
  age: number,
  dpr: number
): void {
  // Float up and fade out. Easing: position uses ease-out so it pops up
  // quickly then settles; alpha eases-in-quad to fade more sharply at the end.
  const popEase = 1 - Math.pow(1 - age, 2);
  const yOffset = -64 * dpr * popEase;
  const alpha = age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3;

  // Slight scale pop on first ~20% of the lifetime for satisfaction.
  const scale = age < 0.2 ? 0.6 + (age / 0.2) * 0.5 : 1.0 + (age - 0.2) * 0.05;

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.translate(eff.x, eff.y + yOffset);
  ctx.scale(scale, scale);
  ctx.font = `700 ${28 * dpr}px 'Cafe24 PRO UP', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 130, 200, 0.95)';
  ctx.shadowBlur = 16 * dpr;
  // White stroke around pink fill for arcade-poster feel.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4 * dpr;
  ctx.strokeText(eff.label, 0, 0);
  ctx.fillStyle = '#ff4fa6';
  ctx.shadowBlur = 0;
  ctx.fillText(eff.label, 0, 0);
  ctx.restore();
}

/** On-screen crosshair size in CSS pixels. SVG native is 88×88; we scale
 *  it down so the crosshair sits comfortably under the fingertip without
 *  swallowing nearby fruits. */
const CROSSHAIR_SIZE_CSS = 56;

function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dpr: number,
  image: HTMLImageElement
): void {
  const size = CROSSHAIR_SIZE_CSS * dpr;
  ctx.save();
  // Subtle pink glow under the SVG so it pops on the busy playfield.
  ctx.shadowColor = 'rgba(254, 70, 182, 0.55)';
  ctx.shadowBlur = 12 * dpr;
  ctx.drawImage(image, x - size / 2, y - size / 2, size, size);
  ctx.restore();
}

function drawShotEffect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  age: number,
  dpr: number
): void {
  const eased = 1 - Math.pow(1 - age, 2);
  const radius = (16 + eased * 70) * dpr;
  const alpha = 1 - age;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
  ctx.lineWidth = (4 - age * 3) * dpr;
  ctx.shadowColor = `rgba(255, 130, 200, ${alpha})`;
  ctx.shadowBlur = 18 * dpr;
  ctx.stroke();
  const armLen = radius * 1.2;
  ctx.beginPath();
  ctx.moveTo(x - armLen, y);
  ctx.lineTo(x + armLen, y);
  ctx.moveTo(x, y - armLen);
  ctx.lineTo(x, y + armLen);
  ctx.strokeStyle = `rgba(255, 220, 240, ${alpha * 0.7})`;
  ctx.lineWidth = 2 * dpr;
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.restore();
}
