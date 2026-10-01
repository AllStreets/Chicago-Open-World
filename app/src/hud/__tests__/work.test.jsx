// app/src/hud/__tests__/work.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WorkPanel from '../panels/WorkPanel.jsx'
import { useStore } from '../../state/store.js'

describe('WORK panel', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useStore.getState().setLens('WORK') })
  it('arms "Set office" and always shows the estimate label', () => {
    render(<WorkPanel />)
    expect(screen.getByText('ESTIMATE · simplified transit model')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /set office/i }))
    expect(useStore.getState().officeArmed).toBe(true)
  })
})
