const HINTS = [['↑↓←→', 'move'], ['Shift+arrows', 'turn'], ['R / F', 'up / down'], ['Double-click', 'fly there'], ['⌘K', 'search · “tonight”'], ['[ ]', 'views'], ['T', 'transit'], ['Click a train', 'ride along'], ['?', 'help']]

export default function HintBar() {
  return (
    <div className="hud-hints">
      {HINTS.map(([k, label]) => (
        <span key={k}><span className="hud-kbd">{k}</span> {label}</span>
      ))}
    </div>
  )
}
