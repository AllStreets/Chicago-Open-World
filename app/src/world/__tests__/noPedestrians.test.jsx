// app/src/world/__tests__/noPedestrians.test.jsx — no people walk the streets and plazas (user, 2026-09-30: stick
// figures read as unfinished); people stay only in the stadium stands (sports/Crowd's seat crowd).
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const APP = existsSync(join(process.cwd(), 'src')) ? process.cwd() : join(process.cwd(), 'app') // run from app/ or the repo root
const src = (p) => join(APP, 'src', p)
describe('no pedestrians', () => {
  it('Landmarks mounts no plaza people and the plaza-people modules are gone', () => {
    expect(readFileSync(src('world/Landmarks.jsx'), 'utf8')).not.toMatch(/PlazaPeople/)
    expect(existsSync(src('landmarks/PlazaPeople.jsx'))).toBe(false)
  })
  it('no fans stand on the plazas outside the stadiums; the stands keep their crowd', () => {
    const life = readFileSync(src('sports/SportsLife.jsx'), 'utf8')
    expect(life).not.toMatch(/PlazaCrowd/)
    expect(life).toMatch(/<SeatCrowd/)
  })
})
