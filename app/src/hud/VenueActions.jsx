// app/src/hud/VenueActions.jsx — the sports part of a ballpark's or arena's card (E3-3, E4-3, E5-1): one line on what
// the place does when a real game is on, the United Center's roof board, and at the three open-air ballparks a
// "▶ Play a Cubs game" ↔ "■ Stop the game" pill. A real live game hides the pill ("Live now — this is the real game");
// a real pregame disables it with when to watch. A separate child so every card mounts it with one line.
import './Sports.css'
import { RiPlayFill, RiStopFill } from 'react-icons/ri'
import { useSports } from '../sports/sportsStore.js'
import { SHOWCASE_TEAMS, isShowcaseVenue, showcaseTitle } from '../sports/showcase.js'
import { showcaseGate, pregameNote, playShowcase, stopShowcase } from '../sports/showcaseActions.js'
import { teamByKey } from '../../../shared/teams.js'

export const EXPLAIN_OPEN = 'When a real game is on, this stadium comes alive by itself — the crowd, the lights, the players and the live score on the board.'
export const EXPLAIN_PLAY = 'Press ▶ Play a game to see a 90-second preview any time.'
export const EXPLAIN_ARENA = 'When a real game is on, this arena comes alive by itself — the lights, the crowd on the plaza and the live score'
const lum = (hex) => { const n = parseInt(String(hex).slice(1), 16); return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) }
const brightest = (colors) => (colors?.length ? [...colors].sort((a, b) => lum(b) - lum(a))[0] : null)
const names = (keys) => { const n = keys.map((k) => teamByKey(k)?.name ?? k); return n.length > 1 ? `${n.slice(0, -1).join(', ')} and ${n.at(-1)}` : n[0] ?? '' }

export default function VenueActions({ venueKey }) {
  const venue = useSports((s) => s.venues.find((v) => v.key === venueKey))
  const st = useSports((s) => s.states[venueKey])
  const running = useSports((s) => s.showcase?.venueKey === venueKey)
  if (!venue) return null
  const open = isShowcaseVenue(venueKey), team = SHOWCASE_TEAMS[venueKey]?.[0], gate = showcaseGate(st)
  const color = brightest(teamByKey(team)?.colors) // Cubs red, Bears orange, Sox silver: the colour that reads on the dark card
  return (
    <div className="venue-actions">
      {venue.crown && <p className="va-crown"><span className="va-bulls" aria-hidden="true" />{names(venue.teams)} — the board on the roof shows the next game, live scores and finals <span className="va-note">(a guide display, not a real fixture)</span></p>}
      <p className="va-explain">{open ? (gate === 'live' && !running ? EXPLAIN_OPEN : `${EXPLAIN_OPEN} ${EXPLAIN_PLAY}`) : `${EXPLAIN_ARENA}${venue.crown ? ' on the roof board' : ''}.`}</p>
      {open && (running ? (
        <button type="button" className="hud-pill active va-play" aria-pressed="true" onClick={stopShowcase}><RiStopFill aria-hidden="true" /> Stop the game</button>
      ) : gate === 'live' ? (
        <p className="va-live"><i className="va-dot" aria-hidden="true" /> Live now — this is the real game</p>
      ) : (
        <>
          <button type="button" className="hud-pill va-play" aria-pressed="false" disabled={gate === 'pregame'} style={color ? { '--team': color } : undefined} onClick={() => playShowcase(venueKey, team)}>
            <RiPlayFill aria-hidden="true" /> {showcaseTitle(team)}
          </button>
          {gate === 'pregame' && <p className="va-wait">{pregameNote(st)}</p>}
        </>
      ))}
    </div>
  )
}
