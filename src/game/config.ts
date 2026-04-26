// Tunable constants for FruitBurst. Adjust freely during playtesting.

export const LIVES = {
  start: 5.0,
  missFruitPenalty: 0.5,
  shootBombPenalty: 1.0,
} as const;

export const GESTURE = {
  // Rolling window of fingertip positions used to detect a flick-up.
  windowFrames: 6,
  // Upward-velocity threshold in normalized-y units per second (negative = upward,
  // since image y grows downward). -2.5 ≈ traversing 2.5× frame heights / sec.
  // Tune against real webcam input.
  flickVelocityThreshold: -2.5,
  debounceMs: 200,
  // Forgiveness radius (in pixels) around crosshair when resolving a flick hit.
  hitRadius: 48,
  // Show flick counter + last-velocity debug HUD during development.
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
