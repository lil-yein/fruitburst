// Drives the spawn cadence for fruits and bombs.
//
// Tracks elapsed game time, picks the active difficulty tier from
// config.DIFFICULTY, and emits SpawnRequests at the tier's spawn interval.
// Each cycle may produce a small cluster (1–4) of objects. Bomb cadence is
// per-tier (1 bomb every N fruits) and is preserved across spawn cycles.
// The caller passes the current in-flight entity count so the spawner can
// clamp cluster size to (SPAWN.maxConcurrent − active) and skip spawning
// when the playfield is already full.

import { DIFFICULTY, SPAWN, type DifficultyTier } from './config';

export type SpawnRequest = {
  kind: 'fruit' | 'bomb';
  /** From the active tier — applied to launch velocities at construction. */
  speedMultiplier: number;
};

function currentTier(elapsedSec: number): DifficultyTier {
  for (const tier of DIFFICULTY) {
    if (elapsedSec < tier.untilSec) return tier;
  }
  return DIFFICULTY[DIFFICULTY.length - 1];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class Spawner {
  private elapsed = 0;
  private spawnTimer = 0;
  private fruitsSinceLastBomb = 0;

  /**
   * Advance the spawn clock by `dt` seconds. Returns 0+ requests to spawn.
   *
   * @param dt seconds elapsed since last call.
   * @param activeCount current number of in-flight entities. The spawner
   *        clamps cluster size to (SPAWN.maxConcurrent − activeCount) and
   *        emits nothing when the playfield is already full. The spawn
   *        timer still advances so the next available cycle fires
   *        immediately rather than waiting another full interval.
   */
  update(dt: number, activeCount: number): SpawnRequest[] {
    this.elapsed += dt;
    this.spawnTimer += dt;

    const tier = currentTier(this.elapsed);
    if (this.spawnTimer < tier.spawnIntervalSec) return [];
    this.spawnTimer = 0;

    const remaining = SPAWN.maxConcurrent - activeCount;
    if (remaining <= 0) return [];

    const cluster = Math.random() < SPAWN.clusterChance;
    const rolled = cluster
      ? randInt(SPAWN.clusterMin, SPAWN.clusterMax)
      : 1;
    const count = Math.min(rolled, remaining);

    const out: SpawnRequest[] = [];
    for (let i = 0; i < count; i++) {
      // After every `bombsPerNFruits` fruits, the next spawn becomes a bomb.
      // (At least one fruit between bombs, even within a single cluster.)
      if (this.fruitsSinceLastBomb >= tier.bombsPerNFruits) {
        this.fruitsSinceLastBomb = 0;
        out.push({ kind: 'bomb', speedMultiplier: tier.speedMultiplier });
      } else {
        this.fruitsSinceLastBomb++;
        out.push({ kind: 'fruit', speedMultiplier: tier.speedMultiplier });
      }
    }
    return out;
  }

  reset(): void {
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.fruitsSinceLastBomb = 0;
  }

  getElapsed(): number {
    return this.elapsed;
  }
}
