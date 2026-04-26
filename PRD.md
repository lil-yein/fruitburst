# Product Requirements Document: FruitBurst

**Version:** 1.1
**Last Updated:** April 2026
**Status:** Finalized for implementation

---

## 1. Overview

**Product Name:** FruitBurst *(working title — rename as desired)*

**Product Type:** Browser-based arcade survival game using webcam hand-tracking for aim-and-shoot input.

**One-line pitch:** Point your finger to aim, flick up to shoot flying fruits, avoid bombs, survive as long as you can. The longer you last, the higher your score.

**Goal:** Deliver a fun, accessible, web-first arcade game that uses real-time computer vision for input, with a tight difficulty curve and a leaderboard for replay value.

---

## 2. Target Audience

- Casual gamers who enjoy motion-based arcade games.
- Anyone with a standard laptop/desktop webcam.
- Social/competitive players who enjoy leaderboards.
- Streamers and content creators — the webcam overlay is inherently shareable.

---

## 3. Core Gameplay Loop

1. Player lands on start screen → grants webcam permission.
2. Brief calibration confirms hand tracking and crosshair behavior.
3. Gameplay begins: fruits arc up from the bottom edge.
4. Player points their index finger to aim (crosshair follows fingertip).
5. Player flicks their finger upward to shoot — the object under the crosshair bursts instantly.
6. Bombs appear occasionally — player must NOT shoot them.
7. Difficulty scales up over ~5 minutes, then plateaus.
8. Lives deplete from missed fruits and from shooting bombs.
9. Game ends when lives reach 0.
10. Player enters name, saves run time, sees leaderboard.

---

## 4. Functional Requirements

### 4.1 Hand Tracking (Input)

- **Single-hand tracking** via webcam.
- Track the **index fingertip** as the primary input point.
- Render a **crosshair / dot** at the fingertip position every frame, smoothed lightly to reduce jitter.
- Detect the **"flick up"** gesture (see 4.2 for specifics).
- Must run at **30 FPS minimum** on a mid-range laptop.
- Video feed shown to the player should be **mirrored** so movement feels natural.

**Hand out of frame:** Do NOT pause. Display a non-blocking warning overlay ("Show your hand!"). Game continues running; fruits that fall off-screen still cost life as normal. This preserves challenge and prevents players from exploiting frame-exits to pause difficulty.

**Recommended library:** MediaPipe Hands (Google). Provides 21 landmarks per hand including the index fingertip. Fast, accurate, runs fully client-side.

### 4.2 Interaction Mechanic (Aim + Shoot)

**Aim:** The crosshair renders at the index fingertip position every frame, with light smoothing to reduce jitter.

**Shoot — "flick up" gesture, instant hit:**
- Detection: maintain a rolling window (~5–8 frames) of fingertip positions. When vertical upward velocity exceeds a calibrated threshold within a short window (one-frame spike, not sustained motion), register a shot.
- Debounce: ~200ms between shots to prevent double-fires.
- Resolution: on flick, instantly check the crosshair position against all active objects. The first intersected object (if any) is hit.
  - Fruit hit → burst animation, no life penalty.
  - Bomb hit → explosion animation, screen shake, **-1 life**.
  - No object under crosshair → harmless miss (play a small shot/muzzle effect, no penalty).
- Flick threshold and debounce must be **tunable constants** for playtesting.

### 4.3 Game Objects

**Fruits**
- Multiple fruit types (e.g., apple, watermelon, orange, banana, pineapple).
- Spawn from the bottom edge with a **bottom-up arc** (Fruit Ninja style): projectile physics with initial upward velocity + gravity.
- Randomized horizontal spawn position, launch angle, and initial speed.
- On hit: burst animation with particle/juice splatter.
- May spawn singly or in small clusters of 2–4 for variety.

**Bombs**
- Visually distinct (dark, round, lit fuse — unmistakable).
- Same bottom-up arc trajectory as fruits.
- Spawn less frequently (~1 per 10–15 fruits, scaling with difficulty).
- On hit (player shoots it): explosion animation, screen shake, **-1 life**.
- **Ignoring a bomb is CORRECT behavior** — bombs that fall off-screen unshot carry no penalty.

### 4.4 Lives System

- Player starts with **5.0 lives**.
- **Miss a fruit** (falls off-screen without being shot): **-0.5 lives**.
- **Shoot a bomb**: **-1 life**.
- **Let a bomb pass unshot**: no penalty.
- Lives displayed as hearts with half-heart granularity.
- Game over when lives ≤ 0.

### 4.5 Difficulty Progression

Difficulty scales with elapsed time and plateaus around 5 minutes. Runs may continue indefinitely past the plateau — there's no forced end.

| Time Elapsed     | Spawn Rate | Fruit Speed | Bomb Frequency  |
|------------------|-----------|-------------|-----------------|
| 0–60s            | 1 / 2.0s  | 1.0x        | 1 per 15 fruits |
| 60–180s          | 1 / 1.3s  | 1.4x        | 1 per 12 fruits |
| 180–300s         | 1 / 1.0s  | 1.7x        | 1 per 10 fruits |
| 300s+ (plateau)  | 1 / 1.0s  | 1.7x        | 1 per 10 fruits |

Keep all difficulty values in a single `config.ts` file for easy tuning.

### 4.6 Scoring

- **Primary metric:** survival time in seconds with 2-decimal precision (e.g., `87.35s`).
- **Secondary (displayed, not ranked):** fruits burst, bombs avoided, accuracy %.
- Timer visible on the HUD throughout the game.

### 4.7 Score Submission & Leaderboard

**Local leaderboard (MVP):**
- Top 10 scores stored in `localStorage`.
- Fields: name, time, date.
- Name input: 3–20 characters, basic sanitization.
- Shown on game-over screen and on a dedicated Leaderboard screen.

**Online leaderboard (Phase 2):**
- Global top 100.
- `POST /api/scores` on submit, `GET /api/scores?limit=100` on view.
- Minimal anti-abuse: name length cap, profanity filter, per-IP rate limit.
- No login / accounts required.

---

## 5. UI / UX Requirements

> The user will provide UI/design components. Code should reference assets from a central `/assets/` directory and a theme config file so visuals are easily swappable.

### 5.1 Screens

1. **Start Screen** — title, "Start Game", "Leaderboard", webcam permission explainer.
2. **Calibration Screen** — live mirrored webcam preview, instructions ("point your finger, try a flick-up"), confirms tracking + gesture detection before the "Ready" button enables.
3. **Game Screen** — mirrored webcam feed as background, fruits/bombs overlaid, HUD, crosshair.
4. **Game Over Screen** — final time, name input, "Submit Score", "Play Again".
5. **Leaderboard Screen** — ranked list with rank, name, time, date.

### 5.2 HUD (during gameplay)

- Lives (heart icons, half-heart supported) — top corner.
- Timer — large, top-center.
- **Crosshair / dot** at tracked fingertip position — always visible during gameplay.
- "Show your hand!" warning overlay — visible only when tracking is lost.
- Subtle shot feedback (muzzle flash / shot line) when flick is detected.

### 5.3 Audio

- Looping background music.
- SFX: shot, fruit burst, bomb explosion, life lost, game over, score submit, UI clicks.
- Mute toggle accessible from any screen.

---

## 6. Technical Requirements

### 6.1 Recommended Tech Stack

**Frontend**
- **Framework:** React (Vite) for UI screens. HTML5 Canvas 2D for the game loop.
- **Hand tracking:** MediaPipe Hands (primary). TensorFlow.js handpose as fallback.
- **Rendering:** HTML5 Canvas 2D. Optional PixiJS if sprite management becomes complex.
- **Physics:** Custom lightweight projectile physics — no engine needed.

**Backend (Phase 2 only)**
- Next.js API routes, Node + Express, or serverless (Vercel / Netlify / Cloudflare Workers).
- DB: Supabase, Firebase, or SQLite. `scores` table: `(id, name, time, created_at)`.

### 6.2 Performance Targets

- ≥ 30 FPS gameplay on a mid-range laptop.
- Hand-detection + flick-detection perceived latency < 100ms.
- Supports Chrome, Firefox, Edge. Safari as stretch.
- **Desktop only for MVP.** Mobile is out of scope.

### 6.3 Privacy

- Clear webcam permission prompt with short explanation.
- All video processing is **client-side**. Nothing is uploaded.
- Only name + time sent to server for online leaderboard (Phase 2).

---

## 7. Collision Detection

- Collision only resolves **on flick** (not every frame).
- When a flick is detected, treat the crosshair as a point with a small forgiveness radius; test it against every active object.
- If multiple objects overlap, hit the closest one to the crosshair center.
- Missed fruits (those exiting the bottom edge unshot) trigger the -0.5 life penalty via a separate check each frame.

---

## 8. Development Phases

**Phase 1 — MVP**
- Webcam + one-hand tracking + fingertip crosshair.
- Flick-up gesture detection with tunable threshold + debounce.
- Fruit/bomb spawning with bottom-up projectile physics.
- Instant-hit collision on flick.
- Lives, timer, difficulty scaling with 5-min plateau.
- Hand-out-of-frame warning overlay.
- Game-over flow with name entry + local leaderboard.

**Phase 2 — Polish**
- Plug in provided art, animations, sounds.
- Final styling of Start / Calibration / Leaderboard screens.
- Difficulty tuning from playtesting.
- Accessibility pass (contrast, shot-feedback clarity).

**Phase 3 — Online Leaderboard**
- Backend + DB.
- Global leaderboard UI.
- Basic anti-abuse.

---

## 9. Success Metrics

- Flick-up shots feel responsive (< 100ms perceived latency).
- Hand tracking feels fair — no frequent "I aimed right at it" moments.
- Average play session > 2 minutes.
- No crashes over a 10-minute session.
- Scores save and load reliably on every attempt.

---

## 10. Out of Scope (MVP)

- Multiplayer / co-op.
- Mobile / tablet support.
- Multiple game modes or difficulty presets.
- User accounts / login.
- In-game store, cosmetics, unlocks.
- Power-ups, combos, score multipliers.

---

## 11. Remaining Items (minor — do not block development)

Reasonable defaults can be used; confirm before final polish:

1. **Visual theme** — cartoony, realistic, neon, minimalist. *(Will be driven by the UI/design components you provide.)*
2. **Soundtrack mood** — upbeat arcade, lo-fi, chiptune, silent by default?
3. **Specific fruit types** — any preferences, or developer's choice from common ones?

---

## 12. File / Repo Structure Suggestion

```
/fruitburst
  /public
    /assets
      /fruits         ← provided art
      /bombs
      /ui             ← crosshair, hearts, buttons
      /sfx
      /music
  /src
    /components       ← React UI (screens, HUD, leaderboard)
    /game
      engine.ts       ← main game loop
      spawner.ts      ← fruit/bomb spawning + difficulty curve
      physics.ts      ← projectile motion
      collision.ts    ← crosshair vs object on flick
      tracking.ts     ← MediaPipe wrapper
      gesture.ts      ← flick-up detection
      config.ts       ← tunable constants (lives, scaling, thresholds)
    /api              ← Phase 2 backend
    App.tsx
    main.tsx
```

---

## 13. Decision Log (confirmed with user)

| Decision                 | Choice                                                              |
|--------------------------|---------------------------------------------------------------------|
| Interaction style        | Point with index finger, flick up to shoot                          |
| Shot behavior            | Instant hit (hitscan) on flick                                      |
| Aim indicator            | Crosshair / dot at fingertip                                        |
| Hands tracked            | One                                                                 |
| Leaderboard scope        | Local for MVP, online in Phase 2                                    |
| Run length               | Soft cap at 5 min (difficulty plateaus; run can continue past)      |
| Fruit trajectory         | Bottom-up arcs (Fruit Ninja style)                                  |
| Bomb behavior            | Shooting a bomb = -1 life; letting it pass = no penalty             |
| Hand out of frame        | Non-blocking warning overlay; game keeps running                    |
| Starting lives           | 5                                                                   |
| Miss fruit penalty       | -0.5 lives                                                          |
| Bomb shot penalty        | -1 life                                                             |
