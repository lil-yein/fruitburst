# FruitBurst

Browser-based arcade game using webcam hand-tracking. Point your finger to aim, flick up to shoot fruits, avoid bombs, survive as long as you can.

See [`PRD.md`](PRD.md) for the full spec.

## Stack

- React + Vite + TypeScript
- HTML5 Canvas 2D for the game loop
- MediaPipe Tasks Vision (HandLandmarker) for fingertip tracking — all client-side

## Dev

```bash
npm install
npm run dev
```

Open the URL Vite prints. Allow webcam access.

## Status

Phase 1 (MVP) — in progress, built in checkpoints.

- [x] CP0 — scaffold
- [x] CP1 — webcam + tracking + crosshair
- [x] CP2 — flick gesture
- [x] CP3 — fruit/bomb spawning + physics
- [x] CP4 — collision + lives + scoring
- [ ] CP5 — difficulty + screens + local leaderboard

## Tunable constants

All in [`src/game/config.ts`](src/game/config.ts).
