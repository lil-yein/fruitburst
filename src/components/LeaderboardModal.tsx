// Leaderboard modal — overlays the start screen OR the (frozen) game
// screen depending on where the user opened it from. Matches Figma node
// 38:1377: 800×632 striped card with a layered "Leaderboard" title,
// up to ten ranked rows, lace divider above the button row.

import { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import {
  loadLeaderboard,
  type LeaderboardEntry,
} from '../game/leaderboard';
import './LeaderboardModal.css';

export type LeaderboardModalProps = {
  /** Pre-loaded entries (e.g. handed in right after submitting). If
   *  omitted the modal reads from localStorage on mount. */
  entries?: LeaderboardEntry[];
  highlightName?: string;
  highlightTime?: number;
  /** Label for the primary action. "Play Game" when the user is opening
   *  the board cold from the start screen; "Play Again" when they just
   *  finished a run. */
  playButtonLabel?: string;
  onPlayAgain: () => void;
  onBackHome: () => void;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTime(timeSec: number): string {
  const totalCs = Math.max(0, Math.floor(timeSec * 100));
  const minutes = Math.min(99, Math.floor(totalCs / 6000));
  const seconds = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${pad2(minutes)} : ${pad2(seconds)} : ${pad2(cs)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '— / — / —';
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const yyyy = String(d.getFullYear());
  return `${mm}/ ${dd} / ${yyyy}`;
}

export function LeaderboardModal({
  entries: initialEntries,
  highlightName,
  highlightTime,
  playButtonLabel = 'Play Again',
  onPlayAgain,
  onBackHome,
}: LeaderboardModalProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(
    initialEntries ?? []
  );

  useEffect(() => {
    if (!initialEntries) setEntries(loadLeaderboard());
  }, [initialEntries]);

  return (
    <div className="lb-overlay">
      <div className="lb-modal">
        <div className="lb-stripes">
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              className={`lb-stripe ${i % 2 === 0 ? 'odd' : 'even'}`}
            />
          ))}
        </div>

        {/* Title — plum fill, 4px white inner stroke, 2px light-pink outer
            stroke. Three stacked spans because -webkit-text-stroke can
            only paint one ring per node. */}
        <h1 className="lb-title">
          <span className="lb-title-layer back">Leaderboard</span>
          <span className="lb-title-layer middle">Leaderboard</span>
          <span className="lb-title-layer front">Leaderboard</span>
        </h1>

        <div className="lb-list">
          {entries.length === 0 ? (
            <p className="lb-empty">
              No scores yet — finish a run to claim the top spot ✨
            </p>
          ) : (
            entries.map((e, i) => {
              const isHighlight =
                highlightName !== undefined &&
                e.name === highlightName.trim() &&
                highlightTime !== undefined &&
                Math.abs(e.timeSec - highlightTime) < 0.005;
              return (
                <div
                  key={`${e.name}-${e.date}-${i}`}
                  className={`lb-row${isHighlight ? ' lb-row--highlight' : ''}`}
                >
                  <div className="lb-row-left">
                    <span className="lb-row-rank">#{i + 1}</span>
                    <span className="lb-row-name">{e.name}</span>
                  </div>
                  <div className="lb-row-right">
                    <span className="lb-row-time">{formatTime(e.timeSec)}</span>
                    <span className="lb-row-date">{formatDate(e.date)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="lb-button-area">
          <div className="lb-lace" />
          <div className="lb-buttons">
            <Button variant="primary" onClick={onPlayAgain}>
              {playButtonLabel}
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
