// Leaderboard screen — placeholder. Reads top-N entries from
// localStorage and renders them. If the user just submitted a score
// (`highlightName` + `highlightTime`), the matching row is visually
// emphasized so they can find their entry.

import { useEffect, useState } from 'react';
import {
  loadLeaderboard,
  type LeaderboardEntry,
} from '../game/leaderboard';
import { Button } from '../components/ui/Button';
import './screen.css';

export type LeaderboardScreenProps = {
  /** Pre-loaded entries (e.g. handed in right after submitting). If
   *  omitted the screen reads from localStorage on mount. */
  entries?: LeaderboardEntry[];
  highlightName?: string;
  highlightTime?: number;
  onBack: () => void;
};

function formatTime(timeSec: number): string {
  const totalCs = Math.floor(timeSec * 100);
  const minutes = Math.floor(totalCs / 6000);
  const seconds = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  });
}

export function LeaderboardScreen({
  entries: initialEntries,
  highlightName,
  highlightTime,
  onBack,
}: LeaderboardScreenProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(
    initialEntries ?? []
  );

  useEffect(() => {
    if (!initialEntries) setEntries(loadLeaderboard());
  }, [initialEntries]);

  return (
    <div className="screen">
      <h1>Leaderboard</h1>

      {entries.length === 0 ? (
        <p className="screen-leaderboard-empty">
          No scores yet — finish a run to claim the top spot ✨
        </p>
      ) : (
        <ol className="screen-leaderboard-list">
          {entries.map((e, i) => {
            const isHighlight =
              highlightName !== undefined &&
              e.name === highlightName.trim() &&
              highlightTime !== undefined &&
              Math.abs(e.timeSec - highlightTime) < 0.005;
            return (
              <li
                key={`${e.name}-${e.date}-${i}`}
                className={
                  'screen-leaderboard-row' +
                  (isHighlight ? ' highlight' : '')
                }
              >
                <span>#{i + 1}</span>
                <span>{e.name}</span>
                <span>{formatTime(e.timeSec)}</span>
                <span>{formatDate(e.date)}</span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="screen-buttons">
        <Button variant="primary" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
