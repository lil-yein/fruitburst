// Flick-up gesture detection.
//
// Two detectors run in parallel; either firing counts as a flick.
//
// ── 1. Angular detector (primary) ───────────────────────────────────
// Watches the unit vector from wrist → fingertip and looks for fast
// upward rotation. Translation of the whole hand mathematically cannot
// rotate this vector, so even noisy MediaPipe predictions during fast
// translation can't fire it.
// Limitation: when the finger is already pointing straight up, there's
// no further upward rotation available — that case is handled by:
//
// ── 2. Linear-burst-with-recovery detector (fallback) ───────────────
// Looks at the *absolute* fingertip y-velocity for an *impulse* pattern:
// a fast upward burst followed by a stop. Uses absolute (not relative)
// velocity because when the finger is already pointing up the natural
// flick is a whole-hand stab — wrist and fingertip move together, so
// relative-y stays near zero and would miss the gesture.
// Sustained hand translation has a burst but no recovery (the hand
// keeps moving), so it doesn't fire. Fast horizontal swings are
// rejected by a verticality gate.
//
// Both detectors share the same rolling window and a single debounce.

import { GESTURE } from './config';

type Sample = {
  /** fingertip x in normalized image coords */ fx: number;
  /** fingertip y */                            fy: number;
  /** wrist x */                                wx: number;
  /** wrist y */                                wy: number;
  /** timestamp in ms */                        t: number;
  /** y-component of the unit wrist→tip vector, or null if hand vector
   *  is too short to measure reliably */
  unitY: number | null;
};

export type FlickResult = {
  fired: boolean;
  firedBy: 'angular' | 'linear' | null;
  // Angular metrics
  peakRotationRate: number;
  totalRotation: number;
  // Linear-burst metrics (absolute fingertip velocity)
  peakAbsVy: number;
  recentAbsVy: number;
  vxAtPeak: number;
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

    // ── Angular detector ─────────────────────────────────────────────
    let peakRate = 0;
    let totalRotation = 0;
    if (this.buffer.length >= 2) {
      for (let i = 1; i < this.buffer.length; i++) {
        const a = this.buffer[i - 1];
        const b = this.buffer[i];
        if (a.unitY === null || b.unitY === null) continue;
        const dt = (b.t - a.t) / 1000;
        if (dt <= 0) continue;
        const rate = (a.unitY - b.unitY) / dt;
        if (rate > peakRate) peakRate = rate;
      }
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
    const angularFired =
      peakRate > GESTURE.angularRateThreshold &&
      totalRotation > GESTURE.angularDisplacementThreshold;

    // ── Linear burst-with-recovery detector ──────────────────────────
    // Compute absolute fingertip vy/vx for each adjacent pair, find the
    // peak (most-negative vy), then verify recovery and verticality.
    let peakAbsVy = 0;
    let vxAtPeak = 0;
    let peakIdx = -1;
    let recentAbsVy = 0;
    const absVys: number[] = [];
    for (let i = 1; i < this.buffer.length; i++) {
      const a = this.buffer[i - 1];
      const b = this.buffer[i];
      const dt = (b.t - a.t) / 1000;
      if (dt <= 0) {
        absVys.push(0);
        continue;
      }
      const vy = (b.fy - a.fy) / dt;
      const vx = (b.fx - a.fx) / dt;
      absVys.push(vy);
      if (vy < peakAbsVy) {
        peakAbsVy = vy;
        vxAtPeak = vx;
        peakIdx = absVys.length - 1;
      }
    }
    if (absVys.length > 0) {
      recentAbsVy = absVys[absVys.length - 1];
    }
    // 1. Peak must be in the past (need a later sample for recovery proof).
    // 2. Peak vy must clear the threshold (true burst, not aim adjustment).
    // 3. Recent vy must be much closer to zero (decel evidence — kills
    //    sustained translation).
    // 4. Motion at the peak must be predominantly vertical (kills fast
    //    horizontal swings whose wrist arc produces incidental vy).
    const linearFired =
      peakIdx >= 0 &&
      peakIdx < absVys.length - 1 &&
      peakAbsVy < GESTURE.linearBurstThreshold &&
      recentAbsVy > peakAbsVy * GESTURE.linearBurstRecoveryRatio &&
      Math.abs(peakAbsVy) >
        GESTURE.linearBurstVerticalityRatio * Math.abs(vxAtPeak);

    const debounced = t - this.lastFlickAt < GESTURE.debounceMs;
    let firedBy: 'angular' | 'linear' | null = null;
    if (!debounced) {
      if (angularFired) firedBy = 'angular';
      else if (linearFired) firedBy = 'linear';
    }
    const triggered = firedBy !== null;
    if (triggered) this.lastFlickAt = t;

    return {
      fired: triggered,
      firedBy,
      peakRotationRate: peakRate,
      totalRotation,
      peakAbsVy,
      recentAbsVy,
      vxAtPeak,
    };
  }

  reset(): void {
    this.buffer = [];
  }
}
