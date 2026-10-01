// app/src/hud/__tests__/dockOrder.test.jsx — the user's dock: Places takes Sound's slot; M still switches sound.
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ControlDock from '../ControlDock.jsx'
import { DOCK_FEATURES } from '../featureControls.js'
import { useStore } from '../../state/store.js'
import { useSoundStore } from '../../audio/soundStore.js'
import { useFeatureKeys } from '../useFeatureKeys.js'

function Keys() { useFeatureKeys(); return null }
describe('dock order', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useSoundStore.setState(useSoundStore.getInitialState()) })
  it('shows Transit, Games, Places, then Bridges, Fountain, Fireworks — no Sound button', () => {
    expect(DOCK_FEATURES.map((c) => c.id)).toEqual(['transit', 'games', 'places', 'bridges', 'fountain', 'fireworks'])
    render(<ControlDock />)
    expect(screen.queryByRole('button', { name: /^sound/i })).toBeNull()
  })
  it('M still turns sound on and off', () => {
    render(<Keys />)
    fireEvent.keyDown(window, { code: 'KeyM', key: 'm' })
    expect(useSoundStore.getState().soundOn).toBe(true)
  })
})
