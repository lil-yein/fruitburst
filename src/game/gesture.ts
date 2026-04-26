// Flick-up gesture detection.
//
// We detect *rotation* of the index finger toward "pointing up", not linear
// motion of the fingertip. Pure hand translation (e.g. raising the hand to
// aim higher) doesn't rotate the finger at all, so rotation-based detection
// is intrinsically immune to translation — even when MediaPipe's per-frame
// landmark predictions are noisy under fast motion.
//
// Each frame we sample the unit vector from wrist → fingertip. Its y
// component (unitY) measures finger elevation: -1 = straight up,
// 0 = horizontal, +1 = straight down. A flick reduces unitY.
//
// Two gates must both pass for a flick to fire:
//
//   1. Peak per-step upward rotation rate (− d unitY / dt) exceeds
//      `angularRateThreshold`. Catches the snap.
//   2. Total upward rotation over the window (− Δ unitY) exceeds
//      `angularDisplacementThreshold`. Rejects single-frame noise spikes.
//
// Plus a debounce window between flicks.

import { GESTURE } from './config';

type Sample = {
  /** fingertip x in normalized image coords */ fx: number;
  /** fingertip y */                            fy: number;
  /** wrist x */                                wx: number;
  /** wrist y */                                wy: number;
  /** timestamp in ms */                        t: number;
  /** y-component of the unit wrist→tip vector at this sample, or null
   *  if the hand vector was too short to measure reliably */
  unitY: number | null;
};

export type FlickResult = {
  fired: boolean;
  /** Peak per-step upward rotation rate in 1/s. Positive = rotating up. */
  peakRotationRate: number;
  /** Total upward rotation over window. Positive = rotated up overall. */
  totalRotation: number;
};

function unitVectorY(fx: number, fy: number, wx: number, wy: number): number | null {
  const dx = fx - wx;
  const dy = fy - wy;
  const len = Math.hypot(dx, dy);
  if (len < GESTURE.minHandSize) return null;
  return dy / len;
}

export class FlickDetector {
  private buffer: Sample[] = [];
  private lastFlickAt = -Infinity;

  push(fx: number, fy: number, wx: number, wy: number, t: number): FlickResult {
    const unitY = unitVectorY(fx, fy, wx, wy);
    this.buffer.push({ fx, fy, wx, wy, t, unitY });
    if (this.buffer.length > GESTURE.windowFrames) {
      this.buffer.shift();
    }

    let peakRate = 0;
    let totalRotation = 0;

    if (this.buffer.length >= 2) {
      // Peak per-step upward rotation rate.
      for (let i = 1; i < this.buffer.length; i++) {
        const a = this.buffer[i - 1];
        const b = this.buffer[i];
        if (a.unitY === null || b.unitY === null) continue;
        const dt = (b.t - a.t) / 1000;
        if (dt <= 0) continue;
        // Positive rate = unitY decreased = rotated upward.
        const rate = (a.unitY - b.unitY) / dt;
        if (rate > peakRate) peakRate = rate;
      }

      // Total rotation across the window (oldest valid → newest valid).
      let oldestUy: number | null = null;
      let newestUy: number | null = null;
      for (const s of this.buffer) {
        if (s.unitY !== null) {
          if (oldestUy === null) oldestUy = s.unitY;
          newestUy = s.unitY;
        }
      }
      if (oldestUy !== null && newestUy !== null) {
        totalRotation = oldestUy - newestUy;
      }
    }

    const debounced = t - this.lastFlickAt < GESTURE.debounceMs;
    const fastEnough = peakRate > GESTURE.angularRateThreshold;
    const sustainedEnough = totalRotation > GESTURE.angularDisplacementThreshold;
    const triggered = !debounced && fastEnough && sustainedEnough;
    if (triggered) this.lastFlickAt = t;

    return {
      fired: triggered,
      peakRotationRate: peakRate,
      totalRotation,
    };
  }

  reset(): void {
    this.buffer = [];
  }
}
