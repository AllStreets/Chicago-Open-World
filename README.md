<div align="center">

# CHI ATLAS · OPEN WORLD

**THE CITY, AT FULL SCALE**

<img alt="phase" src="https://img.shields.io/badge/phase-1_foundation-45d8ff?style=for-the-badge&labelColor=030509"/>
<img alt="buildings" src="https://img.shields.io/badge/real_buildings-2,517-ff3b53?style=for-the-badge&labelColor=030509"/>
<img alt="setbacks" src="https://img.shields.io/badge/OSM_setbacks-187_towers-45d8ff?style=for-the-badge&labelColor=030509"/>
<a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-45d8ff?style=for-the-badge&labelColor=030509"/></a>
<br/>
<img alt="stack" src="https://img.shields.io/badge/stack-React_19_·_Three.js_·_R3F-6b7382?style=flat-square&labelColor=030509"/>
<img alt="data" src="https://img.shields.io/badge/data-City_of_Chicago_·_OpenStreetMap-6b7382?style=flat-square&labelColor=030509"/>
<img alt="tests" src="https://img.shields.io/badge/tests-Vitest_·_Playwright-6b7382?style=flat-square&labelColor=030509"/>

</div>

---

<p align="center">
  <img src="docs/screenshots/phase1-loop-day.png" alt="Looking northeast across the Loop — Hancock's twin masts and Trump's spire, Lake Michigan beyond" width="100%"/>
</p>

<p align="center"><em>Northeast across the Loop. Every building here is a real City of Chicago footprint at its real height.</em></p>

---

## What this is

**An explorable, game-quality Chicago that runs in your browser** — and a new way to plan
a visit, a move, or a job in a city. Fly it like a drone, orbit a tower, drop down the river canyon.

It is the sibling of [CHI ATLAS](https://github.com/AllStreets/chi) — same mission-control HUD
(near-black glass, electric cyan, Chicago red, Michroma / Archivo / IBM Plex Mono) — but the map is
replaced by a full 3D city built from public data, and, in later phases, hand-modelled Blender
landmarks, generated façade textures, live L trains and three guide lenses: **VISIT · LIVE · WORK**.

The world is projected into metres around **State & Madison** — the zero point of Chicago's address
grid — so the HUD always knows which corner you are over.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/phase1-museum-day.png" alt="The postcard view from Museum Campus" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/phase1-streeterville-dusk.png" alt="Dusk over Streeterville from the lake" width="100%"/></td>
</tr>
<tr>
<td><em>Museum Campus — the postcard view, Grant Park in front.</em></td>
<td><em>Dusk over Streeterville, real Chicago sun position.</em></td>
</tr>
</table>

---

## Quickstart

```bash
git clone https://github.com/AllStreets/Chicago-Open-World.git
cd Chicago-Open-World
npm install --prefix pipeline && npm install --prefix app

npm run fetch          # download footprints, boundary and OSM data (cached)
npm run build:world    # build tiles + ground into app/public/world
npm run dev            # http://localhost:5173
```

The generated world is committed, so `npm run dev` works straight after install.
Jump to a view with `?view=streeterville|loop|river|museum` and `?time=live|dawn|day|dusk|night`.

## Controls

| Input | Action |
|---|---|
| Drag | rotate |
| Scroll | zoom (toward cursor) |
| `W` `A` `S` `D` | glide |
| `↑` `↓` / `←` `→` | pitch / rotate |
| `Shift` | boost |
| `O` | orbit |
| `1`–`5` | LIVE · DAWN · DAY · DUSK · NIGHT |

## Under the hood

```
shared/project.js     one projection, used by pipeline and app
pipeline/             build-time Node — fetch → project → extrude → classify → tile → .glb
app/                  Vite · React 19 · React Three Fiber · zustand
  src/world/          city tiles, land, river, Lake Michigan, physical sky
  src/camera/         Atlas camera rig
  src/hud/            CHI ATLAS HUD — wordmark, readout, pills, hints, loading
```

```bash
npm test                          # pipeline + app unit tests (Vitest)
npm run e2e --prefix app          # hero-view screenshot baselines (Playwright)
```

## Data

- **City of Chicago Data Portal** — Building Footprints (`syp8-uezg`), City Boundary (`qqq8-j68g`).
- **OpenStreetMap** — building heights, `building:part` setbacks, river and harbour polygons.
  © OpenStreetMap contributors, available under the [ODbL](https://www.openstreetmap.org/copyright).

## Roadmap

- [x] **1 · Foundation** — real footprints and heights, land, river, lake, sky, Atlas camera, HUD shell
- [ ] **2 · Beauty pass** — generated façade atlases, lit windows at night, post-processing, minimap, intro flight
- [ ] **3 · Heroes** — Blender-modelled landmarks (Willis, Hancock, Marina City, …)
- [ ] **4 · Guide** — VISIT / LIVE / WORK lenses, ⌘K palette, tours
- [ ] **5 · Alive** — live L trains and weather via the CHI ATLAS API, Scan mode
- [ ] **6 · Neighborhood ring** — streaming tiles out to Wrigleyville, Wicker Park, Pilsen
- [ ] **7 · Traversal** — glide mode

Design spec: [docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md](docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md)

---

<div align="center">

**MIT** © 2026 [Connor Evans](https://github.com/AllStreets)

<sub>Four stars on the flag. Every building on the map.</sub>

</div>
