// app/e2e/chi-mock.mjs — a stand-in for the CHI ATLAS API (P5 live smoke runs; the real backend needs secrets).
// node e2e/chi-mock.mjs [port=3901]. Trains are V4's own simulated CTA trains, reported the way CTA Train Tracker
// reports them (lat/lon, compass heading, CTA route code, next station, Chicago-local arrival time), with ±8 m of GPS
// noise — so the live path (snap, track, interpolate) is exercised end to end. MOCK_WEATHER=10d|13d|50d|01d.
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { createSim, hash01 } from '../src/transit/sim.js'
import { unproject } from '../../shared/project.js'

const port = Number(process.argv[2] ?? 3901)
const transit = JSON.parse(readFileSync(new URL('../public/world/transit.json', import.meta.url)))
const sim = createSim(transit)
const CODE = { red: 'Red', blue: 'Blue', brown: 'Brn', green: 'G', orange: 'Org', pink: 'Pink', purple: 'P' }
const local = (ms) => new Date(ms).toLocaleString('sv-SE', { timeZone: 'America/Chicago' }).replace(' ', 'T')
const noise = () => (Math.random() - 0.5) * 16

function trains() {
  const now = Date.now()
  return sim.trainsAt(now).filter((t) => CODE[t.line]).map((t) => {
    const [x, , z] = t.head.p, [dx, , dz] = t.head.dir
    const [lon, lat] = unproject(x + noise(), z + noise())
    const heading = Math.round(((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360) || 360
    return { rn: String(1000 + Math.floor(hash01(t.id) * 9000)), lat, lon, heading, line: CODE[t.line], nextStation: t.nextStop?.name, predTime: local(now), arrTime: t.nextStop ? local(t.nextStop.eta) : null, destination: t.destination }
  })
}

const icon = process.env.MOCK_WEATHER ?? '10d'
const DESC = { '10d': 'moderate rain', '13d': 'snow', '50d': 'mist', '01d': 'clear sky', '04d': 'overcast clouds' }
const routes = {
  '/api/health': () => ({ status: 'ok' }),
  '/api/cta/trains': () => ({ trains: trains() }),
  '/api/cta/alerts': () => ({ alerts: [{ id: 'm1', headline: 'Red Line: trains operating with delays near Chicago', impact: 'Significant Delays', affected: ['Red Line'] }] }),
  '/api/weather': () => ({ temp: 14, tempF: 57, description: DESC[icon] ?? 'rain', icon, visibility: icon === '50d' ? 0.6 : 6, windMph: 14, wind: { speed: 14, deg: 290 }, city: 'Chicago' }),
  '/api/sports': () => {
    const start = new Date(Date.now() - 80 * 60000).toISOString().replace(/\.\d+Z$/, 'Z')
    return [
      { name: 'White Sox', league: 'mlb', today: [{ id: 'mock-sox', date: start, venue: 'Rate Field', status: 'Bot 5th', state: 'in', homeTeam: 'Chicago White Sox', awayTeam: 'Detroit Tigers', homeScore: '4', awayScore: '2' }], upcoming: [] },
      { name: 'Cubs', league: 'mlb', today: [], upcoming: [] },
    ]
  },
}

http.createServer((req, res) => {
  const path = req.url.split('?')[0], fn = routes[path]
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('content-type', 'application/json')
  if (!fn) { res.statusCode = 404; res.end('{"error":"not mocked"}'); return }
  res.end(JSON.stringify(fn()))
}).listen(port, () => console.log(`CHI mock on http://localhost:${port}`))
