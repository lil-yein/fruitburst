// Flick-up gesture detection.
//
// Strategy: maintain a small rolling window of fingertip (x, y) samples. On
// each new sample, find the adjacent pair with the most-negative dy/dt
// (i.e. the strongest single-frame upward burst) within the window. We fire
// a flick only if:
//   1. that vy is past the upward-velocity threshold, AND
//   2. |vy| > verticalityRatio * |vx| at that same step (so a fast
//      horizontal swing — which pivots the wrist and incidentally creates
//      upward y-motion — does not register), AND
//   3. we're past the debounce window.
//
// Velocity is in normalized image-units per second so thresholds are
// independent of frame size and frame rate. Image y grows downward, so
// upward motion produces negative vy.

import { GESTURE } from './config';

type Sample = { x: number; y: number; t: number };

export type FlickResult = {
  fired: boolean;
  /** Most-negative vy observed in the window (units/sec). */
  peakUpwardVelocity: number;
  /** |vx| measured at the same step as peakUpwardVelocity. */
  horizontalVelocityAtPeak: number;
};

export class FlickDetector {
  private buffer: Sample[] = [];
  private lastFlickAt = -Infinity;

  /**
   * Push a new fingertip sample.
   * @param x Normalized x from MediaPipe (0..1).
   * @param y Normalized y from MediaPipe (0..1).
   * @param t Timestamp in ms.
   */
  push(x: number, y: number, t: number): FlickResult {
    this.buffer.push({ x, y, t });
    if (this.buffer.length > GESTURE.windowFrames) {
      this.buffer.shift();
    }

    let peakVy = 0;
    let vxAtPeak = 0;

    if (this.buffer.length >= 2) {
      for (let i = 1; i < this.buffer.length; i++) {
        const a = this.buffer[i - 1];
        const b = this.buffer[i];
        const dt = (b.t - a.t) / 1000;
        if (dt <= 0) continue;
        const vy = (b.y - a.y) / dt;
        if (vy < peakVy) {
          peakVy = vy;
          vxAtPeak = (b.x - a.x) / dt;
        }
      }
    }

    const debounced = t - this.lastFlickAt < GESTURE.debounceMs;
    const fastEnough = peakVy < GESTURE.flickVelocityThreshold;
    const verticalEnough =
      Math.abs(peakVy) > GESTURE.verticalityRatio * Math.abs(vxAtPeak);
    const triggered = !debounced && fastEnough && verticalEnough;
    if (triggered) this.lastFlickAt = t;

    return {
      fired: triggered,
      peakUpwardVelocity: peakVy,
      horizontalVelocityAtPeak: vxAtPeak,
    };
  }

  reset(): void {
    this.buffer = [];
  }
}
