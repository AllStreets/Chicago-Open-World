// app/src/sports/SportsLife.jsx — everything alive at the venues. Crowds and players sit in a group culled
// beyond 1.5 km and dropped at LOW; fields paint at every quality.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import FieldTextures from './FieldTextures.jsx'
import Cheers from './Cheers.jsx'
import { swellNow } from '../audio/cheerMath.js'
import Crowd from './Crowd.jsx'
import Scoreboard from './Scoreboard.jsx'
import WinFlag from './WinFlag.jsx'
import { flagKind } from './winFlag.js'
import { boardLines } from './scoreboard.js'
import Players, { Ball } from './Players.jsx'
import { uniformColors } from './formations.js'
import { useSports } from './sportsStore.js'
import { useStore } from '../state/store.js'
import { lightLevel } from './venueStates.js'
import { shirtColors, crowdDensity, lifeVisible, shownCount, flagMask, homeTeamFor, celebration, plazaCount } from './crowd.js'
import { fetchAnchors, fieldFans } from './anchors.js'

const MOUNT_M = 3000

function SeatCrowd({ venue, st }) {
  const [seats, setSeats] = useState(null)
  useEffect(() => { let alive = true; fetchAnchors(venue.seats, venue.center).then((a) => alive && setSeats(a)); return () => { alive = false } }, [venue])
  const home = homeTeamFor(venue, st)
  const party = celebration(venue.key, st)
  const anchors = useMemo(() => {
    if (!seats) return null
    const fans = fieldFans(venue.frame, venue.kind === 'baseball' ? 'baseball' : 'football', 160, venue.slot + 3)
    const all = new Float32Array(seats.length + fans.length); all.set(seats); all.set(fans, seats.length)
    return all
  }, [seats, venue])
  const shirts = useMemo(() => (anchors ? shirtColors(anchors.length / 4, home.colors, null, venue.slot + 1) : []), [anchors, home, venue])
  const flags = useMemo(() => (anchors ? flagMask(anchors.length / 4) : new Float32Array(0)), [anchors])
  if (!anchors?.length) return null
  const split = seats.length / 4
  const density = Math.max(crowdDensity(st?.state ?? 'idle', st?.game, venue.capacity), party.minDensity)
  return <Crowd anchors={anchors} split={split} seatCount={shownCount(split, density)} fanCount={party.fans} shirts={shirts} flags={flags}
    wave={party.wave} cheer={() => swellNow(useSports.getState().states[venue.key]?.state, venue.slot + 1, Date.now() / 1000, useSports.getState().swells[venue.key])} level={lightLevel(st?.state)} center={venue.center} radius={venue.radius} />
}

function PlazaCrowd({ venue, st }) {
  const [anchors, setAnchors] = useState(null)
  useEffect(() => { let alive = true; fetchAnchors(venue.plaza, venue.center).then((a) => alive && setAnchors(a)); return () => { alive = false } }, [venue])
  const home = homeTeamFor(venue, st)
  const shirts = useMemo(() => (anchors ? shirtColors(anchors.length / 4, home.colors, null, venue.slot + 21) : []), [anchors, home, venue])
  const flags = useMemo(() => new Float32Array(anchors ? anchors.length / 4 : 0), [anchors])
  if (!anchors?.length) return null
  const n = anchors.length / 4
  return <Crowd anchors={anchors} split={n} seatCount={plazaCount(venue, st)} shirts={shirts} flags={flags} standing level={lightLevel(st?.state)} center={venue.center} radius={venue.radius + 30} />
}

const BOARD_RANGE_M = 3000
function Boards({ venue, st }) {
  const override = useSports((s) => s.boardOverrides[venue.key])
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(id) }, [])
  const group = useRef()
  useFrame(({ camera }) => { if (group.current) group.current.visible = lifeVisible([camera.position.x, 0, camera.position.z], venue.center, 'HIGH', BOARD_RANGE_M) })
  if (!venue.boards?.length) return null
  const lines = boardLines(venue, st, now, override)
  const kind = venue.flagPole ? flagKind(st) : null
  return (
    <group ref={group}>
      {venue.boards.map((b, i) => <Scoreboard key={i} board={b} lines={lines} />)}
      {kind && <WinFlag pole={venue.flagPole} normal={venue.boards[0].normal} kind={kind} />}
    </group>
  )
}

function VenueLife({ venue }) {
  const st = useSports((s) => s.states[venue.key])
  const quality = useStore((s) => s.quality)
  const group = useRef()
  useFrame(({ camera }) => { if (group.current) group.current.visible = lifeVisible([camera.position.x, camera.position.y, camera.position.z], venue.center, quality) })
  return (
    <>
      <group ref={group}>
        {quality !== 'LOW' && venue.seats && <SeatCrowd venue={venue} st={st} />}
        {quality !== 'LOW' && venue.plaza && <PlazaCrowd venue={venue} st={st} />}
        {quality !== 'LOW' && venue.frame && st?.state === 'live' && st.game && (
          <>
            <Players frame={venue.frame} sport={st.game.sport} colors={uniformColors(st.game.sport, homeTeamFor(venue, st))} />
            <Ball frame={venue.frame} sport={st.game.sport} />
          </>
        )}
      </group>
      <Boards venue={venue} st={st} />
    </>
  )
}

export default function SportsLife() {
  const venues = useSports((s) => s.venues)
  const readout = useStore((s) => s.readout)
  const near = venues.filter((v) => readout.x !== undefined && Math.hypot(readout.x - v.center[0], readout.z - v.center[1]) < MOUNT_M)
  return (
    <>
      <FieldTextures />
      <Cheers />
      {near.map((v) => <VenueLife key={v.key} venue={v} />)}
    </>
  )
}
