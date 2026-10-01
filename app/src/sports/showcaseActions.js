// app/src/sports/showcaseActions.js — starting and stopping "Play a game" from a person's side (the card button, Y,
// ⌘K): the real game always wins, one showcase at a time, a flight to the ballpark when it is out of view — but never
// while following a train, touring or riding (the camera stays theirs; a toast says where the game is instead).
import { useStore } from '../state/store.js'
import { useSoundStore } from '../audio/soundStore.js'
import { useSports } from './sportsStore.js'
import { SHOWCASE_TEAMS, SHOWCASE_VENUES, isShowcaseVenue, showcaseTitle } from './showcase.js'
import { clearedVenuePose } from '../lib/poseClearance.js'
import { whenChicago } from './chicagoTime.js'
import { LANDMARKS } from '../data/landmarks.js'

const FLY_BEYOND_M = 600 // a ballpark further than this from what you're looking at is out of view: fly there

// What the venue's REAL state allows: 'live' (the real game is on — no showcase), 'pregame' (gates open — wait for
// it), else 'ok'. A showcase's own state is not a real game.
export function showcaseGate(st) {
  if (!st || st.game?.showcase) return 'ok'
  if (st.state === 'live') return 'live'
  if (st.state === 'pregame') return 'pregame'
  return 'ok'
}
// "Tonight's game starts at 7:05 PM — watch it live then"
export function pregameNote(st, nowMs = Date.now()) {
  const when = st?.game ? whenChicago(Date.parse(st.game.start), nowMs) : ''
  const [day, ...time] = when.split(' ')
  return /^(Tonight|Today)$/.test(day) ? `${day}’s game starts at ${time.join(' ')} — watch it live then` : `The game starts ${when} — watch it live then`
}

// The ballpark a card shows: the Games card (VenueCard) or a clicked stadium (its hero key, or a landmark's heroKey).
export function venueKeyForSelection(sel) {
  if (!sel || sel.kind !== 'landmark') return null
  if (isShowcaseVenue(sel.id) || useSports.getState().venues.some((v) => v.key === sel.id)) return sel.id
  return LANDMARKS.find((l) => l.id === sel.id)?.heroKey ?? null
}

export function playShowcase(venueKey, team = SHOWCASE_TEAMS[venueKey]?.[0]) {
  const sp = useSports.getState(), s = useStore.getState()
  if (!isShowcaseVenue(venueKey) || !SHOWCASE_TEAMS[venueKey].includes(team)) return false
  const st = sp.states[venueKey], gate = showcaseGate(st)
  const venue = sp.venues.find((v) => v.key === venueKey), name = venue?.name ?? 'the ballpark'
  if (gate === 'live') { s.showToast(`A real game is on at ${name} — this is it, live`); return false }
  if (gate === 'pregame') { s.showToast(pregameNote(st)); return false }
  sp.startShowcase(venueKey, team) // replaces any showcase running elsewhere
  const sound = useSoundStore.getState().soundOn
  if (s.follow || s.tour || s.ride) {
    s.showToast(`${showcaseTitle(team).replace(/^Play/, 'Playing')} at ${name} — press Y to stop${sound ? '' : ' · M turns the sound on'}`)
    return true
  }
  const r = s.readout
  if (venue && !(Number.isFinite(r?.x) && Math.hypot(r.x - venue.center[0], r.z - venue.center[1]) < FLY_BEYOND_M)) {
    s.startFlight(clearedVenuePose(venue), venue.name)
    if (!sp.cardVenue && !venueKeyForSelection(s.selection)) sp.openCard(venueKey) // the Stop button, in view
  }
  if (!sound) s.showToast('Sound is off — press M to hear the crowd')
  return true
}

export const stopShowcase = () => useSports.getState().stopShowcase()

// Y: stop the game that's on; else play at the ballpark whose card is open, else the one nearest to where you look.
export function toggleShowcase() {
  const sp = useSports.getState()
  if (sp.showcase) { sp.stopShowcase(); return }
  const fromCard = [sp.cardVenue, venueKeyForSelection(useStore.getState().selection)].find(isShowcaseVenue)
  if (fromCard) { playShowcase(fromCard); return }
  const r = useStore.getState().readout
  const near = SHOWCASE_VENUES.map((k) => sp.venues.find((v) => v.key === k)).filter(Boolean)
    .sort((a, b) => Math.hypot(r.x - a.center[0], r.z - a.center[1]) - Math.hypot(r.x - b.center[0], r.z - b.center[1]))[0]
  playShowcase(Number.isFinite(r?.x) && near ? near.key : 'wrigleyfield')
}
