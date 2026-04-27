// Flick → entity hit resolution.
//
// Per PRD §7, collision only resolves at the moment of a flick. We treat
// the crosshair as a point with a small forgiveness radius and test it
// against every alive entity. If multiple entities are in range, the
// closest center to the crosshair wins.

import type { Entity } from './entities';

/**
 * @param cx        crosshair x in canvas pixels
 * @param cy        crosshair y in canvas pixels
 * @param entities  alive entities to test
 * @param hitRadius forgiveness radius in canvas pixels
 * @returns the hit entity, or null if nothing was in range
 */
export function resolveFlickHit(
  cx: number,
  cy: number,
  entities: Entity[],
  hitRadius: number
): Entity | null {
  let best: Entity | null = null;
  let bestDist = Infinity;

  for (const e of entities) {
    if (!e.alive) continue;
    const dx = e.x - cx;
    const dy = e.y - cy;
    const dist = Math.hypot(dx, dy);
    // Hit when crosshair is within (entity radius + forgiveness).
    const reach = e.size / 2 + hitRadius;
    if (dist <= reach && dist < bestDist) {
      bestDist = dist;
      best = e;
    }
  }
  return best;
}
