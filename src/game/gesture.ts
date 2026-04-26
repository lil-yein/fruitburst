// Flick-up gesture detection.
//
// Strategy: maintain a small rolling window of fingertip y samples. On each
// new sample, find the maximum single-frame upward velocity (most-negative
// dy/dt) within the window. If it exceeds the threshold and we're past the
// debounce, fire a flick.
//
// We measure velocity in normalized y-units per second so the threshold is
// independent of frame size and frame rate. Image y grows downward, so an
// upward flick produces a negative velocity.

import { GESTURE } from './config';

type Sample = { y: number; t: number };

export type FlickResult = {
  fired: boolean;
  /** Most-negative dy/dt observed in the current window (units/sec). */
  peakUpwardVelocity: number;
};

export class FlickDetector {
  private buffer: Sample[] = [];
  private lastFlickAt = -Infinity;

  /**
   * Push a new fingertip y-sample.
   * @param y Normalized y from MediaPipe (0..1).
   * @param t Timestamp in ms (e.g. requestAnimationFrame timestamp).
   * @returns whether a flick fired this frame, plus the peak upward velocity.
   */
  push(y: number, t: number): FlickResult {
    this.buffer.push({ y, t });
    if (this.buffer.length > GESTURE.windowFrames) {
      this.buffer.shift();
    }

    let peakUp = 0;
    if (this.buffer.length >= 2) {
      for (let i = 1; i < this.buffer.length; i++) {
        const a = this.buffer[i - 1];
        const b = this.buffer[i];
        const dt = (b.t - a.t) / 1000;
        if (dt <= 0) continue;
        const v = (b.y - a.y) / dt;
        if (v < peakUp) peakUp = v;
      }
    }

    const debounced = t - this.lastFlickAt < GESTURE.debounceMs;
    const triggered = !debounced && peakUp < GESTURE.flickVelocityThreshold;
    if (triggered) this.lastFlickAt = t;

    return { fired: triggered, peakUpwardVelocity: peakUp };
  }

  /** Clear buffer (e.g. when the hand re-enters frame). */
  reset(): void {
    this.buffer = [];
  }
}
