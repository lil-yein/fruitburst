// Thin wrapper around MediaPipe HandLandmarker.
// All processing is client-side; nothing is uploaded.

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

/** A 2D point in normalized image coords (0..1, original / unmirrored). */
export type Point2 = { x: number; y: number };

/** Per-frame snapshot of the tracked hand, with the landmarks the game uses. */
export type HandSnapshot = {
  /** INDEX_FINGER_TIP — drives the crosshair. */
  fingertip: Point2;
  /** WRIST — anchor for measuring finger motion relative to the hand. */
  wrist: Point2;
};

// Backward-compat alias used elsewhere in the codebase.
export type Fingertip = Point2;

const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// MediaPipe landmark indices.
const WRIST = 0;
const INDEX_FINGER_TIP = 8;

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private lastTimestampMs = -1;

  async init(): Promise<void> {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    this.landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,
    });
  }

  /** Returns the tracked hand snapshot, or null if no hand is detected. */
  detect(video: HTMLVideoElement, timestampMs: number): HandSnapshot | null {
    if (!this.landmarker) return null;
    // detectForVideo requires monotonically increasing timestamps.
    let ts = timestampMs;
    if (ts <= this.lastTimestampMs) ts = this.lastTimestampMs + 1;
    this.lastTimestampMs = ts;

    const result = this.landmarker.detectForVideo(video, ts);
    if (!result.landmarks || result.landmarks.length === 0) return null;

    const lms = result.landmarks[0];
    const tip = lms[INDEX_FINGER_TIP];
    const wrist = lms[WRIST];
    return {
      fingertip: { x: tip.x, y: tip.y },
      wrist: { x: wrist.x, y: wrist.y },
    };
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}
