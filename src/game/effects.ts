// Visual effects: fruit bursts (juice particles) and bomb explosions
// (expanding ring + flash + sparkle). All effects own their own particle
// state and are advanced/rendered by GameView.

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
};

export type BurstEffect = {
  kind: 'burst';
  startedAt: number;
  duration: number;
  particles: Particle[];
};

export type ExplosionEffect = {
  kind: 'explosion';
  x: number;
  y: number;
  startedAt: number;
  duration: number;
};

export type Effect = BurstEffect | ExplosionEffect;

const FRUIT_PARTICLE_COLORS = [
  '#ff4fa6',
  '#ffaadd',
  '#ffd6ec',
  '#ffffff',
  '#ff8fcd',
  '#ff7aa8',
];

/** A 12-particle juice splatter at the hit point, gravity-affected. */
export function createBurstEffect(
  x: number,
  y: number,
  ts: number,
  dpr: number
): BurstEffect {
  const particles: Particle[] = [];
  const count = 12;
  for (let i = 0; i < count; i++) {
    // Even angular distribution + jitter so it looks organic.
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const speed = (320 + Math.random() * 380) * dpr;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: (4 + Math.random() * 6) * dpr,
      color:
        FRUIT_PARTICLE_COLORS[
          Math.floor(Math.random() * FRUIT_PARTICLE_COLORS.length)
        ],
    });
  }
  return { kind: 'burst', startedAt: ts, duration: 700, particles };
}

export function createExplosionEffect(
  x: number,
  y: number,
  ts: number
): ExplosionEffect {
  return { kind: 'explosion', x, y, startedAt: ts, duration: 520 };
}

/**
 * Advance burst particles under gravity. Effects expire by elapsed time
 * (caller is responsible for filtering by age).
 */
export function updateEffects(
  effects: Effect[],
  dt: number,
  particleGravity: number
): void {
  for (const eff of effects) {
    if (eff.kind === 'burst') {
      for (const p of eff.particles) {
        p.vy += particleGravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
  }
}

/** Linear screen-shake decay model. */
export type Shake = { intensity: number };

export function decayShake(shake: Shake, dt: number): void {
  // Exponential-style decay; full kick fades in ~300ms.
  const decayPerSec = 12;
  shake.intensity *= Math.exp(-decayPerSec * dt);
  if (shake.intensity < 0.5) shake.intensity = 0;
}
