// app/src/hud/CommandPalette.jsx — ⌘K: search every place and command, then fly there.
import './CommandPalette.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { RiSearchLine, RiBuilding2Line, RiMapPin2Line, RiCameraLensLine, RiSunLine, RiCommandLine, RiTrainLine } from 'react-icons/ri'
import { transitPlaces } from '../transit/palette.js'
import { useStore } from '../state/store.js'
import { buildPlaces, searchPlaces } from '../lib/places.js'
import { BOOKMARKS } from '../lib/bookmarks.js'

const ICON = { landmark: RiBuilding2Line, neighborhood: RiMapPin2Line, view: RiCameraLensLine, command: RiCommandLine, time: RiSunLine, transit: RiTrainLine }
const SECTION = { landmark: 'Landmarks', neighborhood: 'Neighborhoods', view: 'Views', command: 'Commands', transit: 'Transit' }
const ORDER = ['landmark', 'transit', 'neighborhood', 'view', 'command']

// ⌘K on Mac, Ctrl+K on Windows/Linux; code covers non-Latin keyboard layouts.
export const isPaletteKey = (e) => (e.metaKey || e.ctrlKey) && (e.key?.toLowerCase() === 'k' || e.code === 'KeyK')

function commands() {
  const s = useStore.getState()
  const time = (t, name) => ({ id: `t:${t}`, kind: 'command', name, sub: 'Time of day', icon: 'time', run: () => s.setTimePreset(t) })
  return [
    time('LIVE', 'Live Chicago time'), time('DAWN', 'Dawn'), time('DAY', 'Day'), time('DUSK', 'Dusk'), time('NIGHT', 'Night'),
    { id: 'q:LOW', kind: 'command', name: 'Quality: Low', sub: 'Faster on older laptops', run: () => s.setQuality('LOW') },
    { id: 'q:HIGH', kind: 'command', name: 'Quality: High', sub: 'Balanced', run: () => s.setQuality('HIGH') },
    { id: 'q:ULTRA', kind: 'command', name: 'Quality: Ultra', sub: 'Sharpest shadows', run: () => s.setQuality('ULTRA') },
    { id: 'c:orbit', kind: 'command', name: 'Orbit around here', sub: 'O', run: () => s.setCameraMode('ORBIT') },
    { id: 'c:home', kind: 'command', name: 'Home view', sub: 'H', run: () => s.camCommand('home') },
    { id: 'c:north', kind: 'command', name: 'Face north', sub: 'N', run: () => s.camCommand('north') },
    { id: 'tr:toggle', kind: 'command', name: 'Transit lines on / off', sub: 'T', run: () => s.toggleTransit() },
    { id: 'c:help', kind: 'command', name: 'Show controls & help', sub: '?', run: () => s.setHelpOpen(true) },
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
  const all = useMemo(() => [...buildPlaces(manifest, BOOKMARKS), ...transitPlaces(useStore.getState()).map((p) => ({ ...p, kind: 'transit' })), ...commands()], [manifest, transit, open])
  const results = useMemo(() => {
    const found = q.trim() ? searchPlaces(q, all) : [...searchPlaces('', all.filter((p) => p.kind !== 'command' && !(p.kind === 'transit' && p.id.startsWith('st:')))), ...all.filter((p) => p.kind === 'command').slice(0, 5)]
    const grouped = ORDER.flatMap((k) => found.filter((r) => r.kind === k))
    return q.trim() ? found.slice(0, 40) : grouped.slice(0, 40)
  }, [q, all])
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' }) }, [cursor])

  if (!open) return null
  const close = () => useStore.getState().setPaletteOpen(false)
  const choose = (r) => {
    if (!r) return
    close()
    if (r.run) r.run()
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
