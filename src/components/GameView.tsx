import { useEffect, useRef, useState } from 'react';
import { HandTracker, type HandSnapshot } from '../game/tracking';
import { FlickDetector } from '../game/gesture';
import { GESTURE, TRACKING } from '../game/config';
import './GameView.css';

type Status = 'asking' | 'loading' | 'ready' | 'error';

const HAND_LOST_TIMEOUT_MS = 300;
const SHOT_EFFECT_MS = 280;

type ShotEffect = { x: number; y: number; t: number };

export function GameView() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<Status>('asking');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const tracker = new HandTracker();
    const flick = new FlickDetector();
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
        await tracker.init();
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
        let flickCount = 0;
        let peakRotationRate = 0;
        let totalRotation = 0;
        let peakRelVy = 0;
        let recentRelVy = 0;
        let lastFiredBy: 'angular' | 'linear' | null = null;

        const loop = (ts: number) => {
          raf = requestAnimationFrame(loop);
          if (video.readyState < 2) return;

          const w = canvas.width;
          const h = canvas.height;

          // Mirrored video as background.
          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(video, -w, 0, w, h);
          ctx.restore();

          const snap: HandSnapshot | null = tracker.detect(video, ts);
          if (snap) {
            const { fingertip, wrist } = snap;

            // Crosshair follows the absolute fingertip (mirrored).
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

            // Flick detection works on rotation of the wrist→fingertip
            // unit vector, so pure hand translation produces no signal
            // even when MediaPipe landmarks are noisy under fast motion.
            const result = flick.push(
              fingertip.x,
              fingertip.y,
              wrist.x,
              wrist.y,
              ts
            );
            peakRotationRate = result.peakRotationRate;
            totalRotation = result.totalRotation;
            peakRelVy = result.peakRelVy;
            recentRelVy = result.recentRelVy;
            if (result.fired && smoothed) {
              shots.push({ x: smoothed.x, y: smoothed.y, t: ts });
              flickCount++;
              lastFiredBy = result.firedBy;
            }
          }

          const handLost = !smoothed || ts - lastSeenMs > HAND_LOST_TIMEOUT_MS;
          if (handLost) flick.reset();

          // Expire old shot effects.
          for (let i = shots.length - 1; i >= 0; i--) {
            if (ts - shots[i].t > SHOT_EFFECT_MS) shots.splice(i, 1);
          }

          // Draw shots beneath the crosshair.
          for (const s of shots) {
            drawShotEffect(ctx, s.x, s.y, (ts - s.t) / SHOT_EFFECT_MS, dpr);
          }

          if (smoothed && !handLost) {
            drawCrosshair(ctx, smoothed.x, smoothed.y, dpr);
          }
          if (handLost) {
            drawHandLostBanner(ctx, w, h, dpr);
          }

          if (GESTURE.debugHud) {
            drawDebugHud(ctx, dpr, {
              flicks: flickCount,
              peakRotationRate,
              totalRotation,
              peakRelVy,
              recentRelVy,
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
          {status === 'loading' && <p>Loading hand tracking…</p>}
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
  age: number, // 0 (just fired) → 1 (about to expire)
  dpr: number
): void {
  const eased = 1 - Math.pow(1 - age, 2);
  const radius = (16 + eased * 70) * dpr;
  const alpha = 1 - age;

  ctx.save();
  // Outer expanding ring.
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
  ctx.lineWidth = (4 - age * 3) * dpr;
  ctx.shadowColor = `rgba(255, 130, 200, ${alpha})`;
  ctx.shadowBlur = 18 * dpr;
  ctx.stroke();

  // Sparkle cross — Y2K vibe.
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

function drawDebugHud(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  s: {
    flicks: number;
    peakRotationRate: number;
    totalRotation: number;
    peakRelVy: number;
    recentRelVy: number;
    lastFiredBy: 'angular' | 'linear' | null;
  }
): void {
  ctx.save();
  ctx.font = `500 ${14 * dpr}px ui-monospace, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const lines = [
    `flicks: ${s.flicks}  via: ${s.lastFiredBy ?? '—'}`,
    `── angular ──`,
    `peak ↑rot: ${s.peakRotationRate.toFixed(2)} /s`,
    `total ↑rot: ${s.totalRotation.toFixed(2)}`,
    `── linear ──`,
    `peak ↑vy: ${s.peakRelVy.toFixed(2)} u/s`,
    `recent vy: ${s.recentRelVy.toFixed(2)} u/s`,
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
