import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import Minimap from '../Minimap.jsx'
import { useStore } from '../../state/store.js'

const manifest = { minimap: { file: 'minimap.png', bounds: { minX: -2000, minZ: -2000, maxX: 2000, maxZ: 2000 } } }

describe('Minimap', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('renders the compass strip and map image', () => {
    const { container, getAllByText } = render(<Minimap manifest={manifest} />)
    expect(container.querySelector('img.mm-map')).toBeTruthy()
    expect(getAllByText('N').length).toBeGreaterThan(0)
  })
  it('click requests a fly-to', () => {
    const { container } = render(<Minimap manifest={manifest} />)
    fireEvent.click(container.querySelector('.mm-view'), { clientX: 10, clientY: 10 })
    expect(useStore.getState().flyTo).not.toBeNull()
  })
  it('renders nothing without a minimap in the manifest', () => {
    const { container } = render(<Minimap manifest={{}} />)
    expect(container.innerHTML).toBe('')
  })
})
