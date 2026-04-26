import { useEffect, useRef, useState } from 'react';
import { HandTracker, type Fingertip } from '../game/tracking';
import { TRACKING } from '../game/config';
import './GameView.css';

type Status = 'asking' | 'loading' | 'ready' | 'error';

const HAND_LOST_TIMEOUT_MS = 300;

export function GameView() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<Status>('asking');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const tracker = new HandTracker();
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

        // Smoothed crosshair position in canvas pixels.
        let smoothed: { x: number; y: number } | null = null;
        let lastSeenMs = 0;

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

          const tip: Fingertip | null = tracker.detect(video, ts);
          if (tip) {
            // Mirror X to match the displayed (mirrored) video.
            const targetX = (1 - tip.x) * w;
            const targetY = tip.y * h;
            if (!smoothed) {
              smoothed = { x: targetX, y: targetY };
            } else {
              const a = TRACKING.smoothing;
              smoothed.x += (targetX - smoothed.x) * a;
              smoothed.y += (targetY - smoothed.y) * a;
            }
            lastSeenMs = ts;
          }

          const handLost = !smoothed || ts - lastSeenMs > HAND_LOST_TIMEOUT_MS;

          if (smoothed && !handLost) {
            drawCrosshair(ctx, smoothed.x, smoothed.y, dpr);
          }
          if (handLost) {
            drawHandLostBanner(ctx, w, h, dpr);
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
          {status === 'asking' && (
            <p>Please allow webcam access to play.</p>
          )}
          {status === 'loading' && (
            <p>Loading hand tracking…</p>
          )}
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

  // Outer pink ring with glow.
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#ff4fa6';
  ctx.lineWidth = 3 * dpr;
  ctx.shadowColor = 'rgba(255, 130, 200, 0.9)';
  ctx.shadowBlur = 14 * dpr;
  ctx.stroke();

  // Inner white dot.
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Crosshair tick marks.
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
