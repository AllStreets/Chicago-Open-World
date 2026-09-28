import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SafeLoad from '../SafeLoad.jsx'

function Boom() { throw new Error('404 tiles/9_9.glb') }

describe('SafeLoad', () => {
  it('renders children when nothing throws', () => {
    render(<SafeLoad><p>ok</p></SafeLoad>)
    expect(screen.getByText('ok')).toBeInTheDocument()
  })
  it('swallows a failing loader, renders the fallback and reports once', () => {
    const onError = vi.fn()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<div><SafeLoad onError={onError} fallback={<p>fallback</p>}><Boom /></SafeLoad><p>sibling</p></div>)
    spy.mockRestore()
    expect(screen.getByText('fallback')).toBeInTheDocument()
    expect(screen.getByText('sibling')).toBeInTheDocument()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0].message).toContain('9_9')
  })
})
