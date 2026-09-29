import { describe, it, expect } from 'vitest'
import { useStore } from '../store.js'
describe('V6 store', () => {
  it('startBridgeLift twice restarts; stop clears', async () => {
    useStore.getState().startBridgeLift()
    const first = useStore.getState().bridgeLift
    await new Promise((r) => setTimeout(r, 5))
    useStore.getState().startBridgeLift()
    expect(useStore.getState().bridgeLift.startedAt).toBeGreaterThan(first.startedAt)
    useStore.getState().stopBridgeLift()
    expect(useStore.getState().bridgeLift).toBeNull()
  })
})
