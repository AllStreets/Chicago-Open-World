// app/src/hud/__tests__/poiCard.test.jsx — the place card (user fixes): what it is, where, when — and its website.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PoiCard from '../cards/PoiCard.jsx'

const card = (data) => render(<PoiCard selection={{ kind: 'poi', id: data.id, data }} />)
describe('<PoiCard/>', () => {
  it('a place with a website gets a Website button that opens it in a new tab', () => {
    card({ id: 'n1', n: 'The Aviary', c: 1, x: 0, z: 0, a: '955 W Fulton Market', t: { website: 'https://theaviary.com/', opening_hours: 'Mo-Su 17:00-24:00', cuisine: 'cocktails' } })
    const link = screen.getByRole('link', { name: /website/i })
    expect(link).toHaveAttribute('href', 'https://theaviary.com/'); expect(link).toHaveAttribute('target', '_blank')
    expect(screen.getByText('Bars')).toBeInTheDocument()
    expect(screen.getByText(/Mo-Su 17:00-24:00/)).toBeInTheDocument()
  })
  it('a place with no website offers a web search for it instead', () => {
    card({ id: 'n2', n: 'Green Mill', c: 4, x: 0, z: 0 })
    const link = screen.getByRole('link', { name: /search the web/i })
    expect(link.getAttribute('href')).toBe('https://www.google.com/search?q=Green%20Mill%20Chicago')
  })
  it('a bare domain in OSM still becomes a working link', () => {
    card({ id: 'n3', n: 'X', c: 0, x: 0, z: 0, t: { website: 'www.example.com' } })
    expect(screen.getByRole('link', { name: /website/i })).toHaveAttribute('href', 'https://www.example.com')
  })
})
