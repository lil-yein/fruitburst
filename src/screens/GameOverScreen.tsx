// Game-over screen — placeholder. Shows the final time + secondary
// stats, takes a name (3–20 chars), and either submits to the local
// leaderboard or skips straight to a replay.

import { useState } from 'react';
import {
  isValidName,
  saveScore,
  type LeaderboardEntry,
} from '../game/leaderboard';
import { LEADERBOARD } from '../game/config';
import type { GameRunResult } from '../components/GameView';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import './screen.css';

export type GameOverScreenProps = {
  run: GameRunResult;
  /** Called after the user submits a score; the new top-N list is passed
   *  through so the leaderboard screen can highlight the new entry. */
  onSubmit: (entries: LeaderboardEntry[], submittedName: string) => void;
  onPlayAgain: () => void;
  onSkipToLeaderboard: () => void;
};

function formatTime(timeSec: number): string {
  const totalCs = Math.floor(timeSec * 100);
  const minutes = Math.floor(totalCs / 6000);
  const seconds = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function GameOverScreen({
  run,
  onSubmit,
  onPlayAgain,
  onSkipToLeaderboard,
}: GameOverScreenProps) {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const accuracy =
    run.flicksTotal > 0
      ? Math.round((run.flicksHit / run.flicksTotal) * 100) + '%'
      : '—';

  const canSubmit = isValidName(name) && !submitted;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitted(true);
    const entries = saveScore(name, run.timeSec);
    onSubmit(entries, name.trim());
  };

  return (
    <div className="screen">
      <h1>GAME OVER</h1>

      <div style={{ fontSize: 56, color: 'var(--pink-900)' }}>
        {formatTime(run.timeSec)}
      </div>

      <ul className="screen-stats">
        <li>fruits burst: {run.fruitsBurst}</li>
        <li>bombs hit: {run.bombsHit}</li>
        <li>bombs avoided: {run.bombsAvoided}</li>
        <li>fruits missed: {run.fruitsMissed}</li>
        <li>accuracy: {accuracy}</li>
      </ul>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
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
        />
        <p
          className="screen-permission-note"
          style={{ margin: 0, fontSize: 12 }}
        >
          {LEADERBOARD.nameMinLen}–{LEADERBOARD.nameMaxLen} characters
        </p>
      </div>

      <div className="screen-buttons">
        <Button variant="primary" disabled={!canSubmit} onClick={handleSubmit}>
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
  );
}
