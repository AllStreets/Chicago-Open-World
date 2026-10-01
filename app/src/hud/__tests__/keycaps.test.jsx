// app/src/hud/__tests__/keycaps.test.jsx — F-3 (2026-10-01): every key named in the ride panel, the in-ride bar, the
// glide hints and the help card is a <kbd> keycap — never bare punctuation (". and ," read like typos and arrows);
// punctuation and arrow keys carry a spoken name.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import RidePanel from '../RidePanel.jsx'
import RideBar from '../RideBar.jsx'
import HelpOverlay from '../HelpOverlay.jsx'
import FollowChip from '../FollowChip.jsx'
import { useStore } from '../../state/store.js'
import { TRANSIT } from '../../transit/__tests__/fixtures.js'
import { keysPlain } from '../Keycap.jsx'
import { GLIDE_RIDE } from '../../ride/rideCatalog.js'

// a key standing on its own in prose: a punctuation key between spaces (". and ," — the bug), an arrow, ⌘K,
// Space/Esc/Shift, or a lone capital letter (the L in "the L train" is the train, not the key)
const BARE_KEY = /(\s[.,<>?/[\]+−](?=\s|$)|^[.,<>?/[\]+−]$|(^|[\s(“])([↑↓←→]|⌘K|Space|Esc|Shift|[A-Z])(?=$|[\s,;:)”·]))/
function bareKeys(root) {
  const out = [], walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (n.parentElement.closest('kbd, button, .ride-row, .slash')) continue
    const text = n.textContent.replace(/\b(an?|the) L\b|\bL trains?\b|\d+ [NSEW] /g, '') // the train; an address
    const m = text.match(BARE_KEY)
    if (m) out.push(`${m[0].trim()} in “${n.textContent.trim()}” <${n.parentElement.tagName}.${n.parentElement.className}>`)
  }
  return out
}

describe('F-3 keycaps', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-09-30T08:15:00-05:00'), toFake: ['Date'] })
    useStore.setState(useStore.getInitialState()); useStore.setState({ transit: TRANSIT })
    try { localStorage.setItem('chi-ow-help-seen', '1') } catch { /* fine */ }
  })
  it('the ride panel: keys as keycaps in short rows, punctuation named', () => {
    useStore.setState({ ridePanelOpen: true })
    const { container } = render(<RidePanel />)
    expect(bareKeys(container)).toEqual([])
    const kbds = [...container.querySelectorAll('kbd')]
    for (const k of ['Space', '.', ',', '>', '<', 'K', 'Esc', '↑', '↓', 'Shift']) expect(kbds.some((e) => e.textContent === k), k).toBe(true)
    const named = Object.fromEntries(kbds.map((e) => [e.textContent, e.getAttribute('aria-label')]))
    expect(named).toMatchObject({ '.': 'period', ',': 'comma', '>': 'greater than', '<': 'less than', '↑': 'up arrow' })
  })
  it('the in-ride bar and the glide bar', () => {
    useStore.setState({ ride: { id: 'l:x', kind: 'L', name: 'Brown Line', view: 'cab', paused: false, speed: 1 }, rideHud: { next: { name: 'Clark/Lake', etaS: 70 }, progress: 0.3 } })
    const a = render(<RideBar />)
    expect(bareKeys(a.container)).toEqual([])
    expect(a.container.querySelector('.rb-keys kbd[aria-label="period"]')).not.toBeNull()
    a.unmount()
    useStore.setState({ ride: { id: 'glide', kind: 'glide', name: 'Glide' }, rideHud: { speedKmh: 120, altM: 300, boost: 1 } })
    const b = render(<RideBar />)
    expect(bareKeys(b.container)).toEqual([]); expect(b.container.querySelectorAll('kbd').length).toBeGreaterThanOrEqual(5)
  })
  it('the help card and the follow chip', () => {
    useStore.setState({ helpOpen: true })
    const h = render(<HelpOverlay />)
    expect(bareKeys(h.container)).toEqual([])
    h.unmount()
    useStore.setState({ follow: { trainId: 'x', view: 'chase' } })
    const f = render(<FollowChip />)
    expect(bareKeys(f.container)).toEqual([])
  })
  it('plain-text places (tooltips, ⌘K rows) get the words without braces', () => {
    expect(keysPlain(GLIDE_RIDE.blurb)).not.toMatch(/[{}]/)
    expect(keysPlain('{Space} pause')).toBe('Space pause')
  })
})
