const HINTS = [['Drag', 'rotate'], ['Scroll', 'zoom'], ['WASD', 'glide'], ['↑↓', 'pitch'], ['Shift', 'boost'], ['O', 'orbit'], ['1–5', 'time']]

export default function HintBar() {
  return (
    <div className="hud-hints">
      {HINTS.map(([k, label]) => (
        <span key={k}><span className="hud-kbd">{k}</span> {label}</span>
      ))}
    </div>
  )
}
