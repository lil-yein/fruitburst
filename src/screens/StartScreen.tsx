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
  /** Vertical position as % of viewport (top of the bounding box). */
  top: number;
  /** Distance from the chosen edge as % of viewport width. */
  offset: number;
  /** Bounding box width in css px (per Figma node 43:1867). */
  w: number;
  /** Bounding box height in css px. */
  h: number;
  /** Animation phase offset in seconds. */
  delay: number;
};

// Positions, sizes, and side assignments lifted directly from Figma node
// 43:1867. Anchored to viewport % so the layout still scales when the
// window isn't exactly 1280×832. Each fruit appears once; bomb lives in
// the bottom-right.
const DECORATIONS: Decoration[] = [
  // ── Left side (top → bottom): cherry, kiwi, orange, dragon ──
  { src: '/assets/fruits/cherry.svg',    side: 'left',  top: 18.3, offset:  5.1, w: 208, h: 208, delay: 0.0 },
  { src: '/assets/fruits/kiwi.svg',      side: 'left',  top: 26.2, offset: 16.5, w: 199, h: 309, delay: 0.4 },
  { src: '/assets/fruits/orange.svg',    side: 'left',  top: 49.5, offset:  5.2, w: 141, h: 160, delay: 0.8 },
  { src: '/assets/fruits/dragon.svg',    side: 'left',  top: 56.3, offset: 18.5, w: 169, h: 233, delay: 1.2 },
  // ── Right side (top → bottom): apple, banana, pineapple, bomb ──
  { src: '/assets/fruits/apple.svg',     side: 'right', top: 18.6, offset: 12.3, w: 170, h: 183, delay: 0.2 },
  { src: '/assets/fruits/banana.svg',    side: 'right', top: 31.0, offset:  5.2, w:  96, h: 173, delay: 0.6 },
  { src: '/assets/fruits/pineapple.svg', side: 'right', top: 47.1, offset: 13.8, w: 160, h: 153, delay: 1.0 },
  { src: '/assets/bombs/bomb.svg',       side: 'right', top: 62.1, offset:  4.4, w: 195, h: 195, delay: 1.4 },
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
            [d.side]: `${d.offset}%`,
            width: d.w,
            height: d.h,
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
