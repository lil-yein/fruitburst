// Start screen: logo + camera-permission primer + Start/Leaderboard
// buttons. Background mirrors the in-game pink grid playfield so the
// visual transition into a run feels continuous. Eight decorative
// fruits/bombs idle-float around the edges of the screen — same
// animation, staggered timing.
//
// Camera-permission gating:
//   • On mount we trigger a getUserMedia probe to ask the browser for
//     camera access and immediately release the resulting tracks.
//     GameView re-requests fresh tracks on its own mount; once the
//     user has granted, that re-request is silent.
//   • While permission is pending or denied, the Start Game button is
//     visually soft-disabled (opacity 0.5) but still clickable so we
//     can surface a warning toast on press.
//   • The first time permission flips to granted we show a "Tracking
//     ✅" success toast that fades after 10s. The warning toast also
//     fades after 10s and resets if the user re-clicks.

import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import './StartScreen.css';

export type StartScreenProps = {
  onStart: () => void;
  onLeaderboard: () => void;
};

type PermissionStatus = 'pending' | 'granted' | 'denied';

type Decoration = {
  src: string;
  side: 'left' | 'right';
  /** Vertical position as % of viewport (top of the bounding box). */
  top: number;
  /** Distance from the chosen edge as % of viewport width. */
  offset: number;
  /** Width in css px. Height auto-derives from the SVG's natural aspect. */
  w: number;
  /** Animation phase offset in seconds. */
  delay: number;
};

const DECORATIONS: Decoration[] = [
  // ── Left side (top → bottom): cherry, kiwi, orange, dragon ──
  { src: '/assets/fruits/cherry.svg',    side: 'left',  top: 18.3, offset:  5.1, w: 160, delay: 0.0 },
  { src: '/assets/fruits/kiwi.svg',      side: 'left',  top: 31.0, offset: 16.5, w: 140, delay: 0.4 },
  { src: '/assets/fruits/orange.svg',    side: 'left',  top: 49.5, offset:  5.2, w: 140, delay: 0.8 },
  { src: '/assets/fruits/dragon.svg',    side: 'left',  top: 56.3, offset: 18.5, w: 120, delay: 1.2 },
  // ── Right side (top → bottom): apple, banana, pineapple, bomb ──
  { src: '/assets/fruits/apple.svg',     side: 'right', top: 18.6, offset: 17.0, w: 140, delay: 0.2 },
  { src: '/assets/fruits/banana.svg',    side: 'right', top: 35.8, offset:  5.2, w: 160, delay: 0.6 },
  { src: '/assets/fruits/pineapple.svg', side: 'right', top: 47.1, offset: 18.5, w: 120, delay: 1.0 },
  { src: '/assets/bombs/bomb.svg',       side: 'right', top: 62.1, offset:  4.4, w: 140, delay: 1.4 },
];

const ALERT_LIFE_MS = 10_000;

export function StartScreen({ onStart, onLeaderboard }: StartScreenProps) {
  const [permission, setPermission] = useState<PermissionStatus>('pending');
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showWarningAlert, setShowWarningAlert] = useState(false);
  // Bumped each time an alert is (re-)shown so React remounts the node
  // and the CSS lifecycle animation restarts from 0.
  const [successAlertKey, setSuccessAlertKey] = useState(0);
  const [warningAlertKey, setWarningAlertKey] = useState(0);

  const successTimer = useRef<number | null>(null);
  const warningTimer = useRef<number | null>(null);

  // Probe camera access on mount. We immediately release the tracks —
  // we just need the OS-level permission flag flipped. GameView will
  // re-request its own stream when it mounts.
  useEffect(() => {
    let cancelled = false;
    let probeStream: MediaStream | null = null;

    (async () => {
      try {
        probeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        if (cancelled) return;
        setPermission('granted');
        triggerSuccessAlert();
      } catch {
        if (cancelled) return;
        setPermission('denied');
      } finally {
        probeStream?.getTracks().forEach((t) => t.stop());
      }
    })();

    return () => {
      cancelled = true;
      probeStream?.getTracks().forEach((t) => t.stop());
      if (successTimer.current) clearTimeout(successTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
    };
  }, []);

  const triggerSuccessAlert = () => {
    setSuccessAlertKey((k) => k + 1);
    setShowSuccessAlert(true);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = window.setTimeout(() => {
      setShowSuccessAlert(false);
    }, ALERT_LIFE_MS);
  };

  const triggerWarningAlert = () => {
    setWarningAlertKey((k) => k + 1);
    setShowWarningAlert(true);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    warningTimer.current = window.setTimeout(() => {
      setShowWarningAlert(false);
    }, ALERT_LIFE_MS);
  };

  const handleStartClick = () => {
    if (permission !== 'granted') {
      triggerWarningAlert();
      return;
    }
    onStart();
  };

  const startBtnDisabled = permission !== 'granted';

  return (
    <div className="start-screen">
      {DECORATIONS.map((d, i) => (
        <div
          key={i}
          className="start-decoration"
          style={{
            top: `${d.top}%`,
            [d.side]: `${d.offset}%`,
            width: d.w,
            animationDelay: `${d.delay}s`,
          }}
        >
          <img src={d.src} alt="" className="start-decoration-img" />
        </div>
      ))}

      <div className="start-content">
        <img
          src="/assets/ui/logo.svg"
          alt="FruitBurst"
          className="start-logo"
        />

        <div className="start-description">
          <p className="start-headline">
            Quick heads up, we'll need your camera!
          </p>
          <p className="start-privacy">
            Your webcam stays on your computer.
            <br />
            Nothing leaves, nothing is saved.
          </p>
        </div>

        <div className="start-buttons">
          <Button
            variant="primary"
            onClick={handleStartClick}
            className={startBtnDisabled ? 'fb-button--soft-disabled' : ''}
          >
            Start Game
          </Button>
          <Button variant="secondary" onClick={onLeaderboard}>
            Leaderboard
          </Button>
        </div>
      </div>

      {/* Permission alerts. CSS animation handles the 10s lifecycle
          (fade in → hold → fade out) without React re-rendering. */}
      {showSuccessAlert && (
        <div className="start-alert start-alert--success" key={`s-${successAlertKey}`}>
          <Alert>Tracking ✅ - Let's get started!</Alert>
        </div>
      )}
      {showWarningAlert && (
        <div className="start-alert start-alert--warning" key={`w-${warningAlertKey}`}>
          <Alert>⚠️ Please allow camera access to play</Alert>
        </div>
      )}
    </div>
  );
}
