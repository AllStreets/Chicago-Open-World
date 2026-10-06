// app/src/hud/__tests__/paletteGroups.test.jsx — V7 ⌘K groups, with the feature sources mocked (own file: vi.mock is file-wide)
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CommandPalette from '../CommandPalette.jsx'
import { useStore } from '../../state/store.js'

const manifest = { landmarks: [{ key: 'wrigleyfield', name: 'Wrigley Field', x: -2279, z: -7372, top: 24 }, { key: 'willis', name: 'Willis Tower', x: -670, z: 350, top: 527 }], tallest: [] }
import { vi } from 'vitest'
vi.mock('../../lib/paletteSources.js', () => ({
  lensCommands: () => [],
  placeCommands: () => [],
  tourCommands: () => [],
  liveCommands: () => [],
  rideCommands: () => [],
  teamLightCommands: () => [],
  addressRows: () => [],
  officeRows: () => [],
  featurePlaces: () => [
    { id: 'st:clark', kind: 'transit', name: 'Clark/Lake', sub: 'Station · Blue Brown Green Orange Pink Purple', pose: { position: [0, 120, 300], target: [0, 10, 0] } },
    { id: 'g:cubs', kind: 'game', name: "Go to tonight's game", sub: 'Cubs · Wrigley Field', pose: { position: [-2000, 200, -7000], target: [-2279, 10, -7372] } },
  ],
  featureCommands: () => [{ id: 'f:transit', kind: 'command', name: 'Transit: on / off', sub: 'T', run: () => {} }],
}))
describe('⌘K groups (G3)', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useStore.setState({ manifest }) })
  it('empty query shows Landmarks, then Transit, then Games', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const heads = [...document.querySelectorAll('.cmdk-section')].map((e) => e.textContent)
    expect(heads.slice(0, 3)).toEqual(['Landmarks', 'Transit', 'Games'])
  })
  it('stations, games and feature toggles are searchable', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'clark' } })
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Clark/Lake')
    fireEvent.change(input, { target: { value: 'tonight' } })
    expect(screen.getAllByRole('option')[0]).toHaveTextContent("Go to tonight's game")
    fireEvent.change(input, { target: { value: 'transit' } })
    expect(screen.getAllByRole('option').map((o) => o.textContent).join()).toMatch(/Transit: on \/ off/)
  })
})
