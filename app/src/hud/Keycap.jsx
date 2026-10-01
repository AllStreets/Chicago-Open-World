// app/src/hud/Keycap.jsx — a key drawn as a keycap chip (the same chip as ⌘K and L in the dock), anywhere a key is
// named in running text (F-3, 2026-10-01): ". and ," in a sentence read like typos and arrows, a [.] chip doesn't.
// Copy marks its keys with braces — "{Space} pause · {.} {,} next / previous stop" — and withKeys() draws the chips.
const SPOKEN = {
  '.': 'period', ',': 'comma', '>': 'greater than', '<': 'less than', '?': 'question mark', '/': 'slash',
  '[': 'left bracket', ']': 'right bracket', '+': 'plus', '−': 'minus', '-': 'minus',
  '↑': 'up arrow', '↓': 'down arrow', '←': 'left arrow', '→': 'right arrow', '⌘K': 'Command K', Esc: 'Escape',
}

export function Kbd({ k, className = '' }) {
  return <kbd className={`hud-kbd ${className}`.trim()} aria-label={SPOKEN[k]} title={SPOKEN[k]}>{k}</kbd>
}

const TOKEN = /(\{[^{}]+\})/
// "…{.}…" → text and <kbd> chips, for JSX
export function withKeys(text) {
  return String(text).split(TOKEN).filter(Boolean).map((p, i) => (p.startsWith('{') && p.endsWith('}') ? <Kbd key={i} k={p.slice(1, -1)} className="inline" /> : p))
}
// the same copy for a tooltip or a ⌘K row: the key names, no braces
export const keysPlain = (text) => String(text).replace(/\{([^{}]+)\}/g, '$1')
