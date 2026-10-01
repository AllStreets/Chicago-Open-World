// app/src/hud/__tests__/rideSwatch.test.jsx — F-5 (2026-10-01): the ride panel's line swatches are the official CTA
// colours at full strength, each ringed in a lighter tint of itself so it reads at ≥ 3:1 on the dark panel (Brown too).
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import RidePanel from '../RidePanel.jsx'
import { useStore } from '../../state/store.js'
import { TRANSIT } from '../../transit/__tests__/fixtures.js'
import { contrast, swatchRing, PANEL_BG } from '../../lib/lineSwatch.js'

const BUS = '#4a90d9' // the bus rows' blue (rideCatalog.busRides)
const CTA = { red: '#c60c30', blue: '#00a1de', brown: '#62361b', green: '#009b3a', orange: '#f9461c', pink: '#e27ea6', purple: '#522398', yellow: '#f9e300' }
const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

describe('F-5 line swatches', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useStore.setState({ transit: TRANSIT, ridePanelOpen: true }) })
  it('every CTA colour gets a ring of its own hue at ≥ 3:1 on the panel', () => {
    for (const [line, hex] of Object.entries(CTA)) expect(contrast(swatchRing(hex), PANEL_BG), line).toBeGreaterThanOrEqual(3)
    expect(contrast(CTA.brown, PANEL_BG)).toBeLessThan(3) // why the ring is needed
  })
  it('the panel draws them at full strength: official fill, the ring, no dimming', () => {
    const { container } = render(<RidePanel />)
    const sw = [...container.querySelectorAll('.ride-swatch')]
    expect(sw.length).toBeGreaterThan(0)
    for (const el of sw) {
      expect(el.classList.contains('tl-swatch')).toBe(false) // the legend's "line hidden" dimming never applies here
      const fill = el.style.backgroundColor
      const line = Object.keys(CTA).find((k) => rgb(CTA[k]) === fill) ?? TRANSIT.lines.find((l) => rgb(l.colour) === fill)?.id ?? (rgb(BUS) === fill ? 'bus' : null)
      expect(line, fill).toBeTruthy()
      expect(el.style.borderColor).not.toBe('')
    }
  })
})
