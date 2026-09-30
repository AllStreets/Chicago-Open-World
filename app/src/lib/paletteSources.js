// app/src/lib/paletteSources.js — every feature's ⌘K entries in one place (G3). V3/V4 transit and V5 games feed in here;
// V6 landmarks arrive through manifest.landmarks (kind 'landmark').
import { useStore } from '../state/store.js'
import { POI_CATEGORIES } from '../data/poiCategories.js'
import { TOURS, startTour } from './tourPoses.js'
import { transitPlaces } from '../transit/palette.js'
import { gamePlaces } from '../sports/palette.js'
import { useSports } from '../sports/sportsStore.js'
import { FEATURE_CONTROLS } from '../hud/featureControls.js'

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
