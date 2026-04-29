// Game-over modal — overlays the (frozen) game screen. Matches Figma
// node 40:1553 exactly: striped pink card, four stat cards in a 2×2
// grid (each with a lace tucked under the top edge), inline save row,
// Play Again / Back Home action row.

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
  onBackHome: () => void;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function GameOverModal({
  run,
  onSubmit,
  onPlayAgain,
  onBackHome,
}: GameOverModalProps) {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const accuracy =
    run.flicksTotal > 0
      ? Math.round((run.flicksHit / run.flicksTotal) * 100) + '%'
      : '—';

  // MM : SS : CC. Capped at 99 minutes so the digit row can't overflow.
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

  return (
    <div className="go-overlay">
      <div className="go-modal">
        <div className="go-stripes">
          {Array.from({ length: 11 }).map((_, i) => (
            <div
              key={i}
              className={`go-stripe ${i % 2 === 0 ? 'odd' : 'even'}`}
            />
          ))}
        </div>

        <div className="go-content">
          {/* Title + time block */}
          <div className="go-header">
            {/* "Game Over" — pink front + light-pink shadow offset behind. */}
            <h1 className="go-title">Game Over</h1>
            <div className="go-time">
              {pad2(minutes)} : {pad2(seconds)} : {pad2(cs)}
            </div>
          </div>

          {/* 2×2 stat grid */}
          <div className="go-results">
            <div className="go-results-row">
              <StatCard label="Fruits burst" value={`🍎 ${run.fruitsBurst}`} />
              <StatCard label="Bomb hit" value={`💣 ${run.bombsHit}`} />
            </div>
            <div className="go-results-row">
              <StatCard
                label="Fruits missed"
                value={`❌ ${run.fruitsMissed}`}
              />
              <StatCard label="Accuracy" value={accuracy} />
            </div>
          </div>

          {/* Save score row: input + primary Save button inline */}
          <div className="go-save-row">
            <Input
              type="text"
              value={name}
              maxLength={LEADERBOARD.nameMaxLen}
              placeholder="Name"
              onChange={(e) => setName(e.target.value)}
              disabled={submitted}
              className="go-name-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
              aria-label="Your name"
            />
            <Button
              variant="primary"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              Save
            </Button>
          </div>

          {/* Action row: Play Again (primary) + Back Home (secondary) */}
          <div className="go-actions">
            <Button variant="primary" onClick={onPlayAgain}>
              Play Again
            </Button>
            <Button variant="secondary" onClick={onBackHome}>
              Back Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="go-stat">
      <div className="go-stat-lace" />
      <p className="go-stat-label">{label}</p>
      <p className="go-stat-value">{value}</p>
    </div>
  );
}
