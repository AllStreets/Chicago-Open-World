// app/src/sports/SportsLife.jsx — everything alive at the venues. Crowds and players sit in a group culled
// beyond 1.5 km and dropped at LOW; fields paint at every quality.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import FieldTextures from './FieldTextures.jsx'
import Crowd from './Crowd.jsx'
import Players, { Ball } from './Players.jsx'
import { uniformColors } from './formations.js'
import { useSports } from './sportsStore.js'
import { useStore } from '../state/store.js'
import { lightLevel } from './venueStates.js'
import { shirtColors, crowdDensity, lifeVisible, shownCount, flagMask, homeTeamFor, celebration } from './crowd.js'
import { fetchAnchors, fieldFans } from './anchors.js'

const MOUNT_M = 3000

function SeatCrowd({ venue, st, cheer = 0 }) {
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
    wave={party.wave} cheer={cheer} level={lightLevel(st?.state)} center={venue.center} radius={venue.radius} />
}

function VenueLife({ venue }) {
  const st = useSports((s) => s.states[venue.key])
  const quality = useStore((s) => s.quality)
  const group = useRef()
  useFrame(({ camera }) => { if (group.current) group.current.visible = lifeVisible([camera.position.x, camera.position.y, camera.position.z], venue.center, quality) })
  return (
    <group ref={group}>
      {quality !== 'LOW' && venue.seats && <SeatCrowd venue={venue} st={st} />}
      {quality !== 'LOW' && venue.frame && st?.state === 'live' && st.game && (
        <>
          <Players frame={venue.frame} sport={st.game.sport} colors={uniformColors(st.game.sport, homeTeamFor(venue, st))} />
          <Ball frame={venue.frame} sport={st.game.sport} />
        </>
      )}
    </group>
  )
}

export default function SportsLife() {
  const venues = useSports((s) => s.venues)
  const readout = useStore((s) => s.readout)
  const near = venues.filter((v) => readout.x !== undefined && Math.hypot(readout.x - v.center[0], readout.z - v.center[1]) < MOUNT_M)
  return (
    <>
      <FieldTextures />
      {near.map((v) => <VenueLife key={v.key} venue={v} />)}
    </>
  )
}
