// Game-over modal — overlays the (paused) game screen the same way the
// calibration modal does. Striped pink top section with title + time +
// stats, lace divider, white-pink bottom area with name input + buttons.

import { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import {
  isValidName,
  saveScore,
  type LeaderboardEntry,
} from '../game/leaderboard';
import { LEADERBOARD } from '../game/config';
import type { GameRunResult } from './GameView';
import './GameOverModal.css';

export type GameOverModalProps = {
  run: GameRunResult;
  onSubmit: (entries: LeaderboardEntry[], submittedName: string) => void;
  onPlayAgain: () => void;
  onSkipToLeaderboard: () => void;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function GameOverModal({
  run,
  onSubmit,
  onPlayAgain,
  onSkipToLeaderboard,
}: GameOverModalProps) {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const accuracy =
    run.flicksTotal > 0
      ? Math.round((run.flicksHit / run.flicksTotal) * 100) + '%'
      : '—';

  // Display as MM : SS : CC (centiseconds), capped sensibly so a marathon
  // run doesn't overflow the digit box.
  const totalCs = Math.max(0, Math.floor(run.timeSec * 100));
  const minutes = Math.min(99, Math.floor(totalCs / 6000));
  const seconds = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;

  const canSubmit = isValidName(name) && !submitted;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitted(true);
    const entries = saveScore(name, run.timeSec);
    onSubmit(entries, name.trim());
  };

  const stats: Array<[string, string | number]> = [
    ['Fruits burst', run.fruitsBurst],
    ['Bombs avoided', run.bombsAvoided],
    ['Bombs hit', run.bombsHit],
    ['Fruits missed', run.fruitsMissed],
    ['Accuracy', accuracy],
  ];

  return (
    <div className="go-overlay">
      <div className="go-modal">
        <div className="go-stripes">
          {Array.from({ length: 22 }).map((_, i) => (
            <div
              key={i}
              className={`go-stripe ${i % 2 === 0 ? 'odd' : 'even'}`}
            />
          ))}
        </div>

        <div className="go-content">
          {/* Title with double outer text-stroke (white inner, light-pink
              outer). The three-span stack paints the same text three times
              so we can layer two strokes plus a fill — single
              -webkit-text-stroke can only express one ring. */}
          <h1 className="go-title">
            <span className="go-title-layer back">Game Over</span>
            <span className="go-title-layer middle">Game Over</span>
            <span className="go-title-layer front">Game Over</span>
          </h1>

          <div className="go-time">
            {pad2(minutes)} : {pad2(seconds)} : {pad2(cs)}
          </div>

          <ul className="go-results">
            {stats.map(([label, value]) => (
              <li key={label}>
                <span>{label}</span>
                <span className="go-results-value">{value}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="go-button-area">
          <div className="go-lace" />
          <div className="go-bottom">
            <Input
              type="text"
              value={name}
              maxLength={LEADERBOARD.nameMaxLen}
              placeholder="Name"
              onChange={(e) => setName(e.target.value)}
              disabled={submitted}
              style={{ width: 280 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
              aria-label="Your name"
            />
            <div className="go-buttons">
              <Button
                variant="primary"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                Submit Score
              </Button>
              <Button variant="secondary" onClick={onPlayAgain}>
                Play Again
              </Button>
              <Button variant="secondary" onClick={onSkipToLeaderboard}>
                Leaderboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
