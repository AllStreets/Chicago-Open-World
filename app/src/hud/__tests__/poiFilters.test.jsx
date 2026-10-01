// app/src/hud/__tests__/poiFilters.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PoiFilters from '../panels/PoiFilters.jsx'
import { useStore } from '../../state/store.js'

describe('POI filter chips', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('toggles a category and supports All / None', () => {
    render(<PoiFilters />)
    fireEvent.click(screen.getByRole('button', { name: 'None' }))
    expect(useStore.getState().poiCats).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Bars' }))
    expect(useStore.getState().poiCats).toEqual(['drinks'])
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(useStore.getState().poiCats.length).toBe(12)
  })
})

describe('POI colours (user fixes)', () => {
  it('every category has its own colour, and each chip carries it', async () => {
    const { POI_CATEGORIES } = await import('../../data/poiCategories.js')
    expect(new Set(POI_CATEGORIES.map((c) => c.color)).size).toBe(POI_CATEGORIES.length)
    render(<PoiFilters />)
    const bars = screen.getByRole('button', { name: 'Bars' })
    expect(bars.style.getPropertyValue('--cat')).toBe('#7048E8')
  })
})
