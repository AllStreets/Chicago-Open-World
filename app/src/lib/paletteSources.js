// app/src/lib/paletteSources.js — every feature's ⌘K entries in one place (G3). V3/V4 transit and V5 games feed in here;
// V6 landmarks arrive through manifest.landmarks (kind 'landmark').
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
