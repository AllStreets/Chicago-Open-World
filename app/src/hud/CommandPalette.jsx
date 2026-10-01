// app/src/hud/CommandPalette.jsx — ⌘K: search every place and command, then fly there.
import './CommandPalette.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { RiSearchLine, RiBuilding2Line, RiMapPin2Line, RiCameraLensLine, RiSunLine, RiCommandLine, RiTrainLine, RiTrophyLine, RiCompass3Line } from 'react-icons/ri'
import { useSports } from '../sports/sportsStore.js'
import { useStore } from '../state/store.js'
import { buildPlaces, searchPlaces } from '../lib/places.js'
import { BOOKMARKS } from '../lib/bookmarks.js'
import { featurePlaces, featureCommands, lensCommands, placeCommands, tourCommands, addressRows } from '../lib/paletteSources.js'
import { buildPlaceRows } from '../lib/poiFilter.js'
import { zoneForName } from '../lib/neighborhoods.js'
import { openZone } from '../world/NeighborhoodZones.jsx'
import { worldUrl } from '../lib/manifest.js'
import { buildingPose } from './cards/BuildingCard.jsx'

const ICON = { landmark: RiBuilding2Line, neighborhood: RiMapPin2Line, view: RiCameraLensLine, command: RiCommandLine, time: RiSunLine, transit: RiTrainLine, game: RiTrophyLine, guide: RiCompass3Line, place: RiMapPin2Line }
const SECTION = { landmark: 'Landmarks', neighborhood: 'Neighborhoods', view: 'Views', command: 'Commands', transit: 'Transit', game: 'Games', guide: 'Guide', place: 'Places' }
const ORDER = ['landmark', 'guide', 'place', 'transit', 'game', 'neighborhood', 'view', 'command']

// ⌘K on Mac, Ctrl+K on Windows/Linux; code covers non-Latin keyboard layouts.
export const isPaletteKey = (e) => (e.metaKey || e.ctrlKey) && (e.key?.toLowerCase() === 'k' || e.code === 'KeyK')

export function commands() {
  const s = useStore.getState()
  const time = (t, name) => ({ id: `t:${t}`, kind: 'command', name, sub: 'Time of day', icon: 'time', run: () => s.setTimePreset(t) })
  return [
    time('LIVE', 'Live Chicago time'), time('DAWN', 'Dawn'), time('DAY', 'Day'), time('DUSK', 'Dusk'), time('NIGHT', 'Night'), time('SUNNY', 'Sunny summer day'), { ...time('SNOW', 'Snowy Christmas'), aliases: ['snow', 'christmas', 'winter', 'frozen lake'] },
    { id: 'q:LOW', kind: 'command', name: 'Quality: Low', sub: 'Faster on older laptops', run: () => s.setQuality('LOW') },
    { id: 'q:HIGH', kind: 'command', name: 'Quality: High', sub: 'Balanced', run: () => s.setQuality('HIGH') },
    { id: 'q:ULTRA', kind: 'command', name: 'Quality: Ultra', sub: 'Sharpest shadows', run: () => s.setQuality('ULTRA') },
    { id: 'c:orbit', kind: 'command', name: 'Orbit around here', sub: 'O', run: () => s.setCameraMode('ORBIT') },
    { id: 'c:home', kind: 'command', name: 'Home view', sub: 'H', run: () => s.camCommand('home') },
    { id: 'c:north', kind: 'command', name: 'Face north', sub: 'N', run: () => s.camCommand('north') },
    { id: 'c:perf', kind: 'command', name: 'Performance stats: on / off', sub: 'Draw calls, triangles, frame rate', run: () => s.setPerfOn(!useStore.getState().perfOn) },
    { id: 'c:help', kind: 'command', name: 'Show controls & help', sub: '?', run: () => s.setHelpOpen(true) },
    ...featureCommands(),
    ...lensCommands(),
    ...placeCommands(),
    ...tourCommands(),
  ]
}

export default function CommandPalette() {
  const open = useStore((s) => s.paletteOpen)
  const manifest = useStore((s) => s.manifest)
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      const typing = ['INPUT', 'TEXTAREA'].includes(e.target?.tagName)
      if (isPaletteKey(e)) { e.preventDefault(); useStore.getState().setPaletteOpen(!useStore.getState().paletteOpen) }
      else if (e.key === '/' && !typing) { e.preventDefault(); useStore.getState().setPaletteOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => { if (open) { setQ(''); setCursor(0); setTimeout(() => inputRef.current?.focus(), 0) } }, [open])

  const transit = useStore((s) => s.transit)
  const venues = useSports((s) => s.venues)
  // every place by name (pois-index.json), fetched the first time the palette opens
  const [placeRows, setPlaceRows] = useState([])
  useEffect(() => {
    if (!open || placeRows.length || !manifest?.pois?.index) return
    const flyTo = (p) => { const s = useStore.getState(); s.startFlight(buildingPose({ x: p.x, z: p.z, heightM: 20 }), p.name); s.select({ kind: 'poi', id: p.id, data: { id: p.id, n: p.name, c: p.c, x: p.x, z: p.z } }) }
    fetch(worldUrl(manifest.pois.index, manifest.version))
      .then((r) => r.json())
      .then((ix) => setPlaceRows(buildPlaceRows(ix).map((p) => ({ ...p, run: () => flyTo(p) }))))
      .catch(() => {})
  }, [open, manifest, placeRows.length])
  // feature entries are read when the palette opens (and when their data first arrives), not on every store change
  const all = useMemo(() => [...buildPlaces(manifest, BOOKMARKS), ...featurePlaces(useStore.getState()), ...commands(), ...placeRows], [manifest, transit, open, venues, placeRows])
  const results = useMemo(() => {
    const found = q.trim() ? searchPlaces(q, all) : [...searchPlaces('', all.filter((p) => p.kind !== 'command' && p.kind !== 'guide' && p.kind !== 'place')), ...all.filter((p) => p.kind === 'guide').slice(0, 3), ...all.filter((p) => p.kind === 'command').slice(0, 5)]
    const grouped = ORDER.flatMap((k) => found.filter((r) => r.kind === k))
    return q.trim() ? [...addressRows(q), ...found].slice(0, 40) : grouped.slice(0, 40) // a typed address leads with Set office / Fly to
  }, [q, all])
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' }) }, [cursor])

  if (!open) return null
  const close = () => useStore.getState().setPaletteOpen(false)
  const choose = (r) => {
    if (!r) return
    close()
    if (r.run) r.run()
    else if (r.kind === 'neighborhood' && zoneForName(r.name, useStore.getState().hoods)) openZone(zoneForName(r.name, useStore.getState().hoods)) // its LIVE profile too
    else useStore.getState().startFlight(r.pose, r.name)
  }
  const onKeyDown = (e) => {
    if (isPaletteKey(e)) { e.preventDefault(); e.stopPropagation(); close(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(results.length - 1, c + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[cursor]) }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
    e.stopPropagation()
  }
  let lastKind = null
  return (
    <div className="cmdk-backdrop" onMouseDown={close}>
      <div className="cmdk hud-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <RiSearchLine className="cmdk-search-icon" />
          <input ref={inputRef} className="cmdk-input" role="combobox" aria-expanded="true" aria-controls="cmdk-list"
            placeholder="Fly to a landmark, neighborhood or view…" value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0) }} onKeyDown={onKeyDown} />
          <span className="hud-kbd">ESC</span>
        </div>
        <ul className="cmdk-list" id="cmdk-list" role="listbox" ref={listRef}>
          {results.length === 0 && <li className="cmdk-empty">No matches — try “Willis”, “Wrigley” or “Pilsen”</li>}
          {results.map((r, i) => {
            const header = !q.trim() && r.kind !== lastKind ? SECTION[r.kind] : null
            lastKind = r.kind
            const Icon = ICON[r.icon ?? r.kind] ?? RiMapPin2Line
            return [
              header && <li key={`h:${r.kind}`} className="cmdk-section hud-label" aria-hidden="true">{header}</li>,
              <li key={r.id} role="option" aria-selected={i === cursor} className={`cmdk-item${i === cursor ? ' selected' : ''}`}
                onMouseEnter={() => setCursor(i)} onClick={() => choose(r)}>
                <Icon className="cmdk-item-icon" />
                <span className="cmdk-item-label">{r.name}</span>
                <span className="cmdk-item-hint">{r.sub}</span>
              </li>,
            ]
          })}
        </ul>
        <div className="cmdk-foot"><span><span className="hud-kbd">↑</span><span className="hud-kbd">↓</span> choose</span><span><span className="hud-kbd">Enter</span> fly there</span><span><span className="hud-kbd">⌘K</span> toggle</span></div>
      </div>
    </div>
  )
}
