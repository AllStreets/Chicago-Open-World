// app/src/lib/paletteSources.js — every feature's ⌘K entries in one place (G3). V3/V4 transit and V5 games feed in here;
// V6 landmarks arrive through manifest.landmarks (kind 'landmark').
import { useStore } from '../state/store.js'
import { POI_CATEGORIES } from '../data/poiCategories.js'
import { TOURS, startTour } from './tourPoses.js'
import { parseGridAddress } from './grid.js'
import { transitPlaces } from '../transit/palette.js'
import { gamePlaces } from '../sports/palette.js'
import { useSports } from '../sports/sportsStore.js'
import { FEATURE_CONTROLS } from '../hud/featureControls.js'
import { retryLive } from '../services/feeds.js'
import { WEATHER_MODES, WEATHER_NAMES } from '../weather/weatherState.js'
import { allRides, ridesJsonNow } from '../ride/rideCatalog.js'
import { getSim } from '../transit/simStore.js'
import { startRide } from '../ride/rideActions.js'

export function featurePlaces(state) {
  const sp = useSports.getState()
  return [
    // lines (Show / Follow) before the 70 stations, so a short list shows the useful ones
    ...transitPlaces(state).map((p) => ({ ...p, kind: 'transit' })).sort((a, b) => (a.id.startsWith('st:') ? 1 : 0) - (b.id.startsWith('st:') ? 1 : 0)),
    ...gamePlaces({ venues: sp.venues, states: sp.states, nowMs: Date.now() }).map((p) => ({ ...p, kind: 'game' })),
  ]
}

export function featureCommands() {
  return FEATURE_CONTROLS.map((c) => ({ id: `f:${c.id}`, kind: 'command', name: c.commandName ?? `${c.label}: on / off`, sub: `${c.keyLabel} · ${c.help}`, aliases: [c.label], run: () => { if (c.available()) c.toggle() } }))
}

// The guide's lenses (P4): a command always opens its lens (the rail toggles); "Close lens" closes whichever is open.
const LENS_NAMES = [['VISIT', 'Visit', 'landmarks, places and guided tours'], ['LIVE', 'Live', 'neighborhoods: character, rents and how they feel'], ['WORK', 'Work', 'set an office and see how far the L gets you']]
export function lensCommands() {
  const s = () => useStore.getState()
  return [
    ...LENS_NAMES.map(([id, name, sub]) => ({ id: `lens:${id}`, kind: 'guide', name: `Lens: ${name}`, sub, aliases: [name, `${name} lens`], run: () => { if (s().lens !== id) s().setLens(id) } })),
    { id: 'lens:close', kind: 'guide', name: 'Close lens', sub: 'Esc', aliases: ['close guide'], run: () => { if (s().lens) s().setLens(s().lens) } },
  ]
}

// Places (P4): the pins on or off, or just one category
export function placeCommands() {
  const s = () => useStore.getState()
  return [
    { id: 'places:show', kind: 'guide', name: 'Show places', sub: 'P · restaurants, bars, venues and more', aliases: ['places', 'pins'], run: () => s().setPlacesOn(true) },
    { id: 'places:hide', kind: 'guide', name: 'Hide places', sub: 'P', aliases: ['places off'], run: () => s().setPlacesOn(false) },
    ...POI_CATEGORIES.map((c) => ({ id: `places:only:${c.id}`, kind: 'guide', name: `Show only: ${c.label}`, sub: 'Places', aliases: [c.label, c.id], run: () => { s().setPoiCats([c.id]); s().setPlacesOn(true) } })),
  ]
}

// Tours (P4): each of the three guided tours, from ⌘K
export function tourCommands() {
  return TOURS.map((t) => ({ id: `tour:${t.id}`, kind: 'guide', name: `Tour: ${t.name}`, sub: `${t.stops.length} stops · Space pauses, , and . step, Esc exits`, aliases: ['tour', t.name], run: () => startTour(t.id, useStore) }))
}

// Typed addresses (P4 WORK): "333 N Green" → set it as the office (and open WORK), or fly there
export function addressRows(query) {
  const a = parseGridAddress(query)
  if (!a) return []
  const s = () => useStore.getState()
  const pose = { position: [a.x + 260, 220, a.z + 320], target: [a.x, 20, a.z] }
  return [
    { id: `addr:office:${a.label}`, kind: 'guide', name: `Set office at ${a.label}`, sub: 'Work lens · commute estimate', run: () => { s().setOffice(a); if (s().lens !== 'WORK') s().setLens('WORK'); s().startFlight(pose, a.label) } },
    { id: `addr:fly:${a.label}`, kind: 'guide', name: `Fly to ${a.label}`, sub: 'Address', run: () => s().startFlight(pose, a.label) },
  ]
}

// Your office in ⌘K: "work" / "office" finds it (and opens the Work lens); a landmark or place result can become it
export function officeRows(query, top) {
  const s = () => useStore.getState(), office = s().office, rows = []
  if (office && /\b(work|office)\b/i.test(query)) rows.push({ id: 'office:go', kind: 'guide', name: `Work: ${office.label}`, sub: 'Your office · commute estimates', run: () => { if (s().lens !== 'WORK') s().setLens('WORK'); s().startFlight({ position: [office.x + 260, 220, office.z + 320], target: [office.x, 20, office.z] }, office.label) } })
  const t = top?.pose?.target, x = top?.x ?? t?.[0], z = top?.z ?? t?.[2]
  if (top && ['landmark', 'place'].includes(top.kind) && Number.isFinite(x) && Number.isFinite(z) && top.name !== office?.label)
    rows.push({ id: `office:set:${top.id ?? top.name}`, kind: 'guide', name: `Set ${top.name} as my office`, sub: 'Work lens · commute estimates', run: () => { s().setOffice({ x, z, label: top.name }); if (s().lens !== 'WORK') s().setLens('WORK') } })
  return rows
}

// Live data (P5): the chip's two actions, from ⌘K
export function liveCommands() {
  const s = () => useStore.getState()
  return [
    { id: 'data:retry', kind: 'command', name: 'Data: try live again', sub: 'Live CTA trains, weather and scores from CHI ATLAS', aliases: ['live', 'reconnect'], run: () => { if (!retryLive()) s().showToast('The live service is not connected to this copy of the map — everything runs on simulations') } },
    { id: 'data:sources', kind: 'command', name: 'Data: show sources', sub: 'What is live and what is simulated', aliases: ['data sources', 'simulated', 'live data'], run: () => s().setSourcesOpen(true) },
    ...WEATHER_MODES.map((m) => ({ id: `weather:${m}`, kind: 'command', name: `Weather: ${WEATHER_NAMES[m]}`, sub: m === 'LIVE' ? 'Follow the real Chicago sky (clear when the live feed is off)' : 'Weather button · holds until you choose Live', aliases: ['weather', WEATHER_NAMES[m].toLowerCase()], run: () => s().setWeatherMode(m) })),
  ]
}

// Ride the city (P7): every ride by name — "Ride: Brown Line …", "Bus: #146 …", "Walk: The Riverwalk", "Glide over the city"
const RIDE_PREFIX = { L: 'Ride', bus: 'Bus', walk: 'Walk' }
export function rideCommands() {
  const rides = allRides(getSim(), useStore.getState().transit, ridesJsonNow())
  return rides.map((r) => ({
    id: `ride:${r.id}`, kind: 'guide', name: r.kind === 'glide' ? r.name : `${RIDE_PREFIX[r.kind]}: ${r.name}`,
    sub: r.kind === 'L' ? 'Ride the L · front window, alongside or behind' : r.kind === 'bus' ? 'Ride a CTA bus' : r.kind === 'walk' ? 'Street-level walk' : 'Hang-glide · ↑ dive ↓ climb',
    aliases: ['ride', r.kind === 'walk' ? 'walk' : r.kind === 'bus' ? 'bus' : r.kind === 'glide' ? 'glide' : 'train'], run: () => startRide(r.id),
  }))
}
