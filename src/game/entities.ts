// Entity model for fruits and bombs in the playfield.
//
// Positions/velocities are in canvas pixels (i.e. CSS pixels × devicePixelRatio).
// One Entity instance is created per spawn and removed once it leaves the
// bottom of the screen.

export type EntityKind = 'fruit' | 'bomb';

export interface Entity {
  id: number;
  kind: EntityKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Visual rotation in radians. */
  rotation: number;
  /** Spin rate in radians/sec. */
  angularVelocity: number;
  /** Diameter in canvas pixels for rendering + hit-testing. */
  size: number;
  image: HTMLImageElement;
  /** false → ready for cleanup. Used after a hit (CP4) or when off-screen. */
  alive: boolean;
  /** True once this fruit has crossed the bottom edge unshot — drives the
   *  -0.5 life penalty in CP4. Latched so the penalty fires once. */
  missed: boolean;
}

let nextEntityId = 1;
export function newEntityId(): number {
  return nextEntityId++;
}

/**
 * True when the entity has fallen past the bottom of the canvas.
 * Requires vy > 0 (falling) so freshly-spawned fruits — which start
 * just below the bottom edge with negative vy — aren't culled before
 * they arc into view.
 */
export function isOffScreenBottom(e: Entity, canvasH: number): boolean {
  return e.vy > 0 && e.y - e.size / 2 > canvasH;
}
