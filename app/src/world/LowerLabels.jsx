// app/src/world/LowerLabels.jsx — D4-2: names for what lies under the street, through WorldLabels. With U on, the
// lower streets ("Lower Wacker Dr", "Lower Michigan Ave" …) and the Riverwalk's rooms; with U off, only the rooms, and
// only when the camera is down by the river. A click flies there. No geometry, no draw calls.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useStore } from '../state/store.js'
import { worldUrl } from '../lib/manifest.js'
import { readLevels } from '../lib/levels.js'
import { setLabels } from './labelRegistry.js'
import { lowerStreetLabels, riverwalkRoomLabels, labelPose } from './lowerLabels.js'
import riverwalk from '../../../pipeline/data/riverwalk.json'

export const ROOMS_NEAR = { belowM: 240, withinM: 700 }

// which groups show: the street names only in the U view; the rooms in it, or low and near them
export function labelGroups(on, cam, rooms, near = ROOMS_NEAR) {
  const low = cam[1] < near.belowM && rooms.some((r) => Math.hypot(r.x - cam[0], r.z - cam[2]) < near.withinM)
  return { streets: Boolean(on), rooms: Boolean(on) || low }
}

export default function LowerLabels({ json }) {
  const on = useStore((s) => s.lowerLevelsOn)
  const manifest = useStore((s) => s.manifest)
  const river = useMemo(() => readLevels(manifest).river, [manifest])
  const [roomData, setRoomData] = useState(null)
  useEffect(() => {
    if (!river?.file || !manifest?.bridges) { setRoomData(null); return undefined }
    let alive = true
    Promise.all([river.file, manifest.bridges].map((f) => fetch(worldUrl(f, manifest.version)).then((r) => (r.ok ? r.json() : null))))
      .then(([lv, br]) => { if (alive && lv && br) setRoomData({ floors: lv.floors, bridges: br.bridges }) })
      .catch(() => {})
    return () => { alive = false }
  }, [river, manifest])
  const fly = (it) => useStore.getState().startFlight(labelPose(it, it.kind === 'room' ? 45 : 70, it.kind === 'room' ? 70 : 90), it.text)
  const streets = useMemo(() => lowerStreetLabels(json).map((it) => ({ ...it, onClick: () => fly(it) })), [json])
  const rooms = useMemo(() => (roomData ? riverwalkRoomLabels(riverwalk.rooms, roomData.bridges, roomData.floors, river?.riverwalk).map((it) => ({ ...it, onClick: () => fly(it) })) : []), [roomData, river])
  const shown = useRef({ streets: null, rooms: null }), acc = useRef(1)
  useFrame(({ camera }, dt) => {
    acc.current += dt
    if (acc.current < 0.25) return
    acc.current = 0
    const g = labelGroups(on, camera.position.toArray(), rooms)
    if (g.streets !== shown.current.streets) { shown.current.streets = g.streets; setLabels('lower', g.streets ? streets : []) }
    if (g.rooms !== shown.current.rooms) { shown.current.rooms = g.rooms; setLabels('rooms', g.rooms ? rooms : []) }
  })
  // new items (the world loaded, the rooms arrived): lay them out again on the next check
  useEffect(() => { shown.current = { streets: null, rooms: null } }, [streets, rooms])
  useEffect(() => () => { setLabels('lower', []); setLabels('rooms', []) }, [])
  return null
}
