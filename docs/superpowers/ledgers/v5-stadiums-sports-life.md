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
- Task 18: Ruling: the Michael Jordan statue is not modelled — it stands inside the United Center atrium since 2017, not on the plaza — cost: none.
- Task 19: Ruling: plan's cheers engine created its own AudioContext (2 on the page); now takes V4's shared getAudioContext and never closes it on dispose — cheers test 'share the one sound context' RED→GREEN — cost: none.
- Task 19: Ruling: the 'check it by ear' step can't be done in this session; replaced with an automated AudioContext/gain probe — cost if wrong: the murmur/swell timbre is unreviewed.
- Task 20: Ruling: the provenance chip reads 'ESPN' (build-time schedule) or 'SIMULATED', not 'LIVE' — a red LIVE chip beside a game days away read as 'in progress'; LIVE stays for a live game only. Tests updated first (tonight 'labels', sports card) — cost: wording differs from the spec's 'LIVE / SIMULATED chip'.
- Task 21: Ruling: no hero-view baselines regenerated — 10/10 ×3 pass with ?sports=idle (the plan expected wrigleyville/museum diffs; they fall within snapshot tolerance) — cost: none.
- Task 21: Ruling: gallery Soldier Field image taken from after-players/soldier-bowl-night (crowd + painted field + players) instead of the plan's after-state shot, which predates fields and crowds — cost: none.

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
- Keep — D13 — wrigley-board-win, soldier-bowl, rate-aerial-game — Wrigley's green board reads WRIGLEY FIELD / VIS 3 / CHC 5 / FINAL from the plate; Rate's video board lit at night; no z-fighting.
- Keep — D11 — wrigley-board-win/-loss, wrigley-field-win — white flag with blue W over the board after a win, blue with white L after a loss; fans on the field and W flags waving in the stands on the win day.
- Keep — D14 — uc-plaza, uc-aerial-game, wintrust-aerial-game night — standing fans in Bulls red ring the United Center under its lit fascia; a smaller crowd rings Wintrust.
- Keep — D10 — automated, not by ear (no audio output in this session): Sound off → 0 AudioContexts at a live Wrigley game; Sound on → exactly 1 (shared with the train rumble); voice level driven by murmurLevel/swellNow, zero beyond CHEER.maxDistance. Needs a human listen for timbre.
- Keep — D12 — after-hud/games-panel.png, venue-card.png — walked with no URL params: Games button → five venues with states; row → flies there + card; Esc closes; ⌘K 'tonight' → first option 'Go to tonight's game'; help lists Games. Tuned: card moved top-left (was over the transit legend); hint bar shortened (overflowed under the minimap at 1440 px).

## Perf (pose — calls — triangles — fps — quality — sports)

- PERF streeterville HIGH idle: 492 calls, 2653204 tris, 52.8 fps
- PERF streeterville HIGH live: 492 calls, 2653204 tris, 51.9 fps
- PERF loop HIGH idle: 394 calls, 1786779 tris, 54.6 fps
- PERF loop HIGH live: 394 calls, 1786779 tris, 52.6 fps
- PERF wabash HIGH idle: 271 calls, 1733297 tris, 55.5 fps
- PERF wabash HIGH live: 271 calls, 1733297 tris, 54.3 fps
- PERF wrigley-bowl HIGH idle: 249 calls, 1954273 tris, 53.4 fps
- PERF wrigley-bowl HIGH live: 251 calls, 2091517 tris, 57.4 fps
- PERF wrigley-bowl LOW idle: 128 calls, 799437 tris, 57.9 fps
- PERF wrigley-bowl LOW live: 128 calls, 799437 tris, 57.7 fps
- PERF soldier-bowl HIGH idle: 146 calls, 540077 tris, 57.4 fps
- PERF soldier-bowl HIGH live: 149 calls, 788477 tris, 57.4 fps
- PERF soldier-bowl LOW idle: 60 calls, 131985 tris, 58.5 fps
- PERF soldier-bowl LOW live: 60 calls, 131985 tris, 58.7 fps
- PERF rate-aerial HIGH idle: 153 calls, 565962 tris, 58.6 fps
- PERF loop HIGH live: 394 calls, 1786779 tris, 53.8 fps
- PERF loop HIGH idle: 394 calls, 1786779 tris, 53.3 fps

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
- Task 16: complete (app 325/325)
- Task 17: complete (app 327/327)
- Task 18: complete (app 328/328)
- Task 19: complete (app 337/337)
- Task 20: complete (app 346/346)
- Task 21: complete — perf 3/3 (≤ 492 calls wide; live +2–3 per bowl, +0 at LOW), pipeline 356/356, app 346/346, TZ=Asia/Tokyo sports+audio 80/80, schedules 594 games, world 186.2 MB, e2e 10/10 ×3.
- V5 done: D2–D15 kept (D2 tuned, D9 tuned, D12 tuned); pre-V5 Soldier Field park overdraw fixed.
- Final review: fresh reviewer (opus) on 81acb26..a6572d1 — 0 Critical, 3 Important, 2 Minor.
- Final: fixed #1 undated 'NEXT WED' labels and 'tonight' for a game days away — whenChicago (Tonight/Today/Tomorrow/dated), ⌘K 'Go to the next game' when nothing is on today — v5ReviewFixes #1 ×2 RED→GREEN; old expectations in scoreboard/tonight tests updated (they encoded the defect).
- Final: fixed #2 Rate Field board naming the Sox as their own opponent (merged Crosstown record) — opponent now relative to the venue's teams — v5ReviewFixes #2 RED→GREEN.
- Final: fixed #3 unlit W/L flag (only ever flies after dark on weeknights) — emissive self-map driven by uNight — v5ReviewFixes #3 RED→GREEN; verified by night shot.
- Final: minor (deferred): #4 WinFlag PlaneGeometry never disposed on unmount.
- Final: minor (deferred): #5 Games dock button lacks pressed/aria-expanded state.
