// Local leaderboard persisted to localStorage.
//
// Top-N scores by survival time, sorted descending. Names are sanitized at
// save time. Reads tolerate corrupted JSON (returns []) so a bad cache
// can't crash the game.
//
// Phase 2 will add a server-backed global leaderboard alongside this; the
// Entry shape here is forward-compatible with the planned `scores` table
// (name, time, created_at).

import { LEADERBOARD } from './config';

export type LeaderboardEntry = {
  name: string;
  /** Survival time in seconds, 2-decimal precision. */
  timeSec: number;
  /** ISO 8601 timestamp of when the score was saved. */
  date: string;
};

const KEY = LEADERBOARD.localKey;

function isValidEntry(x: unknown): x is LeaderboardEntry {
  if (!x || typeof x !== 'object') return false;
  const e = x as Partial<LeaderboardEntry>;
  return (
    typeof e.name === 'string' &&
    typeof e.timeSec === 'number' &&
    Number.isFinite(e.timeSec) &&
    typeof e.date === 'string'
  );
}

/** Reads and validates the saved leaderboard. Returns [] on any error. */
export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidEntry)
      .sort((a, b) => b.timeSec - a.timeSec)
      .slice(0, LEADERBOARD.topN);
  } catch {
    return [];
  }
}

/** Strip whitespace and obvious HTML chars; clamp to max length. */
export function sanitizeName(name: string): string {
  return name
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, LEADERBOARD.nameMaxLen);
}

export function isValidName(name: string): boolean {
  const trimmed = name.trim();
  return (
    trimmed.length >= LEADERBOARD.nameMinLen &&
    trimmed.length <= LEADERBOARD.nameMaxLen
  );
}

/**
 * Persist a new score and return the updated top-N list (descending by time).
 * Caller should pass the validated name; this function still sanitizes
 * defensively before writing.
 */
export function saveScore(
  name: string,
  timeSec: number
): LeaderboardEntry[] {
  const entry: LeaderboardEntry = {
    name: sanitizeName(name),
    timeSec,
    date: new Date().toISOString(),
  };
  const next = [...loadLeaderboard(), entry]
    .sort((a, b) => b.timeSec - a.timeSec)
    .slice(0, LEADERBOARD.topN);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota exceeded or storage disabled — caller still gets the in-memory
    // list back so the UI can show the run, just without persistence.
  }
  return next;
}

/** Returns the 1-indexed rank a given time would achieve, or null if it
 *  wouldn't make the top-N. */
export function rankFor(timeSec: number): number | null {
  const list = loadLeaderboard();
  let rank = 1;
  for (const e of list) {
    if (e.timeSec > timeSec) rank++;
    else break;
  }
  return rank <= LEADERBOARD.topN ? rank : null;
}

/** Wipe all saved scores. Exposed for dev/debug; not used by the UI. */
export function clearLeaderboard(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
