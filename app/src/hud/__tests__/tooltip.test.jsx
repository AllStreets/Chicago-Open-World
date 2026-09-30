// app/src/hud/__tests__/tooltip.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import BuildingTooltip from '../BuildingTooltip.jsx'
import { useStore } from '../../state/store.js'

describe('building tooltip', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('renders the hovered building and hides when hover clears', () => {
    useStore.setState({ hover: { x: 100, y: 100, lines: ['The Rookery', '209 S LaSalle St', '12 stories · 1888'] } })
    const { rerender } = render(<BuildingTooltip />)
    expect(screen.getByText('The Rookery')).toBeInTheDocument()
    useStore.setState({ hover: null }); rerender(<BuildingTooltip />)
    expect(screen.queryByText('The Rookery')).toBeNull()
  })
})

import BuildingCard from '../cards/BuildingCard.jsx'
describe('building card', () => {
  it('a nameless building leads with its address', () => {
    render(<BuildingCard selection={{ kind: 'building', id: 't:0_0:w1', data: { name: null, address: '70 W Madison St', stories: 57, year: 1979, heightM: 234 } }} />)
    expect(screen.getByText('70 W Madison St')).toHaveClass('hud-title')
    expect(screen.getByText(/57 floors · built 1979 · 234 m/)).toBeInTheDocument()
  })
})

describe('venue card (user fixes)', () => {
  it('a ballpark card shows what it is, not its floors', () => {
    render(<BuildingCard selection={{ kind: 'landmark', id: 'ratefield', data: { name: 'Rate Field', address: '333 West 35th Street', stories: 6, year: 1989, heightM: 40, kind: 'venue', kindLine: 'Ballpark · home of the White Sox' } }} />)
    expect(screen.getByText('Rate Field')).toHaveClass('hud-title')
    expect(screen.getByText(/Ballpark · home of the White Sox/)).toBeInTheDocument()
    expect(screen.queryByText(/floors/)).toBeNull()
  })
})
