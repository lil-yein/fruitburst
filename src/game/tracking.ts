// Thin wrapper around MediaPipe HandLandmarker.
// All processing is client-side; nothing is uploaded.

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export type Fingertip = {
  /** Normalized x in [0, 1], original (unmirrored) image coords. */
  x: number;
  /** Normalized y in [0, 1]. */
  y: number;
};

const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// MediaPipe landmark index for the index fingertip.
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

  /** Returns the index fingertip in normalized image coords, or null if no hand. */
  detect(video: HTMLVideoElement, timestampMs: number): Fingertip | null {
    if (!this.landmarker) return null;
    // detectForVideo requires monotonically increasing timestamps.
    let ts = timestampMs;
    if (ts <= this.lastTimestampMs) ts = this.lastTimestampMs + 1;
    this.lastTimestampMs = ts;

    const result = this.landmarker.detectForVideo(video, ts);
    if (!result.landmarks || result.landmarks.length === 0) return null;

    const tip = result.landmarks[0][INDEX_FINGER_TIP];
    return { x: tip.x, y: tip.y };
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}
