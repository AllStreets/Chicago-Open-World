// app/src/hud/Minimap.jsx — heading-up minimap with a scrolling compass strip; click to fly.
import './Minimap.css'
import { useStore } from '../state/store.js'
import { worldToMap, mapToWorld, compassOffset } from '../lib/minimapMath.js'

const VIEW = 196          // on-screen px
const STRIP = 360         // strip px per 360°
const VIEW_M = 2000       // metres visible across the minimap
const LABELS = ['N', 'E', 'S', 'W']

export default function Minimap({ manifest }) {
  const r = useStore((s) => s.readout)
  const requestFlyTo = useStore((s) => s.requestFlyTo)
  const mm = manifest?.minimap
  if (!mm) return null
  const SIZE = mm.size ?? 1024
  const ZOOM = ((VIEW_M / (mm.bounds.maxX - mm.bounds.minX)) * SIZE) / VIEW
  const [px, py] = worldToMap([r.x ?? 0, r.z ?? 0], mm.bounds, SIZE)
  const onClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = (e.clientX - rect.left - VIEW / 2) * ZOOM, dy = (e.clientY - rect.top - VIEW / 2) * ZOOM
    const h = (r.heading * Math.PI) / 180 // undo the heading-up rotation
    const ux = dx * Math.cos(h) - dy * Math.sin(h), uy = dx * Math.sin(h) + dy * Math.cos(h)
    const [x, z] = mapToWorld([px + ux, py + uy], mm.bounds, SIZE)
    requestFlyTo(x, z)
  }
  const off = compassOffset(r.heading, STRIP)
  return (
    <div className="hud-panel mm">
      <div className="mm-compass">
        <div className="mm-strip" style={{ transform: `translateX(${-off - STRIP + VIEW / 2}px)` }}>
          {[0, 1, 2].flatMap((rep) => LABELS.map((l, i) => (
            <span key={`${rep}${l}`} className={l === 'N' ? 'mm-n' : ''} style={{ left: rep * STRIP + i * (STRIP / 4) }}>{l}</span>
          )))}
        </div>
        <i className="mm-tick" />
      </div>
      <div className="mm-view" onClick={onClick}>
        <img className="mm-map" src={`/world/${mm.file}`} alt="" draggable={false}
          style={{ width: SIZE, height: SIZE, transform: `translate(${VIEW / 2}px, ${VIEW / 2}px) rotate(${-r.heading}deg) scale(${1 / ZOOM}) translate(${-px}px, ${-py}px)` }} />
        <i className="mm-player" />
      </div>
    </div>
  )
}
