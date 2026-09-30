// app/src/hud/__tests__/nearestL.test.jsx — the "Nearest L" line every guide card carries (P4 Task 2).
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import NearestL from '../cards/NearestL.jsx'
import { useStore } from '../../state/store.js'

const transit = { lines: [{ id: 'red', name: 'Red Line', colour: '#c60c30' }], routes: [], stations: [{ id: 'grand', name: 'Grand', operator: 'cta', lines: ['red'], x: 0, z: -1450 }] }
describe('<NearestL/>', () => {
  beforeEach(() => useStore.setState({ ...useStore.getInitialState(), transit }))
  it('names the nearest station, its lines and the walk', () => {
    render(<NearestL x={0} z={-1290} />)
    expect(screen.getByText(/Nearest L/)).toBeInTheDocument()
    expect(screen.getByText(/Grand \(Red\) · 2 min walk/)).toBeInTheDocument()
  })
  it('says so when no L is within walking distance', () => {
    render(<NearestL x={9000} z={9000} />)
    expect(screen.getByText('No L within walking distance')).toBeInTheDocument()
  })
})
