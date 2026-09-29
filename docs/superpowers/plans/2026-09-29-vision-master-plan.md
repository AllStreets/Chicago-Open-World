# Vision Pass — Master Plan

> **For agentic workers:** this is the ordering document. Each milestone has its own implementation plan (linked). Execute milestones in order, using superpowers:executing-plans (native, one ledger per plan). **Do not start V1 until the user says "go ahead".**

**Goal:** Realize the 2026-09-29 vision:
- one continuous lake and river;
- CTA and Metra lines in their true colours with a restrained neon glow, and accurate trains running on them;
- stadiums that live: roofs, fields, night lights, crowds, games, cheers, W flags;
- detailed landmarks and bridges;
- sourced building colours;
- a camera that never ends up inside a tower.

The project stays realistic and beautiful, and a non-coder can operate everything.

**Spec:** `docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md`, Addendum B (binding) and Addendum A.
**Backlog (item source of truth):** `docs/superpowers/backlog/2026-09-29-vision-backlog.md`.

## Global constraints (every milestone)
- **No human in the loop.** Decide, record `Ruling:` lines in the milestone ledger, and keep going. The four stop conditions of executing-plans still apply.
- **Push to `origin main`** (AllStreets/Chicago-Open-World) at the end of every milestone.
- **RAM discipline:** only one heavy process at a time (world build, or dev server + Playwright, never both at once). Close browsers when done.
- **Budgets (Addendum B.1):**
  - HIGH: ≤ 900 draw calls (shadow and post passes included), ≤ 4 M triangles, 60 fps on M-series.
  - `public/world` ≤ 200 MB.
  - Every system has a LOW fallback.
- **Evaluate and revert:** every visual change gets fixed-pose screenshots (day, dusk, night) before and after. Anything unpleasing is reverted in its own commit, with a ledger line.
- **README:**
  - Never modify an existing image.
  - Append new images to the "How it came together" gallery under new filenames: `docs/screenshots/v<N>-<subject>-<time>.png`.
- **Human-first:** every feature has a button, a ⌘K entry, and a line on the help card and hint bar.
- **TDD:** a failing test first for every pure function, pipeline builder and state machine; screenshot poses for everything visual.

## End-of-milestone checklist (applies to V1–V8)
1. Run both unit suites green: `npm test --prefix pipeline`, `npm test --prefix app`.
2. Run the world build; the skyline assertion must pass.
3. Run e2e: regenerate only baselines the milestone intentionally changed, then get 3 consecutive green runs.
4. Perf check at the wide Streeterville, wide Loop and densest views: log draw calls, triangles and fps against budget in the ledger.
5. Evaluate-and-revert screenshots; add 2–4 gallery images and captions to the README; update the roadmap and badges.
6. Commit and push.

## Milestones

| # | Milestone | Plan | Backlog IDs |
|---|---|---|---|
| **V0** | Docs: backlog, spec Addendum B, master plan, per-milestone plans, later-phase plans, README gallery of existing images, ledger | *this document* + the plans below | A1, A2, A3, A4, A5, A6, A7, A8, A9, A11, A12, C17, C19 |
| **V1** | Correctness, camera clearance, unified water | [v1](2026-09-29-v1-correctness-clearance-water.md) | H1, H2, H3, H4, H5, H6, H7, H8 (closed by G4), H9, H10, G1, G2, G4, G5, D1, B1, B2, B3, B4, B5, B6, B7, B8, B9, B10 |
| **V2** | True building colours and materials | [v2](2026-09-29-v2-building-colours.md) | F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11 |
| **V3** | Transit: lines, colours, glow, structure, stations, transit HUD | [v3](2026-09-29-v3-transit-lines.md) | C1, C2, C3, C4, C5, C10, C13 |
| **V4** | Transit: trains, simulation, follow cam, cards, sound | [v4](2026-09-29-v4-trains.md) | C6, C7, C8, C9, C12, C14, C15, C16, C18, C20 |
| **V5** | Stadiums and sports life | [v5](2026-09-29-v5-stadiums-sports-life.md) | D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12, D13, D14, D15 |
| **V6** | Landmarks and bridges | [v6](2026-09-29-v6-landmarks-bridges.md) | E1, E2, E3, E4, E5, E6, E7, E8, E9, E10 |
| **V7** | Controls integration and help | [v7-v8](2026-09-29-v7-v8-controls-perf-gallery.md) | G3, G6 |
| **V8** | Performance, gallery, final review | [v7-v8](2026-09-29-v7-v8-controls-perf-gallery.md) | H11, A10, A13 |
| **P3** | Phase 3: hero refinement plus P2 landmarks | [phase 3](2026-09-29-phase-3-hero-refinement.md) | I-3.1, I-3.2, I-3.3, I-3.4, I-3.5 |
| **P4** | Phase 4: guide lenses, places, transit integration | [phase 4](2026-09-29-phase-4-guide-lenses.md) | I-4.1, I-4.2, I-4.3, I-4.4, I-4.5, I-4.6 |
| **P5** | Phase 5: Alive (live CTA, scores, weather, Scan) | [phase 5](2026-09-29-phase-5-alive.md) | I-5.1, I-5.2, I-5.3, I-5.4, I-5.5, C11 |
| **P6** | Phase 6: further rings | [phase 6](2026-09-29-phase-6-further-rings.md) | I-6.1, I-6.2, I-6.3 |
| **P7** | Phase 7: traversal | [phase 7](2026-09-29-phase-7-traversal.md) | I-7.1, I-7.2 |

Every backlog ID appears exactly once in this table. A9, A11 and A12 are standing rules, adopted in V0 and enforced in every milestone. C17 and C19 are planning items satisfied by the P4 and P5 plans (they are written in V0). C11, live CTA, moves to P5 per backlog default 9.

## Order and dependencies
- **V1 first.** The unified water, depth ordering and camera clearance underlie every later visual. H7 (unique `_BLDG`) is needed by the P4 building cards. G1's clearance is used by V4's follow cam and V5's venue focus.
- **V2 next.** It adds the `_STYLE` attribute and palette texture to the tile format. V3's stations and V6's landmarks reuse that palette, so the format change lands once.
- **V3 → V4.** Trains need the ordered track paths and stations from V3.
- **V5 and V6 are independent** of V3/V4 and of each other. Run them in order to keep one ledger per plan.
- **V7** consolidates the controls added in V3–V6 (dock layout at every window size, help card, hint bar, ⌘K groups).
- **V8** enforces the ≤ 900 draw-call budget over the complete scene, completes the gallery and runs a fresh whole-pass review (opus) with one fix pass.
- **P3–P7** follow. Each gets its later-phase plan refreshed against what V1–V8 actually shipped, at the start of that phase.

## Tile format changes (one per milestone, all in the build; the manifest version bumps)
- **V1:**
  - `_CALM` is added to the water layer.
  - `water/shore.png` and `heightfield.png` are added.
  - `_BLDG` becomes unique per file.
  - Manifest v4.
- **V2:** `_STYLE` is added to buildings, plus `styles.json` and `style-palette.png`. Manifest v5.
- **V3:**
  - `transit` layer (tracks), `glow` layer, `stations` layer.
  - `transit.json`.
  - Manifest v6.
- **V4:** `trains.glb` is added.
- **V5:**
  - Venue field frames, seat anchors and player spots are added to the sidecar.
  - `schedules.json` is added.
- **V6:** bridge and landmark meshes go into the building layer with `_STYLE`, and `bridges.json` is added.

## Rulings made while writing this plan
- Ruling: the live CTA feed (C11) moves to P5 — backlog default 9. Simulated trains ship in V4 — cost if wrong: trains aren't real-time until P5.
- Ruling: the sports schedule and past results are fetched at build time (ESPN public JSON, cached in `schedules.json`), so game days and Cubs W days work before P5. Live scores come in P5 — cost if wrong: results are only as fresh as the last build.
- Ruling: rolling stock and seahorses are procedural pipeline builders first; Blender refinement moves to P3 — cost if wrong: less sculptural detail until P3.
- Ruling: later-phase plans (P3–P7) are written now at task, interface and test level. Their code-level steps are completed at each phase start, because they depend on V1–V8's outcomes — cost if wrong: one refresh pass per phase.
- Ruling: the README gallery using only existing images is done in V0, since it is docs only and needs no browser. New images start in V1 — cost if wrong: none.
