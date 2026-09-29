// app/src/hud/HintBar.jsx — the key hints that fit between the side columns, most useful first (G3).
import { ALL_HINTS, fitHints, hintMaxWidth } from '../lib/hints.js'

export default function HintBar({ layoutW = 1280 }) {
  return (
    <div className="hud-hints" style={{ maxWidth: hintMaxWidth(layoutW) }}>
      {fitHints(ALL_HINTS, hintMaxWidth(layoutW)).map(({ k, label }) => (
        <span key={k}><span className="hud-kbd">{k}</span> {label}</span>
      ))}
    </div>
  )
}
