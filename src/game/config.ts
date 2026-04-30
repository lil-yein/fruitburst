// Tunable constants for FruitBurst. Adjust freely during playtesting.

export const LIVES = {
  start: 5.0,
  // Hard cap on lives — reward fruit hits without letting flawless play
  // stack lives indefinitely. Set higher (or to Infinity) to allow stacking.
  max: 5.0,
  missFruitPenalty: 0.5,
  shootBombPenalty: 1.0,
  // Lives gained when you successfully burst a fruit. Capped at LIVES.max.
  fruitBurstReward: 0.5,
} as const;

export const GESTURE = {
  // Rolling window of samples used by both flick detectors.
  windowFrames: 6,

  // ─── Angular detector (primary) ─────────────────────────────────────
  // Watches the unit vector from wrist → fingertip and looks for fast
  // upward rotation. Translation of the whole hand cancels (the unit
  // vector is mathematically unchanged), so only real finger/wrist
  // rotation can fire it.
  //
  // unitY is the y-component of that unit vector: -1 = pointing straight
  // up, 0 = horizontal, +1 = pointing straight down (image y grows down).
  // A flick reduces unitY.
  //
  // Limitation: when the finger is already pointing up (unitY near -1),
  // there is no further upward rotation available. The linear-burst
  // detector below handles that case.

  // Peak per-step upward-rotation rate (− d unitY / dt) required to fire,
  // in 1/sec. ~4.0 means the finger's elevation rotates fast enough to go
  // from horizontal to fully-up in 250ms.
  angularRateThreshold: 4.0,
  // Minimum total upward rotation over the window (− Δ unitY).
  // ~0.3 ≈ at least ~17° of rotation if starting from horizontal.
  // Prevents single-frame noise spikes from firing.
  angularDisplacementThreshold: 0.3,
  // Below this normalized hand-vector length the wrist→fingertip vector is
  // too short to measure direction reliably (hand small in frame, finger
  // curled, foreshortening). Skip angular detection when below.
  minHandSize: 0.04,

  // ─── Linear-burst-with-recovery detector (fallback) ─────────────────
  // Catches flicks the angular detector misses — chiefly "stab up"
  // gestures when the finger is already pointing up (no further upward
  // rotation possible) and the user just briefly thrusts the whole hand
  // upward. Watches *absolute* fingertip y-velocity (not relative to
  // wrist), since in those gestures wrist and fingertip move together.
  //
  // Sustained hand translation has fast velocity but never decelerates
  // (the hand keeps moving toward its target), so the recovery gate
  // rejects it. Fast horizontal swings are rejected by the verticality
  // gate.

  // Peak upward fingertip velocity required, in normalized-y / sec
  // (negative; image y grows downward). Lower magnitude lets weaker
  // flicks fire (e.g. corner aiming where part of the motion is
  // horizontal along the finger axis).
  linearBurstThreshold: -2.8,
  // After the peak, the most recent vy must be at most this fraction
  // (in magnitude) of the peak. 0.5 = "decelerated to <50% of peak
  // speed." Sustained translation fails this check.
  linearBurstRecoveryRatio: 0.5,
  // At the peak instant, |vy| must be at least this multiple of |vx|
  // so a fast horizontal swing (which can produce incidental upward
  // motion via wrist arc) does not register. 1.2 still rejects pure
  // horizontal swings (ratio < 1) while allowing diagonal flicks
  // (ratio ≈ 1.4 for a 55°-from-horizontal flick).
  linearBurstVerticalityRatio: 1.2,

  debounceMs: 200,
  // Forgiveness radius (in pixels) around crosshair when resolving a flick hit.
  hitRadius: 48,
  // Show flick counter + live debug HUD during development. Flip to true
  // to see live gesture metrics during gameplay (useful for retuning).
  debugHud: false,
} as const;

export const TRACKING = {
  // Exponential smoothing factor for crosshair position. Higher = snappier, lower = smoother.
  smoothing: 0.5,
  targetFps: 30,
} as const;

// Physics constants in CSS pixels (multiplied by devicePixelRatio at runtime
// so visible motion is consistent across HiDPI / standard displays).
export const PHYSICS = {
  gravity: 1100,           // px / s^2 (downward)
  // Launch is computed FROM a target apogee height instead of a raw vy
  // value: vy = √(2·g·h). The target height is a fraction of canvas
  // height, so fruits never breach the top edge regardless of viewport
  // size. Peak is invariant under the difficulty's k² gravity scaling
  // (vy scales by k, g by k² → peak = vy²/2g unchanged), so the same
  // ratios work at every tier.
  peakHeightMinRatio: 0.55, // weakest launch: 55% of canvas height
  peakHeightMaxRatio: 0.80, // strongest launch: 80%
  initialVxRange: 380,     // ± px / s horizontal
  spinRange: 4,            // rad / s ± rotation
  // Maximum render dimension (in css px). Used to scale each image while
  // preserving its natural aspect ratio.
  fruitSize: 170,
  bombSize: 170,
  // Horizontal margin (px) from each edge for spawn x-positions.
  spawnEdgeMargin: 80,
} as const;

// Difficulty curve from PRD §4.5. Times are in seconds.
export type DifficultyTier = {
  untilSec: number;
  spawnIntervalSec: number;
  speedMultiplier: number;
  bombsPerNFruits: number;
};

// Difficulty steps every 30s with gentler per-step jumps than the
// original 60s/180s table — keeps escalation continuous instead of
// shocking. Plateaus at 5 minutes; runs may continue indefinitely.
export const DIFFICULTY: DifficultyTier[] = [
  { untilSec:  30,       spawnIntervalSec: 2.0,  speedMultiplier: 1.00, bombsPerNFruits: 18 },
  { untilSec:  60,       spawnIntervalSec: 1.8,  speedMultiplier: 1.08, bombsPerNFruits: 16 },
  { untilSec:  90,       spawnIntervalSec: 1.6,  speedMultiplier: 1.16, bombsPerNFruits: 15 },
  { untilSec: 120,       spawnIntervalSec: 1.5,  speedMultiplier: 1.22, bombsPerNFruits: 14 },
  { untilSec: 150,       spawnIntervalSec: 1.4,  speedMultiplier: 1.28, bombsPerNFruits: 13 },
  { untilSec: 180,       spawnIntervalSec: 1.3,  speedMultiplier: 1.34, bombsPerNFruits: 12 },
  { untilSec: 210,       spawnIntervalSec: 1.2,  speedMultiplier: 1.40, bombsPerNFruits: 12 },
  { untilSec: 240,       spawnIntervalSec: 1.15, speedMultiplier: 1.46, bombsPerNFruits: 11 },
  { untilSec: 270,       spawnIntervalSec: 1.10, speedMultiplier: 1.52, bombsPerNFruits: 10 },
  { untilSec: 300,       spawnIntervalSec: 1.05, speedMultiplier: 1.58, bombsPerNFruits: 10 },
  { untilSec: Infinity,  spawnIntervalSec: 1.00, speedMultiplier: 1.60, bombsPerNFruits: 10 },
];

export const SPAWN = {
  clusterMin: 1,
  clusterMax: 4,
  clusterChance: 0.25,
  // Hard cap on items in flight at once. The spawner clamps cluster
  // size to (max - currentCount) and skips spawning entirely when full.
  maxConcurrent: 3,
} as const;

export const LEADERBOARD = {
  localKey: 'fruitburst.leaderboard.v1',
  topN: 10,
  nameMinLen: 3,
  nameMaxLen: 20,
} as const;
