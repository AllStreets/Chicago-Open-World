// app/src/hud/__tests__/neighborhoodCard.test.jsx — the LIVE profile card (P4 Task 7).
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NeighborhoodCard from '../cards/NeighborhoodCard.jsx'

describe('neighbourhood card', () => {
  it('shows character, vibe, an honest rent label, five scored bars and dated sources', () => {
    const z = { id: 'pilsen', name: 'Pilsen', character: 'Murals on nearly every block of 18th Street.', vibe: ['artistic', 'cultural'], rent: { oneBr: 1600, source: 'CHI', asOf: '2026-09' },
      lines: ['pink'], feel: { walk: 1.4, transit: 7.4, nightlife: 1.9, green: 2.4, quiet: 9 }, sources: [{ label: 'Wikipedia — Pilsen', url: 'https://en.wikipedia.org/wiki/Pilsen,_Chicago', asOf: '2026-09' }] }
    render(<NeighborhoodCard selection={{ kind: 'neighborhood', id: 'pilsen', data: z }} />)
    expect(screen.getByText('Pilsen')).toBeInTheDocument()
    expect(screen.getByText('artistic')).toBeInTheDocument()
    expect(screen.getByText('1BR ≈ $1.6k (indicative)')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByLabelText('Quiet 9 of 10')).toBeInTheDocument()
    expect(screen.getByText(/Wikipedia — Pilsen \(2026-09\)/)).toBeInTheDocument()
  })
})
