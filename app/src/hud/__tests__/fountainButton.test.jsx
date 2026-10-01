// app/src/hud/__tests__/fountainButton.test.jsx — the Fountain button agrees with the schedule (merge review).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ControlDock from '../ControlDock.jsx'
import { featureById } from '../featureControls.js'
import { useStore } from '../../state/store.js'

describe('Fountain button during a scheduled show', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-07-15T21:05:00-05:00')); useStore.setState(useStore.getInitialState()) })
  afterEach(() => vi.useRealTimers())
  it('is pressed exactly when the fountain is showing (the real schedule, not only a preview)', () => {
    render(<ControlDock />)
    expect(screen.getByRole('button', { name: 'Fountain (J)' })).toHaveAttribute('aria-pressed', String(featureById('fountain').isOn()))
  })
})
