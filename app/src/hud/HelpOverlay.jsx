// app/src/hud/HelpOverlay.jsx — every control in plain words (opens on "?" and on a first visit).
// F-3 (2026-10-01): a key named inside a sentence is a keycap too ({Space}, {,}, {⌘K} … drawn by withKeys).
// Team lights pass (2026-10-05): a wide sheet whose sections flow through as many columns as the screen holds (rows,
// not sections, are the unit that never splits, so the columns end level — no dead space). It renders on <body>, so the
// HUD's shrink-to-fit zoom never makes it a postage stamp on a phone; there it is a full-height scrolling sheet.
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../state/store.js'
import { FEATURE_CONTROLS, DOCK_FEATURES } from './featureControls.js'
import { Kbd, withKeys } from './Keycap.jsx'

// X-3: only a control with a button on screen is called "… button" (the dock's six, Ride the city, the SCAN pill);
// Sound, Traffic, Play and Lower are a key and a ⌘K command, so the card says what to type instead of a dead button
export const BUTTONED = new Set([...DOCK_FEATURES.map((c) => c.id), 'ride', 'scan'])
const paletteWord = (c) => (c.commandName ? c.commandName.split(/:| at /)[0].trim() : c.label)
export const controlLine = (c) => (BUTTONED.has(c.id) ? `${c.label} button — ${c.help}` : `${c.help} · or {⌘K} “${paletteWord(c)}”`)

// Move · Look · Search · City life (every feature, from the registry) · Rides and tours · Games · Guide · Live city · Time
export const GROUPS = [
  ['Move around', [['↑ ↓ ← →', 'or {W} {A} {S} {D} — glide over the city'], ['Shift', 'with {W} {A} {S} {D} to go faster'], ['R / F', 'or {Page Up} and {Page Down} — rise and descend'], ['Scroll', 'or {+} and {−} — zoom in and out']]],
  ['Look around', [['Drag', 'with the mouse to turn and tilt'], ['Shift+arrows', 'or {Q} and {E} — turn and tilt'], ['N', 'face north'], ['O', 'slowly orbit where you are']]],
  ['Search and fly', [['⌘K', 'or {/} — find any landmark by name or nickname (the Bean, the pagoda, the lighthouse), a neighborhood or a view'], ['Double-click', 'anywhere to fly there'], ['[ ]', 'previous or next view'], ['H', 'back home'], ['Minimap', 'click to fly']]],
  ['City life', [
    ...FEATURE_CONTROLS.map((c) => [c.keyLabel, controlLine(c)]),
    ['Legend', 'click a transit line to hide or show it; All or None'],
    ['Click', 'a train, a station or a ballpark for its card'],
    ['⌘K', '“Follow a train” rides along — {Esc} or a move key stops, {K} changes the view, and {M}, {X} and the other toggles keep following · “Go to Clark/Lake” · type “tonight” for tonight’s game'],
  ]],
  ['Rides and tours', [
    ['Rides', 'in a ride {Space} pauses, {.} {,} next or previous stop, {>} {<} faster or slower, {Drag} looks around, {Esc} gets off · {⌘K} “Drive Lower Wacker” drives under the street, and “Riverwalk (river level)” walks the Riverwalk down at the water'],
    ['K', 'change the view — in a ride, or while following a train'],
    ['Tours', 'in the Visit lens or {⌘K} “Tour:” — {Space} pauses, {,} and {.} step, any arrow key takes back the camera'],
  ]],
  // E5-2: what the ballparks do by themselves, and how to see it any time
  ['Games', [['Live', 'when a real game is on at Wrigley, Rate Field, Soldier Field, the United Center or Wintrust, the place comes alive by itself — the crowd, the lights, the players and the live score on the board (the United Center’s is on its roof)'],
    ['Y', 'Play a game — a 90-second preview at Wrigley, Rate Field or Soldier Field (also the ▶ button on the ballpark’s card, or {⌘K} “Play a Cubs game”); {Y} again or {Esc} stops it, and a real live game always wins'],
    ['Win night', 'the skyline lights up in the winner’s two colours until 2 a.m., like the real one; {I} turns Team lights off or on, and {⌘K} “Preview Bears lights” (or Cubs, White Sox, Bulls, Blackhawks, Sky, Fire) shows them for a minute'],
    ['Data', 'schedules and scores come from ESPN and refresh on the live site by themselves; live CTA trains stay simulated for now']]],
  ['Guide', [['Lenses', 'the lens rail at the top — Visit, Live, Work (also {⌘K} “Lens: Visit”)'], ['Hover', 'hover a building for its name and year; click it for its card'], ['P', 'places — pins for food, bars, venues and more; click one for its hours and website'],
    ['Work', 'set office (click the map) or type an address in {⌘K}, like “333 N Green”, to see commute times'], ['Esc', 'close the card, then the lens']]],
  ['Live city', [['Chip', 'top left — LIVE CTA when real trains are shown, SIMULATED when they run on typical schedules; click it for the data sources'], ['V', 'or the SCAN button — holographic Scan: the city turns to dark glass with cyan lines; in the Live lens, light columns show transit, nightlife, green space or rent'], ['Weather', 'button (top right) — follows Chicago live, or choose clear, overcast, rain, snow or lake fog (also {⌘K} “Weather”)']]],
  ['Time and quality', [['1 – 7', 'live Chicago time, dawn, day, dusk, night, a sunny summer day, a snowy Christmas (snow falling, the lake frozen)'], ['Quality', 'button on the right if things feel slow · Low also turns off water reflections'], ['Stats', '{⌘K} “performance” shows draw calls and frame rate']]],
]

export default function HelpOverlay() {
  const open = useStore((s) => s.helpOpen)
  const ready = useStore((s) => s.load.ready)
  useEffect(() => {
    if (!ready) return
    let seen = true
    try { seen = localStorage.getItem('chi-ow-help-seen') === '1' } catch {}
    if (!seen) useStore.getState().setHelpOpen(true)
  }, [ready])
  if (!open) return null
  const close = () => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} useStore.getState().setHelpOpen(false) }
  return createPortal(
    <div className="cmdk-backdrop help-backdrop" onMouseDown={close}>
      <div className="cmdk hud-panel help" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Controls">
        <div className="help-head">
          <div className="help-titles"><span className="hud-label">Atlas <span className="slash">/</span> Controls</span><span className="hud-title">How to fly Chicago</span></div>
          <span className="help-tip">Press <Kbd k="?" className="inline" /> any time to open this again</span>
          <button type="button" className="hud-pill active help-ok" onClick={close}>Got it</button>
        </div>
        <div className="help-grid">
          {GROUPS.map(([title, rows]) => (
            <section key={title} className="help-sec">
              <h3 className="hud-label">{title}</h3>
              {rows.map(([k, v]) => <p key={k}><Kbd k={k} /> <span>{withKeys(v)}</span></p>)}
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
