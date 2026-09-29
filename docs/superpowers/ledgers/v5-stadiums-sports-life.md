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
- Task 12: Ruling: found a pre-V5 bug — Burnham Park's ground polygon (polygon offset −1) overdrew Soldier Field's field at oblique angles (black at night, unpainted by day). Fixed in the pipeline: `cutZones` subtracts venue hulls from park polygons (6111 → 6107) — test trees 'cutZones' RED→GREEN — cost: none.
- Task 13: Ruling: plan's fieldMarks draws a navy keyline behind the midfield C (true to the Bears logo) but its test counted all navy polys as end zones; test now filters end zones by extent — cost: none.
- Task 14: Ruling: plan's crowd vertex shader used right = (−toCam.z, 0, toCam.x), which back-faces every billboard (nothing drew); corrected to (toCam.z, 0, −toCam.x) — cost: none.

## Evaluate and revert (one line per visual step: Keep | Revert — item — shots — reason)

- Keep — D4 — soldier-aerial ×3 — west rim lamp row blazes at night (east row faces away from this camera, as it should); invisible by day.
- Keep — D5 — rate-aerial ×3 — 20 m towers + roof rows read as a lit ballpark at night; slim navy banks by day. rate-from-loop 'distinct lit bowl' re-checked after Task 12 (needs venue light level).
- Tune — D2 — uc-aerial, wintrust-aerial day — shapes right (stepped dome, E–W vault) but crowns drew in the wall façade (UC brown brick streaks); added crown `surface` (white steel) — re-shoot after rebuild.
- Keep — D2 — uc-aerial, wintrust-aerial ×3 — after tuning: crown `surface` (UC light-grey steel, Wintrust white), gridded curved tops with analytic normals (earcut had ignored the Steiner points → 164 m slivers that shaded in streaks), smooth elliptic dome (distance dome creased like a hip roof). UC reads as a grey domed roof on the brick drum; Wintrust as a white vault.
- Keep — D4/D6 — soldier-aerial vs -game night — field glows (dim idle 0.5, full on game nights), west rim row blazes.
- Keep — D5 — rate-from-loop night — Rate Field is now a visible floodlight cluster on the south horizon (was a single dot).
- Keep — D14 — uc-aerial / wintrust-aerial -game night — UC fascia glows warm (brighter on game nights); Wintrust concourse glass bands light on game nights. Not garish; no coefficient change.
- Keep — D3 — soldier-top (+LOW, +soccer), wrigley-top, rate-top, wrigley-aerial night — NFL field with BEARS/CHICAGO end zones, orange C, numbers and hashes; IFAB pitch for the Fire; MLB diamonds with checker/stripe mowing, clay, foul lines; LOW identical in layout.
- Keep — D8 — wrigley-bowl ×2, soldier-bowl, wrigley-aerial-game night — full stands in home-team shirts (Cubs blue/red, Bears navy/orange), heads visible, lit at night; texture at 140 m. After fixing the plan's billboard basis (quads faced away → culled; W flags would have been mirrored) — crowdShader test RED→GREEN.
- Keep — D9 — wrigley-bowl, soldier-bowl ×2, soldier-top-soccer — batter at the plate at Wrigley; Bears navy vs visitors white at the line of scrimmage; figures on the grass. Tuned once: players take a floodlight emissive share at night (were unlit) — playersLight test RED→GREEN.

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
- Task 12: code complete (app 291/291); evaluation after rebuild
- Task 12: complete — evaluated D2/D4/D5/D6/D14 keep (app 291/291, pipeline 356/356)
- Task 13: complete (app 304/304)
- Task 14: complete (app 314/314)
- Task 15: complete (app 320/320)
