# V5 ledger — Stadiums and sports life

Plan: `docs/superpowers/plans/2026-09-29-v5-stadiums-sports-life.md`. Shots: `docs/superpowers/ledgers/v5-shots/<before|after>/` (git-ignored working evidence).

## Rulings

- Task 2: Ruling: plan's `skirt` emitted zero-area wall halves where one end sits at the eave (frontFacing failed); each half now emitted only where its own vertical edge has height — cost: none.
- Task 3: Ruling: world rebuild deferred to Task 7's single rebuild (Tasks 3–7) — a rebuild now would swap world files under the running 'before' capture; D2 is evaluated on its own arena shots after Task 7 — cost: D2 evaluated later.
- Task 4: Ruling: no separate pre-fields capture — the 'before' set (same world, nothing rebuilt yet) already covers those poses — cost: none.
- Task 7: Ruling: plan assumed an existing `inBuilding(p)` in build-world.js; none existed — defined from the footprint grid index (footIdx + pointInRing) — cost: none.
- Task 7: Wrigley yields 33,926 seat anchors from its bowl geometry (< 41,649 capacity; capacity is a cap, not a target); Soldier 61,500 and Rate 40,615 hit capacity. world 186.1 MB.
- Task 8: Ruling: schedules fetched after the Task 7 build, so manifest.schedules was set to 'schedules.json' by hand — exactly what the next build writes (the file now exists) — cost: none.
- Task 11: Ruling: plan test expected level 0.2 after setVenueLights(level 0.5) — stale from the idle-light 0.2→0.5 override; test expects 0.5 — cost: none.
- Task 11: Ruling: cache key 'facade-v9' (V2 already used v8, so v8 would not invalidate compiled programs); plan's GLSL comment used backticks inside the JS template literal — replaced with quotes — cost: none.

## Evaluate and revert (one line per visual step: Keep | Revert — item — shots — reason)

- Keep — D4 — soldier-aerial ×3 — west rim lamp row blazes at night (east row faces away from this camera, as it should); invisible by day.
- Keep — D5 — rate-aerial ×3 — 20 m towers + roof rows read as a lit ballpark at night; slim navy banks by day. rate-from-loop 'distinct lit bowl' re-checked after Task 12 (needs venue light level).
- Tune — D2 — uc-aerial, wintrust-aerial day — shapes right (stepped dome, E–W vault) but crowns drew in the wall façade (UC brown brick streaks); added crown `surface` (white steel) — re-shoot after rebuild.

## Perf (pose — calls — triangles — fps — quality — sports)

## Progress
- Task 1: complete (bookmarks 7/7; harness smoke 3 passed, soldier-aerial centred)
- Task 2: complete (geom+crowns 15/15)
- Task 3: code complete (pipeline 325/325); rebuild + evaluate with Task 7
- Task 4: complete (pipeline 330/330; app materials 35/35)
- Task 5: complete (pipeline 333/333)
- Task 6: complete (pipeline 336/336)
- Task 9: complete (sports 12/12 in host TZ, Asia/Tokyo, America/Los_Angeles)
- Task 10: complete (sports 16/16)
- Task 7: complete (pipeline 341/341; build EXIT 0; venues sidecar 5 venues)
- Task 8: complete (teams+schedules 10/10; ESPN 17/17 ok, 594 games, 296 at our venues)
- Task 11: complete (materials 39/39)
