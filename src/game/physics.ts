// Lightweight projectile physics for fruits and bombs.
//
// Each frame we advance entities under constant gravity + linear motion, then
// add their angular spin. No collision response — fruits/bombs pass through
// each other freely (Fruit Ninja style).

import type { Entity } from './entities';

/**
 * Integrate one entity by `dt` seconds.
 * `gravity` is in canvas px / s^2 (already DPR-scaled by the caller).
 */
export function updateEntity(e: Entity, dt: number, gravity: number): void {
  e.vy += gravity * dt;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.rotation += e.angularVelocity * dt;
}
