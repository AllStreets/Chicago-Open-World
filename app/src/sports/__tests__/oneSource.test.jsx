// E2-1 / E2-2: one /api/schedule payload feeds every place a game shows — the boards (Wrigley, Rate Field, both at
// Soldier Field, the United Center crown), the Wrigley marquee, the W flag, the venue card, the Games panel and ⌘K —
// and a game goes to the venue in the data, not to the team's home (Crosstown, the Fire, the Sky downtown).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { useSports } from '../sportsStore.js'
import { useStore } from '../../state/store.js'
import { applyProxySchedule } from '../SportsClock.jsx'
import { boardLines } from '../scoreboard.js'
import { marqueeMessage } from '../marquee.js'
import { flagKind } from '../winFlag.js'
import { gamePlaces } from '../palette.js'
import { ribbonText, crownStyle } from '../arenaCrown.js'
import VenueCard from '../../hud/VenueCard.jsx'
import GamesPanel from '../../hud/GamesPanel.jsx'

const NOW = Date.parse('2026-10-01T23:00:00Z') // 6 pm in Chicago
const iso = (ms) => new Date(ms).toISOString()
const side = (abbr, name, score = null, winner = null) => ({ abbr, name, score, winner })
const g = (o) => ({ results: {}, status: 'STATUS_SCHEDULED', state: 'pre', detail: '', chicagoHome: true, attendance: null, venueName: '', ...o })
const board = (n) => ({ center: [0, 20, 0], normal: [0, 1], w: 20, h: 8, style: n })
const VENUES = [
  { key: 'wrigleyfield', name: 'Wrigley Field', kind: 'baseball', slot: 1, teams: ['cubs'], center: [0, 0], radius: 100, boards: [board('manual')], flagPole: [0, 30, 0], marquee: {} },
  { key: 'ratefield', name: 'Rate Field', kind: 'baseball', slot: 2, teams: ['whitesox'], center: [0, 0], radius: 100, boards: [board('video')] },
  { key: 'soldierfield', name: 'Soldier Field', kind: 'football', slot: 0, teams: ['bears', 'fire'], center: [0, 0], radius: 100, boards: [board('video'), board('video')] },
  { key: 'unitedcenter', name: 'United Center', kind: 'arena', slot: 3, teams: ['bulls', 'blackhawks'], center: [0, 0], radius: 100, boards: [], crown: { center: [0, 0], roofY: 39, mast: 5, face: { w: 20, h: 10 }, faceY: 49 } },
  { key: 'wintrust', name: 'Wintrust Arena', kind: 'arena', slot: 4, teams: ['sky'], center: [0, 0], radius: 100, boards: [] },
]
const payload = (games) => ({ version: 1, source: 'espn-proxy', generatedAt: iso(NOW - 60000), partial: [], games })

describe('one source for every board, card and list (E2-1)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(NOW))
    useStore.setState(useStore.getInitialState()); useSports.setState(useSports.getInitialState())
    useSports.setState({ venues: VENUES })
    applyProxySchedule(payload([
      g({ id: 'cubs', teams: ['cubs'], sport: 'baseball', league: 'mlb', start: iso(NOW - 2 * 3600e3), venue: 'wrigleyfield', state: 'post', status: 'STATUS_FINAL', results: { cubs: 'W' }, home: side('CHC', 'Chicago Cubs', 6, true), away: side('PIT', 'Pittsburgh Pirates', 2, false) }),
      g({ id: 'sox', teams: ['whitesox'], sport: 'baseball', league: 'mlb', start: iso(NOW - 3600e3), venue: 'ratefield', state: 'in', status: 'STATUS_IN_PROGRESS', detail: 'Bot 5th', home: side('CHW', 'Chicago White Sox', 3), away: side('DET', 'Detroit Tigers', 1) }),
      g({ id: 'bears', teams: ['bears'], sport: 'football', league: 'nfl', start: iso(NOW + 86400e3), venue: 'soldierfield', home: side('CHI', 'Chicago Bears'), away: side('GB', 'Green Bay Packers') }),
      g({ id: 'bulls', teams: ['bulls'], sport: 'basketball', league: 'nba', start: iso(NOW + 2 * 86400e3), venue: 'unitedcenter', home: side('CHI', 'Chicago Bulls'), away: side('MIL', 'Milwaukee Bucks') }),
    ]), NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('the boards, the crown, the marquee and the W flag all say the same games', () => {
    const { states } = useSports.getState(), V = (k) => VENUES.find((v) => v.key === k)
    const w = boardLines(V('wrigleyfield'), states.wrigleyfield, NOW)
    expect(w).toMatchObject({ rows: [{ abbr: 'PIT', score: 2 }, { abbr: 'CHC', score: 6 }], status: 'FINAL' })
    expect(marqueeMessage(states.wrigleyfield, NOW)).toEqual(['FINAL', 'PIT @ CHC 2-6'])
    expect(flagKind(states.wrigleyfield)).toBe('W')
    expect(boardLines(V('ratefield'), states.ratefield, NOW)).toMatchObject({ rows: [{ abbr: 'DET', score: 1 }, { abbr: 'CHW', score: 3 }], status: 'BOT 5TH' })
    const sf = V('soldierfield')
    for (const _ of sf.boards) expect(boardLines(sf, states.soldierfield, NOW).status).toBe('NEXT GB · TOMORROW 6:00 PM')
    const uc = boardLines(V('unitedcenter'), states.unitedcenter, NOW)
    expect(uc.status).toMatch(/^NEXT MIL · /)
    expect(ribbonText(uc, crownStyle(states.unitedcenter))).toMatch(/^NEXT MIL · .*GO BULLS/)
  })
  it('the venue card, the Games panel and ⌘K agree', () => {
    useSports.setState({ cardVenue: 'ratefield' })
    useStore.setState({ gamesOpen: true })
    render(<><VenueCard /><GamesPanel /></>)
    const card = screen.getByRole('dialog', { name: 'Rate Field' })
    expect(card).toHaveTextContent('BOT 5TH'); expect(card).toHaveTextContent('LIVE')
    const panel = screen.getByRole('dialog', { name: 'Games' })
    expect(panel).toHaveTextContent('DET @ CHW'); expect(panel).toHaveTextContent('PIT @ CHC'); expect(panel).toHaveTextContent('GB @ CHI')
    const p = gamePlaces({ venues: VENUES, states: useSports.getState().states, nowMs: NOW })
    expect(p[0].sub).toContain('DET @ CHW · Rate Field · LIVE')
    expect(p.find((x) => x.id === 'g:soldierfield').sub).toBe('NEXT TOMORROW 6:00 PM')
    expect(p.find((x) => x.id === 'g:wrigleyfield').sub).toBe('FINAL')
  })
  it('no component reads schedules.json itself — only the store loads it', () => {
    const src = join(process.cwd().endsWith('app') ? process.cwd() : join(process.cwd(), 'app'), 'src')
    const hits = []
    const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== '__tests__') walk(p) } else if (/\.(js|jsx)$/.test(f) && readFileSync(p, 'utf8').includes('schedules.json')) hits.push(p.slice(src.length + 1)) } }
    walk(src)
    expect(hits).toEqual(['sports/sportsStore.js'])
  })
})

describe('crosstown and shared venues go where the data says (E2-2)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(NOW))
    useStore.setState(useStore.getInitialState()); useSports.setState(useSports.getInitialState())
    useSports.setState({ venues: VENUES })
  })
  afterEach(() => vi.useRealTimers())
  it('a White Sox game at Wrigley, a Fire match at Soldier Field, a Sky game at the United Center', () => {
    applyProxySchedule(payload([
      g({ id: 'xt', teams: ['whitesox', 'cubs'], sport: 'baseball', league: 'mlb', start: iso(NOW - 3600e3), venue: 'wrigleyfield', state: 'in', detail: 'Top 4th', home: side('CHC', 'Chicago Cubs', 1), away: side('CHW', 'Chicago White Sox', 2) }),
      g({ id: 'fire', teams: ['fire'], sport: 'soccer', league: 'usa.1', start: iso(NOW - 1800e3), venue: 'soldierfield', state: 'in', detail: "30'", home: side('CHI', 'Chicago Fire FC', 1), away: side('CLB', 'Columbus Crew', 0) }),
      g({ id: 'sky', teams: ['sky'], sport: 'basketball', league: 'wnba', start: iso(NOW - 1800e3), venue: 'unitedcenter', state: 'in', detail: 'Q2', home: side('CHI', 'Chicago Sky', 40), away: side('IND', 'Indiana Fever', 38) }),
    ]), NOW)
    const { states } = useSports.getState()
    expect(states.wrigleyfield).toMatchObject({ state: 'live', game: { id: 'xt' } })
    expect(states.ratefield.state).toBe('idle') // not the White Sox's home tonight
    expect(states.soldierfield).toMatchObject({ state: 'live', game: { id: 'fire' } })
    expect(states.unitedcenter).toMatchObject({ state: 'live', game: { id: 'sky' } })
    expect(states.wintrust.state).toBe('idle') // not the Sky's home tonight
    expect(crownStyle(states.unitedcenter)).toBe('bulls') // the Sky downtown wears the Bulls board (decided)
  })
})
