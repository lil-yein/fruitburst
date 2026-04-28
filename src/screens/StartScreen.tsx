// Start screen: logo + camera-permission primer + Start/Leaderboard
// buttons. Background mirrors the in-game pink grid playfield so the
// visual transition into a run feels continuous. Eight decorative
// fruits/bombs idle-float around the edges of the screen — same
// animation, staggered timing.

import { Button } from '../components/ui/Button';
import './StartScreen.css';

export type StartScreenProps = {
  onStart: () => void;
  onLeaderboard: () => void;
};

type Decoration = {
  src: string;
  side: 'left' | 'right';
  /** Vertical position as % of viewport. */ top: number;
  /** Distance from edge as % of viewport. */ edge: number;
  /** Size in CSS pixels. */ size: number;
  /** Animation phase offset in seconds. */ delay: number;
};

// Eight decorations, four per side. All share one float animation; the
// delay value is the only thing that varies the motion. Each fruit is
// used at most once so the screen feels intentional rather than tiled.
const DECORATIONS: Decoration[] = [
  // ── Left side ──
  { src: '/assets/fruits/apple.svg',     side: 'left',  top:  8, edge: 5,  size: 88, delay: 0.0 },
  { src: '/assets/fruits/cherry.svg',    side: 'left',  top: 30, edge: 14, size: 72, delay: 0.5 },
  { src: '/assets/fruits/kiwi.svg',      side: 'left',  top: 56, edge: 6,  size: 92, delay: 1.0 },
  { src: '/assets/bombs/bomb.svg',       side: 'left',  top: 78, edge: 12, size: 76, delay: 1.5 },
  // ── Right side ──
  { src: '/assets/fruits/orange.svg',    side: 'right', top: 12, edge: 6,  size: 84, delay: 0.3 },
  { src: '/assets/fruits/banana.svg',    side: 'right', top: 36, edge: 14, size: 88, delay: 0.8 },
  { src: '/assets/fruits/pineapple.svg', side: 'right', top: 60, edge: 8,  size: 80, delay: 1.3 },
  { src: '/assets/fruits/dragon.svg',    side: 'right', top: 82, edge: 12, size: 84, delay: 1.8 },
];

export function StartScreen({ onStart, onLeaderboard }: StartScreenProps) {
  return (
    <div className="start-screen">
      {DECORATIONS.map((d, i) => (
        <div
          key={i}
          className="start-decoration"
          style={{
            top: `${d.top}%`,
            [d.side]: `${d.edge}%`,
            width: d.size,
            height: d.size,
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
          <Button variant="primary" onClick={onStart}>
            Start Game
          </Button>
          <Button variant="secondary" onClick={onLeaderboard}>
            Leaderboard
          </Button>
        </div>
      </div>
    </div>
  );
}
