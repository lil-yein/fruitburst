// Lightweight projectile physics for fruits and bombs.
//
// Each frame we advance entities under their per-entity gravity, then add
// their angular spin. No collision response — fruits/bombs pass through
// each other freely (Fruit Ninja style).
//
// Per-entity gravity (rather than a global value) lets different difficulty
// tiers scale trajectory *timing* without changing arc shape. See
// buildEntity for the k² scaling rationale.

import type { Entity } from './entities';

export function updateEntity(e: Entity, dt: number): void {
  e.vy += e.gravity * dt;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.rotation += e.angularVelocity * dt;
}
