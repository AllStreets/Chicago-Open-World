// app/src/services/__tests__/chiApi.test.js
import { describe, it, expect, vi } from 'vitest'
import { chiGet, chiBase } from '../chiApi.js'

const ok = (body) => vi.fn(async () => ({ ok: true, status: 200, json: async () => body }))
describe('chiGet', () => {
  it('returns parsed JSON on success', async () => {
    expect(await chiGet('/api/cta/alerts', { base: 'https://chi.example', fetchImpl: ok({ alerts: [] }) })).toEqual({ alerts: [] })
  })
  it('returns null with no base configured, without calling fetch', async () => {
    const f = ok({}); expect(await chiGet('/api/x', { base: '', fetchImpl: f })).toBeNull(); expect(f).not.toHaveBeenCalled()
  })
  it('returns null on non-2xx', async () => {
    expect(await chiGet('/api/x', { base: 'b', fetchImpl: async () => ({ ok: false, status: 502, json: async () => ({}) }) })).toBeNull()
  })
  it('returns null on network/CORS TypeError', async () => {
    expect(await chiGet('/api/x', { base: 'b', fetchImpl: async () => { throw new TypeError('Failed to fetch') } })).toBeNull()
  })
  it('returns null on a non-JSON body', async () => {
    expect(await chiGet('/api/x', { base: 'b', fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x') } }) })).toBeNull()
  })
  it('returns null after the timeout', async () => {
    vi.useFakeTimers()
    const p = chiGet('/api/x', { base: 'b', timeoutMs: 50, fetchImpl: (_u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))) })
    vi.advanceTimersByTime(60)
    expect(await p).toBeNull()
    vi.useRealTimers()
  })
  it('chiBase reads VITE_CHI_API_URL and strips a trailing slash', () => {
    expect(chiBase({ VITE_CHI_API_URL: 'https://chi.example/' })).toBe('https://chi.example')
    expect(chiBase({})).toBe('')
  })
})
