// Mutable game state. One instance per run, lives in the GameView closure.
//
// Lives are in 0.5 increments to support the "miss a fruit = -0.5" rule
// from PRD §4.4. Score metrics are tracked even though only survival time
// is ranked, so we can show secondary stats on the game-over screen.

import { LIVES } from './config';

export type GameState = {
  lives: number;
  fruitsBurst: number;
  bombsAvoided: number;
  bombsHit: number;
  fruitsMissed: number;
  flicksTotal: number;
  flicksHit: number;
  gameOver: boolean;
  /** ms timestamp when the game ended (used to freeze the timer). */
  gameOverAt: number | null;
  /** Elapsed seconds at the moment of game over (the final score). */
  finalElapsedSec: number;
};

export function createGameState(): GameState {
  return {
    lives: LIVES.start,
    fruitsBurst: 0,
    bombsAvoided: 0,
    bombsHit: 0,
    fruitsMissed: 0,
    flicksTotal: 0,
    flicksHit: 0,
    gameOver: false,
    gameOverAt: null,
    finalElapsedSec: 0,
  };
}

/**
 * Apply life damage. Triggers gameOver and locks in finalElapsedSec when
 * lives reach 0. No-op if already game over.
 */
export function damageLives(
  state: GameState,
  amount: number,
  ts: number,
  elapsedSec: number
): void {
  if (state.gameOver) return;
  state.lives = Math.max(0, state.lives - amount);
  if (state.lives <= 0) {
    state.gameOver = true;
    state.gameOverAt = ts;
    state.finalElapsedSec = elapsedSec;
  }
}

export type HealResult = {
  /** True if lives actually went up (false when already at max). */
  applied: boolean;
  /** True if this heal was the one that brought lives to LIVES.max. */
  reachedMax: boolean;
};

/**
 * Restore lives, capped at LIVES.max. Returns whether the heal landed and
 * whether it just topped the player out — the caller uses `reachedMax` to
 * decide between a "+N" cue and a "Perfect!" cue.
 */
export function healLives(state: GameState, amount: number): HealResult {
  if (state.gameOver) return { applied: false, reachedMax: false };
  if (state.lives >= LIVES.max) return { applied: false, reachedMax: false };

  state.lives = Math.min(LIVES.max, state.lives + amount);
  return {
    applied: true,
    reachedMax: state.lives >= LIVES.max,
  };
}
