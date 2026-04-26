// Tunable constants for FruitBurst. Adjust freely during playtesting.

export const LIVES = {
  start: 5.0,
  missFruitPenalty: 0.5,
  shootBombPenalty: 1.0,
} as const;

export const GESTURE = {
  // Rolling window of samples used by the angular flick detector.
  windowFrames: 6,

  // The detector watches the unit vector from wrist → fingertip and looks
  // for fast upward rotation. Translation of the whole hand cancels (the
  // unit vector is unchanged), so only real finger/wrist rotation fires.
  //
  // unitY is the y-component of that unit vector. In image coords (y grows
  // downward), -1 = pointing straight up, 0 = horizontal, +1 = pointing
  // straight down. A flick reduces unitY (rotates upward).

  // Peak per-step upward-rotation rate (− d unitY / dt) required to fire,
  // in 1/sec. ~4.0 means the finger's elevation rotates fast enough to go
  // from horizontal to fully-up in 250ms.
  angularRateThreshold: 4.0,
  // Minimum total upward rotation over the whole window (− Δ unitY).
  // ~0.3 ≈ at least ~17° of rotation if starting from horizontal.
  // Prevents single-frame noise spikes from firing.
  angularDisplacementThreshold: 0.3,
  // Below this normalized hand-vector length the wrist→fingertip vector is
  // too short to measure direction reliably (hand small in frame, finger
  // curled, etc.). Skip detection when below.
  minHandSize: 0.04,

  debounceMs: 200,
  // Forgiveness radius (in pixels) around crosshair when resolving a flick hit.
  hitRadius: 48,
  // Show flick counter + live debug HUD during development.
  debugHud: true,
} as const;

export const TRACKING = {
  // Exponential smoothing factor for crosshair position. Higher = snappier, lower = smoother.
  smoothing: 0.5,
  targetFps: 30,
} as const;

export const PHYSICS = {
  gravity: 1400,           // px / s^2
  initialVyMin: -1100,     // px / s (upward)
  initialVyMax: -1400,
  initialVxRange: 350,     // ± horizontal velocity
  spinRange: 4,            // rad / s
} as const;

// Difficulty curve from PRD §4.5. Times are in seconds.
export type DifficultyTier = {
  untilSec: number;
  spawnIntervalSec: number;
  speedMultiplier: number;
  bombsPerNFruits: number;
};

export const DIFFICULTY: DifficultyTier[] = [
  { untilSec: 60,        spawnIntervalSec: 2.0, speedMultiplier: 1.0, bombsPerNFruits: 15 },
  { untilSec: 180,       spawnIntervalSec: 1.3, speedMultiplier: 1.4, bombsPerNFruits: 12 },
  { untilSec: 300,       spawnIntervalSec: 1.0, speedMultiplier: 1.7, bombsPerNFruits: 10 },
  { untilSec: Infinity,  spawnIntervalSec: 1.0, speedMultiplier: 1.7, bombsPerNFruits: 10 },
];

export const SPAWN = {
  clusterMin: 1,
  clusterMax: 4,
  clusterChance: 0.25,
} as const;

export const LEADERBOARD = {
  localKey: 'fruitburst.leaderboard.v1',
  topN: 10,
  nameMinLen: 3,
  nameMaxLen: 20,
} as const;
