// pipeline/fetch/fetch-schedules.js — ESPN public schedules → pipeline/data/schedules.json + app/public/world/schedules.json.
// Run: npm run schedules. Keeps the previous file when nothing could be fetched.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEAMS } from '../../shared/teams.js'
import { fetchAllSchedules, scheduleUrls } from '../lib/schedules.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'data', 'schedules.json')
const PUB = join(ROOT, '..', 'app', 'public', 'world', 'schedules.json')

const { games, failures } = await fetchAllSchedules(fetch, { log: console.log })
for (const f of failures) console.warn(`  ! ${f.team} ${f.url}: ${f.error}`)
if (!games.length) { console.warn('no games fetched — keeping the previous schedules.json'); process.exit(0) }
const doc = { version: 1, generatedAt: new Date().toISOString(), source: 'espn', urls: TEAMS.flatMap(scheduleUrls), games }
writeFileSync(DATA, JSON.stringify(doc))
mkdirSync(dirname(PUB), { recursive: true })
writeFileSync(PUB, JSON.stringify(doc))
console.log(`schedules: ${games.length} games, ${games.filter((g) => g.venue).length} at our venues, ${failures.length} failed requests`)
