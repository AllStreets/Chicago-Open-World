// app/src/sports/TeamLights.jsx — drives Team lights (teamLights.js) through the façade shader's uTeam* uniforms:
// no meshes, no draw calls. Every half second it decides which team the skyline shows (a preview, the "Play a game"
// celebration, or a real win night); every frame it eases the fade (night × on) and cross-fades from one team to the
// next through dark, the way the real LED arrays change.
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { facadeUniforms, styleRows } from '../world/materials/facadeMaterial.js'
import { hexLinear } from '../world/materials/stylePalette.js'
import { useSports } from './sportsStore.js'
import { useTeamLights } from './teamLightsStore.js'
import { winningTeams, showcaseWinner, resolveLights, zoneTable, TEAM_LIGHT, ZONE_SLOTS } from './teamLights.js'

const DAY_FLOOR = 0.3 // a preview asked for by day still shows (faintly): the LEDs are visible in daylight too

export function writeZones(rowByKey, U = facadeUniforms) {
  const zones = zoneTable(rowByKey)
  for (let i = 0; i < ZONE_SLOTS; i++) {
    const z = zones[i]
    if (z) { U.uTeamZone.value[i].set(z.row, z.y0, z.y1, z.mode); U.uTeamZoneB.value[i].set(z.c, z.k, 0, 0) }
    else { U.uTeamZone.value[i].set(0, 0, 0, 0); U.uTeamZoneB.value[i].set(0, 0, 0, 0) }
  }
  return zones.length
}

export default function TeamLights() {
  const want = useRef(null), shown = useRef(null), level = useRef(0), acc = useRef(1), zonesAt = useRef(-1), winners = useRef([])
  // the winners list scans the schedule: every 15 s and whenever the schedule, the override or the states change
  useEffect(() => { // test-only: ?stats lets e2e read the switch and the shader's fade
    if (new URLSearchParams(window.location.search).has('stats')) window.__teamLights = { store: useTeamLights, fade: () => facadeUniforms.uTeamFade.value, colours: () => [facadeUniforms.uTeamA.value.toArray(), facadeUniforms.uTeamB.value.toArray()] }
  }, [])
  useEffect(() => {
    const scan = () => { const s = useSports.getState(); winners.current = winningTeams(s.games, Date.now(), { source: s.source, override: s.override }) }
    scan()
    const id = setInterval(scan, 15000)
    const unsub = useSports.subscribe((st, prev) => { if (st.games !== prev.games || st.override !== prev.override || st.source !== prev.source) scan() })
    return () => { clearInterval(id); unsub() }
  }, [])
  useFrame((_, dt) => {
    if (zonesAt.current !== styleRows.version) { writeZones(styleRows.byKey); zonesAt.current = styleRows.version }
    acc.current += dt
    if (acc.current >= 0.5) {
      acc.current = 0
      const tl = useTeamLights.getState(), now = Date.now()
      if (tl.preview && now >= tl.preview.until) tl.stopPreview()
      const lit = resolveLights({ on: tl.on, preview: tl.preview, showcaseTeam: showcaseWinner(useSports.getState().states), winners: winners.current, nowMs: now })
      want.current = lit
      const prev = tl.lit
      if (prev?.team !== lit?.team || prev?.why !== lit?.why) tl.setLit(lit)
    }
    const target = want.current
    // change team through dark: fade out, swap the colours, fade back in
    if (target && shown.current?.team !== target.team && (!shown.current || level.current < 0.02)) {
      shown.current = target
      const [a, b] = TEAM_LIGHT[target.team]
      facadeUniforms.uTeamA.value.set(...hexLinear(a)); facadeUniforms.uTeamB.value.set(...hexLinear(b))
    } else if (target && shown.current?.team === target.team) shown.current = target // same colours, new reason
    const goal = target && shown.current?.team === target.team ? 1 : 0
    level.current += (goal - level.current) * Math.min(1, dt * (goal ? 1.6 : 4))
    if (!target && level.current < 0.02) shown.current = null
    const night = facadeUniforms.uNight.value
    const vis = shown.current?.why === 'preview' ? Math.max(night, DAY_FLOOR) : night
    facadeUniforms.uTeamFade.value = shown.current ? level.current * vis : 0
  })
  return null
}
