// app/src/sports/teamLights.js — "Team lights": the skyline in a Chicago team's two colours on the night it wins.
// Pure: which team (if any) the buildings show at an instant, the colours they show it in, and how each building
// carries them. TeamLights.jsx writes the answer into the façade shader (facadeMaterial.js uTeam*): no new meshes.
//
// How Chicago really does it (the buildings and the parts of them that change colour):
//  · Willis Tower — the two antennas carry an LED array (2013 upgrade) that changes colour in seconds; blue and orange
//    for big Bears wins, red and white for the Blackhawks. https://theskydeck.com/willis-tower-antennas-and-lights/ ,
//    https://www.bdcnetwork.com/home/news/55161905/willis-tower-upgrades-antenna-lighting
//  · 875 North Michigan (Hancock) — the lit band of its top floors and the two masts change colour for events; blue
//    and orange for the Bears. https://www.homedit.com/tallest-buildings/us/chicago/875-north-michigan-avenue/
//  · Two Prudential Plaza — the pyramid crown and spire, lit blue and red the night the Cubs won the 2016 pennant.
//    https://www.mlb.com/cut4/downtown-chicago-lit-up-after-cubs-nlcs-win-c206915154
//  · The Merchandise Mart — floodlit in team colours ("The City is Lighting Up in Bears colors. The Merchandise Mart
//    this evening", Barry Butler, Jan 2026). https://x.com/barrybutler9/status/2011944368215633947
//  · The Wrigley Building — floodlit since 1921 (https://en.wikipedia.org/wiki/Wrigley_Building); its floods take a
//    colour wash for Cubs nights (https://www.timeout.com/chicago/blog/10-heartwarming-displays-of-cubs-pride-in-chicago-102516).
//  · The displays are coordinated through BOMA/Chicago, which tells its member buildings to change colour together
//    (https://www.nbcchicago.com/news/sports/nfl/chicago-bears/chicago-skyline-lights-up-in-orange-and-blue-for-bears-playoff-run/3875734/)
//    — so the skyline shows ONE team at a time. With several winners on one day the buildings take turns (ROTATE_MS).
//  Left out on purpose: the Chicago Theatre (its incandescent sign does not change colour — it says "GO CUBS" in
//  letters, which we don't draw), 333 West Wacker and the Aon Center (no documented team lighting found).
import * as SunCalc from 'suncalc'
import { TEAMS, teamByKey } from '../../../shared/teams.js'
import { ORIGIN } from '../../../shared/project.js'
import { chicagoDate, chicagoToUtc, addDays } from './chicagoTime.js'
import { gameWindow, isVoid } from './gameState.js'

export const LIGHTS_UNTIL_HOUR = 2      // the lights stay on through 2 a.m. after the win
export const ROTATE_MS = 12000          // several winners: each team holds the skyline for 12 s
export const PREVIEW_MS = 60000         // ⌘K "Preview Cubs lights": a minute, then back to what's real
export const STORAGE_KEY = 'chi-ow-team-lights'

// The light each team's colours become. The official colours are shared/teams.js's; a colour that is too dark to be
// light (navy, black) becomes the LED colour fans see for it: Bears navy reads as deep blue light, and black stays
// dark — it shows as unlit bands between the lit ones (the White Sox' black, the Bulls' and Blackhawks' black are
// shown as white light, the way Willis lights the Blackhawks "red & white").
export const TEAM_LIGHT = {
  bears: ['#1C3DD6', '#FF5A0A'],      // navy #0B162A → blue light · orange #C83803
  cubs: ['#1F4BFF', '#FF2B2B'],       // Cubs blue #0E3386 · red #CC3433
  whitesox: ['#DCE6F2', '#0A0A0A'],   // silver #C4CED4 as white-silver light · black #27251F as dark bands
  bulls: ['#FF1A3C', '#F2F2F2'],      // red #CE1141 · black shown as white light (team's third colour)
  blackhawks: ['#FF1230', '#F4F4F4'], // red #CF0A2C · white (Willis: "Red & White")
  fire: ['#FF1414', '#6CCBFF'],       // red #FF0000 · light blue #7CCDEF
  sky: ['#3E97FF', '#FFC800'],        // sky blue #418FDE · yellow #FFCD00
}
export const teamLightColors = (key) => TEAM_LIGHT[key] ?? null

// How each building carries two colours — the way it really does. y in metres above ground (heroes.json heights);
// `c` 0 = the team's first colour, 1 = its second; `mode`: lantern (the light IS the surface: antennas, masts,
// spires), band (a lit band of top-floor windows), flood (coloured floodlights washing the stone, brighter higher up).
export const LIT_BUILDINGS = [
  { key: 'willis', name: 'Willis Tower', zones: [
    { y0: 443.5, y1: 496, c: 0, mode: 'lantern', k: 1.3 },   // the antennas' lower length…
    { y0: 496, y1: 528, c: 1, mode: 'lantern', k: 1.4 }] },  // …and their tips in the second colour
  { key: 'hancock', name: '875 North Michigan', zones: [
    { y0: 326, y1: 344.6, c: 0, mode: 'band', k: 1.8 },      // the crown band (floors 95–100)
    { y0: 345.4, y1: 458, c: 1, mode: 'lantern', k: 1.3 }] }, // the two masts
  { key: 'twopru', name: 'Two Prudential Plaza', zones: [
    { y0: 232, y1: 258, c: 0, mode: 'flood', k: 1.5 },       // the chevron setbacks
    { y0: 258, y1: 278, c: 0, mode: 'flood', k: 2.6 },       // the pyramid
    { y0: 278, y1: 304, c: 1, mode: 'lantern', k: 1.4 }] },  // the spire
  // the clock tower is its own sculpted terra cotta (style row wrigley-terracotta), the block below it 'wrigleybldg'
  { key: 'wrigleybldg', name: 'Wrigley Building', zones: [
    { y0: 0, y1: 97, c: 0, mode: 'flood', k: 1.25, styles: ['wrigleybldg', 'wrigley-terracotta'] }, // the floodlit terra cotta
    { y0: 97, y1: 140, c: 1, mode: 'flood', k: 1.7, styles: ['wrigley-terracotta'] }] },           // the clock tower
  // the piers and spandrels are the sculpt's dressed limestone (mart-limestone), the walls behind them 'mart'
  { key: 'mart', name: 'Merchandise Mart', zones: [
    { y0: 0, y1: 79, c: 0, mode: 'flood', k: 0.7, styles: ['mart', 'mart-limestone'] },  // the 18-storey block
    { y0: 79, y1: 106, c: 1, mode: 'flood', k: 1.5, styles: ['mart', 'mart-limestone'] }] }, // the central tower
]
export const MODE_CODE = { lantern: 1, band: 2, flood: 3 }
export const ZONE_SLOTS = 16

// The shader's zone table (one entry per zone and style row): each as [styleRow, y0, y1, mode] + [colourIndex, strength] — for the buildings whose
// style row is known (styles.json loaded). Unknown buildings are skipped; unused slots stay zero (off).
export function zoneTable(rowByKey) {
  const out = []
  for (const b of LIT_BUILDINGS) {
    for (const z of b.zones) for (const key of z.styles ?? [b.key]) {
      const row = rowByKey?.get?.(key)
      if (row > 0 && out.length < ZONE_SLOTS) out.push({ row, y0: z.y0, y1: z.y1, mode: MODE_CODE[z.mode], c: z.c, k: z.k })
    }
  }
  return out
}

// Sunset in Chicago on a Chicago date ('2026-10-05').
export function sunsetMs(date) {
  return SunCalc.getTimes(new Date(chicagoToUtc(date, 12)), ORIGIN.lat, ORIGIN.lon).sunset.getTime()
}

// When a game was over: the live report's final, else (a schedule or simulated game) its likely end once it has
// passed. null while it is still on (or not started).
export function finalAt(g, nowMs) {
  if (g.live?.state === 'in') return null
  if (g.live?.state === 'post') return g.live.at ?? gameWindow(g).end
  const end = gameWindow(g).end
  return nowMs >= end ? end : null
}

// The win-night window for `team` in game `g`: from the final (or sunset, whichever is later) until 2 a.m. the next
// Chicago morning. null unless the team won. A win only counts on the Chicago date the game started.
export function winWindow(g, team, nowMs) {
  if (isVoid(g) || g.results?.[team] !== 'W') return null
  const fin = finalAt(g, nowMs)
  if (fin == null) return null
  const date = chicagoDate(Date.parse(g.start))
  return { from: Math.max(fin, sunsetMs(date)), until: chicagoToUtc(addDays(date, 1), LIGHTS_UNTIL_HOUR), date }
}

// Every team whose win lights the city now: [{ team, simulated }] in TEAMS order. A simulated game counts only when the
// whole schedule is simulated (and is labelled so); a test override (?sports=win:<team>) lights that team.
export function winningTeams(games, nowMs, { source = 'LIVE', override = null } = {}) {
  if (override) {
    const t = override.mode === 'win' ? teamByKey(override.team ?? 'cubs') : null
    return t ? [{ team: t.key, simulated: true }] : []
  }
  const won = new Map()
  for (const g of games ?? []) {
    if (g.simulated && source !== 'SIMULATED') continue
    for (const team of g.teams ?? []) {
      const w = winWindow(g, team, nowMs)
      if (w && nowMs >= w.from && nowMs < w.until && !won.has(team)) won.set(team, { team, simulated: Boolean(g.simulated) })
    }
  }
  return TEAMS.filter((t) => won.has(t.key)).map((t) => won.get(t.key))
}

// The "Play a game" showcase's home win, while its final (the celebration) is on: that team, else null.
export function showcaseWinner(states) {
  for (const st of Object.values(states ?? {})) {
    if (st?.showcase && st.state === 'postgame' && st.game?.results?.[st.showcase.team] === 'W') return st.showcase.team
  }
  return null
}

// What the buildings show now → { team, why: 'preview' | 'showcase' | 'win', simulated } or null.
// A preview (asked for by name) shows even with the lights switched off; everything else respects the switch.
export function resolveLights({ on = true, preview = null, showcaseTeam = null, winners = [], nowMs }) {
  if (preview && nowMs < preview.until && TEAM_LIGHT[preview.team]) return { team: preview.team, why: 'preview', simulated: false }
  if (!on) return null
  if (showcaseTeam && TEAM_LIGHT[showcaseTeam]) return { team: showcaseTeam, why: 'showcase', simulated: false }
  if (!winners.length) return null
  const w = winners[Math.floor(nowMs / ROTATE_MS) % winners.length]
  return { team: w.team, why: 'win', simulated: w.simulated }
}

// The switch, remembered in this browser (storage can be blocked: then it is simply on).
export function loadLightsOn(storage = globalThis.localStorage) {
  try { return storage?.getItem(STORAGE_KEY) !== 'off' } catch { return true }
}
export function saveLightsOn(on, storage = globalThis.localStorage) {
  try { storage?.setItem(STORAGE_KEY, on ? 'on' : 'off') } catch { /* not remembered */ }
}

// "the Cubs" / "the White Sox" — for toasts and the Games panel
export const teamPhrase = (key) => `the ${teamByKey(key)?.name ?? 'team'}`
export function litNote(lit) {
  if (!lit) return null
  const t = teamByKey(lit.team)?.name ?? ''
  if (lit.why === 'preview') return `Previewing ${t} lights on the skyline`
  if (lit.why === 'showcase') return `The skyline is lit for the ${t} win`
  return `Tonight the skyline is lit for the ${t} win${lit.simulated ? ' (simulated schedule)' : ''}`
}
