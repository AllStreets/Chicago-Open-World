import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import NoWebGL from '../NoWebGL.jsx'
import { hasWebGL2, resetWebGL2Check } from '../../lib/webgl.js'

describe('without WebGL2', () => {
  afterEach(() => { resetWebGL2Check(); vi.restoreAllMocks() })
  it('the check says no when the browser has no webgl2 context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    expect(hasWebGL2()).toBe(false)
  })
  it('the check says yes when it does', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => null })
    expect(hasWebGL2()).toBe(true)
  })
  it('shows the city as a picture, says what is needed and where to go instead', () => {
    render(<NoWebGL />)
    expect(screen.getByRole('heading', { name: /can.t draw the 3D city/i })).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('src', '/fallback/city-night.webp')
    expect(screen.getByText(/needs WebGL2/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /illustrated tour/i })).toHaveAttribute('href', expect.stringContaining('docs/TOUR.md'))
  })
})
