// E4-1/E4-2: the 90-second "Play a game" showcase — phases, a score that only rises, the Cubs W, each sport's
// board words, and its place under the real schedule (a real game always wins).
import { describe, it, expect } from 'vitest'
import { showcaseState, scoringPlays, scoreAt, applyShowcase, fieldClock, SHOWCASE_S, PREGAME_S, PLAY_S, SHOWCASE_TEAMS, showcaseTitle } from '../showcase.js'
import { boardLines } from '../scoreboard.js'
import { marqueeMessage } from '../marquee.js'
import { flagKind } from '../winFlag.js'
import { celebration } from '../crowd.js'

const W = { key: 'wrigleyfield', name: 'Wrigley Field', teams: ['cubs'] }
const R = { key: 'ratefield', name: 'Rate Field', teams: ['whitesox'] }
const S = { key: 'soldierfield', name: 'Soldier Field', teams: ['bears', 'fire'] }
const T0 = Date.parse('2026-10-01T18:00:00Z')
const at = (v, team, s) => showcaseState(v, team, T0, T0 + s * 1000)

describe('showcaseState', () => {
  it('runs 10 s of pregame, 65 s of play, 15 s of final, and ends at 90 s', () => {
    expect([SHOWCASE_S, PREGAME_S, PLAY_S]).toEqual([90, 10, 65])
    expect(at(W, 'cubs', 0).state).toBe('pregame')
    expect(at(W, 'cubs', 9.99).state).toBe('pregame')
    expect(at(W, 'cubs', 10).state).toBe('live')
    expect(at(W, 'cubs', 74.99).state).toBe('live')
    expect(at(W, 'cubs', 75).state).toBe('postgame')
    expect(at(W, 'cubs', 89.99).state).toBe('postgame')
    expect(at(W, 'cubs', 90)).toBeNull()
    expect(at(W, 'cubs', -1)).toBeNull()
  })
  it('the score never goes down and the home team wins', () => {
    for (const [v, team] of [[W, 'cubs'], [R, 'whitesox'], [S, 'bears'], [S, 'fire']]) {
      let h = 0, a = 0
      for (let s = 10; s < 90; s += 0.5) {
        const g = at(v, team, s).game
        expect(g.home.score).toBeGreaterThanOrEqual(h); expect(g.away.score).toBeGreaterThanOrEqual(a)
        h = g.home.score; a = g.away.score
      }
      expect(h).toBeGreaterThan(a)
      const fin = at(v, team, 80).game
      expect(fin.home.winner).toBe(true); expect(fin.results[team]).toBe('W')
    }
  })
  it('5–8 scoring plays (soccer: 4 goals), spread over the game, the home team scoring last', () => {
    for (const sport of ['baseball', 'football']) { const p = scoringPlays(sport, 'x'); expect(p.length).toBeGreaterThanOrEqual(5); expect(p.length).toBeLessThanOrEqual(8) }
    expect(scoringPlays('soccer', 'x')).toHaveLength(4)
    const p = scoringPlays('football', 'seed')
    expect(p.at(-1).side).toBe('home')
    for (let i = 1; i < p.length; i++) expect(p[i].f).toBeGreaterThan(p[i - 1].f)
    expect(scoreAt(p, 1)).toEqual({ home: 24, away: 10 })
    expect(scoringPlays('football', 'seed')).toEqual(p) // deterministic
  })
  it('the Cubs final is a W day: the flag flies and the fans come on the field', () => {
    const st = at(W, 'cubs', 80)
    expect(st.winDay).toBe(true); expect(flagKind(st)).toBe('W'); expect(celebration('wrigleyfield', st).fans).toBeGreaterThan(0)
    expect(at(W, 'cubs', 40).winDay).toBe(false)
    expect(at(R, 'whitesox', 80).winDay).toBe(false)
  })
  it("each sport's board words run on the game's own clock", () => {
    const words = (v, team, s) => { const st = at(v, team, s); return boardLines(v, st, st.virtualNow).status }
    expect(words(W, 'cubs', 3)).toBe('FIRST PITCH SOON')
    expect(words(W, 'cubs', 10.5)).toBe('TOP 1ST')
    expect(words(W, 'cubs', 74)).toBe('BOT 9TH')
    expect(words(S, 'bears', 3)).toBe('KICKOFF SOON')
    expect(words(S, 'bears', 11)).toBe('Q1')
    expect(words(S, 'bears', 70)).toBe('Q4')
    expect(words(S, 'fire', 45)).toMatch(/^\d+'$/)
    expect(words(R, 'whitesox', 80)).toBe('FINAL')
    const rows = boardLines(W, at(W, 'cubs', 80), at(W, 'cubs', 80).virtualNow).rows
    expect(rows[1]).toEqual({ abbr: 'CHC', score: 5 }); expect(rows[0].score).toBe(2)
  })
  it('the Wrigley marquee ticks with the score and the inning', () => {
    const st = at(W, 'cubs', 40)
    const [a, b] = marqueeMessage(st, st.virtualNow)
    expect(a).toBe('GO CUBS GO')
    expect(b).toMatch(/^[A-Z]{2,3} \d+ · CHC \d+ · (TOP|BOT) \d+(ST|ND|RD|TH)$/)
  })
  it('names the buttons and commands', () => {
    expect(showcaseTitle('cubs')).toBe('Play a Cubs game')
    expect(showcaseTitle('fire')).toBe('Play a Fire match')
    expect(Object.keys(SHOWCASE_TEAMS)).toEqual(['wrigleyfield', 'ratefield', 'soldierfield'])
  })
  it('the players keep to the half-inning the board shows', () => {
    const sc = { startedAt: T0 }
    expect(Math.floor(fieldClock('baseball', sc, T0 + 10.5e3) / 720)).toBe(0)
    expect(Math.floor(fieldClock('baseball', sc, T0 + 74e3) / 720)).toBe(17)
  })
})

describe('applyShowcase (precedence)', () => {
  const venues = [W, R, S]
  const sc = { venueKey: 'wrigleyfield', team: 'cubs', startedAt: T0 }
  const idle = { state: 'idle', game: null, winDay: false, lossDay: false, next: { id: 'n' } }
  it('replaces an idle venue, keeping its next game; other venues untouched', () => {
    const states = { wrigleyfield: idle, ratefield: idle }
    const r = applyShowcase(states, venues, sc, T0 + 30e3)
    expect(r.stop).toBeNull()
    expect(r.states.wrigleyfield.state).toBe('live'); expect(r.states.wrigleyfield.game.showcase).toBe(true)
    expect(r.states.wrigleyfield.next).toEqual({ id: 'n' })
    expect(r.states.ratefield).toBe(idle)
    expect(states.wrigleyfield).toBe(idle) // never mutates the real states
  })
  it('runs over a real postgame hour', () => {
    expect(applyShowcase({ wrigleyfield: { ...idle, state: 'postgame' } }, venues, sc, T0 + 30e3).states.wrigleyfield.game.showcase).toBe(true)
  })
  it('a real live game wins and stops it; a real pregame stops it too', () => {
    const live = { ...idle, state: 'live', game: { id: 'real' } }
    const r = applyShowcase({ wrigleyfield: live }, venues, sc, T0 + 30e3)
    expect(r.stop).toBe('live'); expect(r.states.wrigleyfield).toBe(live)
    expect(applyShowcase({ wrigleyfield: { ...idle, state: 'pregame' } }, venues, sc, T0 + 30e3).stop).toBe('pregame')
  })
  it('expires at 90 s, leaving the real state', () => {
    const r = applyShowcase({ wrigleyfield: idle }, venues, sc, T0 + 90e3)
    expect(r.stop).toBe('expired'); expect(r.states.wrigleyfield).toBe(idle)
  })
  it('reports each new score since the last states', () => {
    let prev = {}, home = 0
    for (let s = 0; s < 90; s += 1) {
      const r = applyShowcase({ wrigleyfield: idle }, venues, sc, T0 + s * 1000, prev)
      for (const e of r.scored) if (e.side === 'home') home += e.delta
      prev = r.states
    }
    expect(home).toBe(5)
  })
})
