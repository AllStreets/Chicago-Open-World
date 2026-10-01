// app/src/sports/palette.js — the Games group in ⌘K (V7 contract: gamePlaces).
import { useStore } from '../state/store.js'
import { useSports } from './sportsStore.js'
import { teamByKey } from '../../../shared/teams.js'
import { clearedVenuePose } from '../lib/poseClearance.js'
import { tonightsGame, stateLabel, gameLabel } from './tonight.js'
import { whenChicago } from './chicagoTime.js'
import { SHOWCASE_TEAMS, showcaseTitle } from './showcase.js'
import { playShowcase, stopShowcase } from './showcaseActions.js'

export function goToVenue(venue) {
  useStore.getState().startFlight(clearedVenuePose(venue), venue.name)
  useSports.getState().openCard(venue.key)
}
const openPanel = () => useStore.getState().setGamesOpen(true)

export function gamePlaces({ venues, states, nowMs }) {
  const t = tonightsGame(venues, states, nowMs)
  const sub = t ? `${gameLabel(t.game)} · ${t.venue.name} · ${t.state === 'live' ? 'LIVE' : whenChicago(Date.parse(t.game.start), nowMs)}` : 'No game scheduled — opens the games list'
  return [
    { id: 'g:tonight', kind: 'game', name: t?.state === 'upcoming' ? 'Go to the next game' : "Go to tonight's game", aliases: ['tonight', 'game', 'games', 'score', 'scores'], sub, run: () => (t ? goToVenue(t.venue) : openPanel()) },
    { id: 'g:panel', kind: 'game', name: 'Show games & scores', aliases: ['games', 'scores', 'schedule'], sub: 'Games', run: openPanel },
    ...venues.map((v) => ({ id: `g:${v.key}`, kind: 'game', name: `Games at ${v.name}`, aliases: v.teams.map((k) => teamByKey(k)?.name ?? k), sub: stateLabel(states[v.key], nowMs), run: () => goToVenue(v) })),
    ...showcasePlaces(),
  ]
}

// E4-4: "Play a Cubs game at Wrigley Field" … "Play a Fire match at Soldier Field", and "Stop the game"
const PARK_NAMES = { wrigleyfield: 'Wrigley Field', ratefield: 'Rate Field', soldierfield: 'Soldier Field' }
export function showcasePlaces() {
  const rows = Object.entries(SHOWCASE_TEAMS).flatMap(([key, teams]) => teams.map((team) => ({
    id: `g:play:${key}:${team}`, kind: 'game', name: `${showcaseTitle(team)} at ${PARK_NAMES[key]}`,
    aliases: ['play a game', 'showcase', 'preview game', `${teamByKey(team)?.name} game`], sub: 'Y · a 90-second game — a real live game always wins', run: () => playShowcase(key, team),
  })))
  return [...rows, { id: 'g:play:stop', kind: 'game', name: 'Stop the game', aliases: ['stop game', 'end the game'], sub: 'Y or Esc · back to the real ballpark', run: stopShowcase }]
}
