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
  decayShake,
  updateEffects,
  type Effect,
  type Shake,
} from '../game/effects';
import { createGameState, damageLives, type GameState } from '../game/state';
import { GESTURE, LIVES, PHYSICS, TRACKING } from '../game/config';
import './GameView.css';

type Status = 'asking' | 'loading' | 'ready' | 'error';

const HAND_LOST_TIMEOUT_MS = 300;
const SHOT_EFFECT_MS = 280;
const MAX_DT_SEC = 0.05;
const SHAKE_KICK_PX = 22; // css px; multiplied by dpr at runtime
const PARTICLE_GRAVITY = 1500; // px/s² for burst particles (css; ×dpr)

type ShotEffect = { x: number; y: number; t: number };

export function GameView() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<Status>('asking');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const tracker = new HandTracker();
    const flick = new FlickDetector();
    const assets = new AssetRegistry();
    const spawner = new Spawner();
    const entities: Entity[] = [];
    const effects: Effect[] = [];
    const shake: Shake = { intensity: 0 };
    const gameState: GameState = createGameState();

    let raf = 0;
    let stream: MediaStream | null = null;
    let cancelled = false;
    let onResize: (() => void) | null = null;

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
        let peakRotationRate = 0;
        let totalRotation = 0;
        let peakAbsVy = 0;
        let recentAbsVy = 0;
        let vxAtPeak = 0;
        let lastFiredBy: 'angular' | 'linear' | null = null;
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
          let firedThisFrame = false;
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
            peakRotationRate = result.peakRotationRate;
            totalRotation = result.totalRotation;
            peakAbsVy = result.peakAbsVy;
            recentAbsVy = result.recentAbsVy;
            vxAtPeak = result.vxAtPeak;

            if (result.fired && smoothed && !gameState.gameOver) {
              firedThisFrame = true;
              gameState.flicksTotal++;
              shots.push({ x: smoothed.x, y: smoothed.y, t: ts });
              lastFiredBy = result.firedBy;

              // Resolve collision against current entities.
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
                } else {
                  gameState.bombsHit++;
                  effects.push(createExplosionEffect(hit.x, hit.y, ts));
                  shake.intensity = SHAKE_KICK_PX * dpr;
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
          void firedThisFrame;

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
              // Off-screen unshot: fruits cost a life, bombs are correctly avoided.
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

          // ── Effect physics + shake decay ───────────────────────────
          updateEffects(effects, dt, PARTICLE_GRAVITY * dpr);
          for (let i = effects.length - 1; i >= 0; i--) {
            const eff = effects[i];
            if (ts - eff.startedAt > eff.duration) effects.splice(i, 1);
          }
          decayShake(shake, dt);

          // ── Draw: screen-shake-affected layer ──────────────────────
          ctx.save();
          if (shake.intensity > 0) {
            const sx = (Math.random() - 0.5) * 2 * shake.intensity;
            const sy = (Math.random() - 0.5) * 2 * shake.intensity;
            ctx.translate(sx, sy);
          }

          // Mirrored video background.
          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(video, -w, 0, w, h);
          ctx.restore();

          for (const e of entities) drawEntity(ctx, e);

          for (const eff of effects) {
            const age = (ts - eff.startedAt) / eff.duration;
            if (eff.kind === 'burst') drawBurst(ctx, eff, age);
            else drawExplosion(ctx, eff, age, dpr);
          }

          for (let i = shots.length - 1; i >= 0; i--) {
            if (ts - shots[i].t > SHOT_EFFECT_MS) shots.splice(i, 1);
          }
          for (const s of shots) {
            drawShotEffect(ctx, s.x, s.y, (ts - s.t) / SHOT_EFFECT_MS, dpr);
          }

          if (smoothed && !handLost) {
            drawCrosshair(ctx, smoothed.x, smoothed.y, dpr);
          }
          ctx.restore(); // end shake transform

          // ── Draw: HUD layer (no shake) ─────────────────────────────
          if (handLost && !gameState.gameOver) {
            drawHandLostBanner(ctx, w, h, dpr);
          }

          const elapsedSec = gameState.gameOver
            ? gameState.finalElapsedSec
            : spawner.getElapsed();
          drawGameTimer(ctx, w, dpr, elapsedSec);
          drawLivesHud(ctx, w, dpr, gameState.lives);

          if (gameState.gameOver) {
            drawGameOverOverlay(ctx, w, h, dpr, gameState);
          }

          if (GESTURE.debugHud) {
            drawDebugHud(ctx, dpr, {
              flicks: gameState.flicksTotal,
              peakRotationRate,
              totalRotation,
              peakAbsVy,
              recentAbsVy,
              vxAtPeak,
              lastFiredBy,
            });
          }
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
      if (onResize) window.removeEventListener('resize', onResize);
      stream?.getTracks().forEach((t) => t.stop());
      tracker.dispose();
    };
  }, []);

  return (
    <div className="game-view">
      <video ref={videoRef} className="hidden-video" playsInline muted />
      <canvas ref={canvasRef} className="game-canvas" />
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

// ─── Entity construction ─────────────────────────────────────────────

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

  // Difficulty-tier "speedMultiplier" k compresses trajectory timing without
  // changing arc shape. Mathematically: scaling velocity by k while scaling
  // gravity by k² preserves apogee (= v²/2g unchanged) and horizontal reach,
  // but the fruit traces the same arc in 1/k the time — i.e. it actually
  // moves k× faster across the screen, which is the intended "faster
  // fruits" feel. Without the k² gravity scaling, peak height grows like
  // k², so a 1.7× tier launches fruits 2.9× higher and they fly off-screen.
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

// ─── Drawing helpers ─────────────────────────────────────────────────

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
  // Bright flash core (fades fast).
  if (age < 0.3) {
    ctx.beginPath();
    ctx.arc(eff.x, eff.y, radius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 230, 240, ${(0.3 - age) * 2.5})`;
    ctx.fill();
  }
  // Expanding ring.
  ctx.beginPath();
  ctx.arc(eff.x, eff.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 79, 100, ${alpha * 0.95})`;
  ctx.lineWidth = (8 - age * 6) * dpr;
  ctx.shadowColor = `rgba(255, 130, 130, ${alpha})`;
  ctx.shadowBlur = 28 * dpr;
  ctx.stroke();

  // Radial sparks.
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

function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dpr: number
): void {
  const r = 14 * dpr;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#ff4fa6';
  ctx.lineWidth = 3 * dpr;
  ctx.shadowColor = 'rgba(255, 130, 200, 0.9)';
  ctx.shadowBlur = 14 * dpr;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - r * 1.7, y);
  ctx.lineTo(x - r * 0.65, y);
  ctx.moveTo(x + r * 0.65, y);
  ctx.lineTo(x + r * 1.7, y);
  ctx.moveTo(x, y - r * 1.7);
  ctx.lineTo(x, y - r * 0.65);
  ctx.moveTo(x, y + r * 0.65);
  ctx.lineTo(x, y + r * 1.7);
  ctx.strokeStyle = '#ff4fa6';
  ctx.lineWidth = 2 * dpr;
  ctx.stroke();
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

function drawHandLostBanner(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number
): void {
  const text = 'Show your hand!';
  const fontPx = 26 * dpr;
  ctx.save();
  ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
  const metrics = ctx.measureText(text);
  const padX = 28 * dpr;
  const padY = 14 * dpr;
  const boxW = metrics.width + padX * 2;
  const boxH = fontPx + padY * 2;
  const boxX = (w - boxW) / 2;
  const boxY = h - boxH - 36 * dpr;
  const radius = 18 * dpr;
  ctx.fillStyle = 'rgba(255, 79, 166, 0.92)';
  ctx.shadowColor = 'rgba(255, 130, 200, 0.6)';
  ctx.shadowBlur = 24 * dpr;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, radius);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, boxY + boxH / 2);
  ctx.restore();
}

function drawGameTimer(
  ctx: CanvasRenderingContext2D,
  w: number,
  dpr: number,
  elapsedSec: number
): void {
  const text = `${elapsedSec.toFixed(2)}s`;
  ctx.save();
  ctx.font = `700 ${48 * dpr}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(255, 130, 200, 0.9)';
  ctx.shadowBlur = 16 * dpr;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, w / 2, 28 * dpr);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ff4fa6';
  ctx.fillText(text, w / 2, 28 * dpr);
  ctx.restore();
}

// ─── Lives HUD ───────────────────────────────────────────────────────

/** Builds the parametric heart curve, centered on (0, 0). */
function heartPath(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.beginPath();
  // x(t) = 16 sin³t, y(t) = 13 cos t − 5 cos 2t − 2 cos 3t − cos 4t
  // (classic heart curve). Scale 32 px → `size`.
  const scale = size / 34;
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3) * scale;
    const y =
      -(13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t)) *
      scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawHeart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  fillFraction: 0 | 0.5 | 1,
  dpr: number
): void {
  ctx.save();
  ctx.translate(cx, cy);

  const fill = '#ff4fa6';
  const empty = 'rgba(255, 255, 255, 0.35)';
  const stroke = '#ffffff';

  // Empty fill (base).
  heartPath(ctx, size);
  ctx.fillStyle = fillFraction === 0 ? empty : empty;
  ctx.fill();

  if (fillFraction === 1) {
    heartPath(ctx, size);
    ctx.fillStyle = fill;
    ctx.shadowColor = 'rgba(255, 79, 166, 0.7)';
    ctx.shadowBlur = 10 * dpr;
    ctx.fill();
  } else if (fillFraction === 0.5) {
    // Clip to the left half, then fill.
    ctx.save();
    ctx.beginPath();
    ctx.rect(-size, -size, size, size * 2);
    ctx.clip();
    heartPath(ctx, size);
    ctx.fillStyle = fill;
    ctx.shadowColor = 'rgba(255, 79, 166, 0.7)';
    ctx.shadowBlur = 10 * dpr;
    ctx.fill();
    ctx.restore();
  }

  // Outline last so it sits crisply on top.
  heartPath(ctx, size);
  ctx.lineWidth = 2 * dpr;
  ctx.strokeStyle = stroke;
  ctx.shadowBlur = 0;
  ctx.stroke();

  ctx.restore();
}

function drawLivesHud(
  ctx: CanvasRenderingContext2D,
  w: number,
  dpr: number,
  lives: number
): void {
  const heartSize = 32 * dpr;
  const gap = 10 * dpr;
  const padding = 28 * dpr;
  const total = 5;

  // Right-aligned row in the top corner.
  const rowW = total * heartSize + (total - 1) * gap;
  const startX = w - padding - rowW + heartSize / 2;
  const cy = padding + heartSize / 2;

  for (let i = 0; i < total; i++) {
    const cx = startX + i * (heartSize + gap);
    // Each heart represents 1 life. Heart i is "full" if lives > i,
    // "half" if lives > i - 0.5, otherwise empty.
    let fraction: 0 | 0.5 | 1 = 0;
    if (lives >= i + 1) fraction = 1;
    else if (lives >= i + 0.5) fraction = 0.5;
    drawHeart(ctx, cx, cy, heartSize, fraction, dpr);
  }
}

function drawGameOverOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
  state: GameState
): void {
  // Semi-transparent dim.
  ctx.save();
  ctx.fillStyle = 'rgba(20, 5, 25, 0.55)';
  ctx.fillRect(0, 0, w, h);

  // Card.
  const cardW = 480 * dpr;
  const cardH = 320 * dpr;
  const cardX = (w - cardW) / 2;
  const cardY = (h - cardH) / 2;
  ctx.fillStyle = 'rgba(255, 240, 247, 0.96)';
  ctx.shadowColor = 'rgba(255, 79, 166, 0.6)';
  ctx.shadowBlur = 32 * dpr;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 24 * dpr);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ff4fa6';
  ctx.font = `800 ${48 * dpr}px system-ui, sans-serif`;
  ctx.fillText('GAME OVER', w / 2, cardY + 60 * dpr);

  ctx.fillStyle = '#6b2348';
  ctx.font = `700 ${72 * dpr}px system-ui, sans-serif`;
  ctx.fillText(
    `${state.finalElapsedSec.toFixed(2)}s`,
    w / 2,
    cardY + 140 * dpr
  );

  ctx.fillStyle = '#a04074';
  ctx.font = `500 ${16 * dpr}px ui-monospace, monospace`;
  const accuracy =
    state.flicksTotal > 0
      ? ((state.flicksHit / state.flicksTotal) * 100).toFixed(0) + '%'
      : '—';
  const stats = [
    `fruits burst: ${state.fruitsBurst}`,
    `bombs hit: ${state.bombsHit}    bombs avoided: ${state.bombsAvoided}`,
    `fruits missed: ${state.fruitsMissed}    accuracy: ${accuracy}`,
  ];
  for (let i = 0; i < stats.length; i++) {
    ctx.fillText(stats[i], w / 2, cardY + 200 * dpr + i * 22 * dpr);
  }

  ctx.font = `500 ${14 * dpr}px system-ui, sans-serif`;
  ctx.fillStyle = '#a04074';
  ctx.fillText('Refresh page to play again', w / 2, cardY + cardH - 30 * dpr);
  ctx.restore();
}

function drawDebugHud(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  s: {
    flicks: number;
    peakRotationRate: number;
    totalRotation: number;
    peakAbsVy: number;
    recentAbsVy: number;
    vxAtPeak: number;
    lastFiredBy: 'angular' | 'linear' | null;
  }
): void {
  ctx.save();
  ctx.font = `500 ${14 * dpr}px ui-monospace, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const ratio =
    Math.abs(s.vxAtPeak) > 0.001
      ? (Math.abs(s.peakAbsVy) / Math.abs(s.vxAtPeak)).toFixed(2)
      : '∞';
  const lines = [
    `flicks: ${s.flicks}  via: ${s.lastFiredBy ?? '—'}`,
    `── angular ──`,
    `peak ↑rot: ${s.peakRotationRate.toFixed(2)} /s`,
    `total ↑rot: ${s.totalRotation.toFixed(2)}`,
    `── linear (abs) ──`,
    `peak ↑vy: ${s.peakAbsVy.toFixed(2)} u/s`,
    `recent vy: ${s.recentAbsVy.toFixed(2)} u/s`,
    `vx@peak: ${s.vxAtPeak.toFixed(2)} u/s`,
    `|vy|/|vx|: ${ratio}`,
  ];
  const padX = 12 * dpr;
  const padY = 8 * dpr;
  const lineH = 18 * dpr;
  const boxW = 240 * dpr;
  const boxH = padY * 2 + lineH * lines.length;
  const x = 16 * dpr;
  const y = 16 * dpr;
  ctx.fillStyle = 'rgba(26, 12, 28, 0.65)';
  ctx.beginPath();
  ctx.roundRect(x, y, boxW, boxH, 10 * dpr);
  ctx.fill();
  ctx.fillStyle = '#ffd6ec';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x + padX, y + padY + i * lineH);
  }
  ctx.restore();
}
