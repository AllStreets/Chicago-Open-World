// app/src/hud/__tests__/soundToast.test.jsx — Workstream C (2026-10-01): pressing M (or ⌘K "Sound") shows a bare
// green speaker with waves (on) or a red speaker with a slash (off) in the middle of the screen: no plate, no shadow;
// it holds 1.0 s, fades over 1.5 s, restarts on every change, and is announced to screen readers.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import fs from 'node:fs'
import SoundToast, { HOLD_MS, FADE_MS } from '../SoundToast.jsx'
import SoundGlyph from '../SoundGlyph.jsx'
import { useSoundStore } from '../../audio/soundStore.js'
import { useStore } from '../../state/store.js'
import { featureCommands } from '../../lib/paletteSources.js'
import { useFeatureKeys } from '../useFeatureKeys.js'

const toast = () => document.querySelector('.sound-toast')
function Keys() { useFeatureKeys(); return null }
const reduced = (on) => { window.matchMedia = vi.fn((q) => ({ matches: on && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) }

describe('C-1 the green token', () => {
  it('--green lives in global.css and nowhere else hard-codes it', () => {
    const css = fs.readFileSync(`${process.cwd()}/src/styles/global.css`, 'utf8')
    expect(css).toMatch(/--green: #34e07a;/); expect(css).toMatch(/--green-rgb: 52, 224, 122;/)
    const files = fs.readdirSync(`${process.cwd()}/src`, { recursive: true }).filter((f) => /\.(jsx?|css)$/.test(f) && !f.includes('__tests__') && !f.endsWith('global.css'))
    for (const f of files) expect(fs.readFileSync(`${process.cwd()}/src/${f}`, 'utf8').toLowerCase(), f).not.toContain('#34e07a')
  })
})

describe('C-2 SoundGlyph', () => {
  it('on: speaker and two waves, no slash; off: the same speaker with a slash, no waves', () => {
    const on = render(<SoundGlyph on />).container
    expect(on.querySelector('[data-part="speaker"]')).not.toBeNull()
    expect(on.querySelectorAll('[data-part="wave"]')).toHaveLength(2); expect(on.querySelector('[data-part="slash"]')).toBeNull()
    expect(on.firstChild).toMatchSnapshot()
    const off = render(<SoundGlyph on={false} />).container
    expect(off.querySelector('[data-part="speaker"]')).not.toBeNull()
    expect(off.querySelector('[data-part="slash"]')).not.toBeNull(); expect(off.querySelectorAll('[data-part="wave"]')).toHaveLength(0)
    expect(off.firstChild).toMatchSnapshot()
    expect(off.firstChild.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('C-3 SoundToast', () => {
  beforeEach(() => { vi.useFakeTimers(); reduced(false); useSoundStore.setState({ soundOn: false }); useStore.setState(useStore.getInitialState()) })
  afterEach(() => { vi.useRealTimers() })
  it('nothing on mount, with sound off or on', () => {
    render(<SoundToast />); expect(toast()).toBeNull()
    useSoundStore.setState({ soundOn: true })
    const b = render(<SoundToast />); expect(b.container.querySelector('.sound-toast')).toBeNull()
  })
  it('turning sound on: the green glyph, announced, held at full opacity, then fading, gone at 2.5 s', () => {
    render(<SoundToast />)
    act(() => { useSoundStore.getState().setSoundOn(true) })
    expect(toast().dataset.state).toBe('on'); expect(toast().dataset.phase).toBe('hold')
    expect(screen.getByRole('status')).toHaveTextContent('Sound on')
    expect(HOLD_MS).toBe(1000); expect(FADE_MS).toBe(1500)
    act(() => { vi.advanceTimersByTime(999) }); expect(toast().dataset.phase).toBe('hold')
    act(() => { vi.advanceTimersByTime(2) }); expect(toast().dataset.phase).toBe('fade')
    act(() => { vi.advanceTimersByTime(1499) }); expect(toast()).toBeNull()
  })
  it('on → off → on inside 300 ms: one glyph, "on", its clock restarted', () => {
    render(<SoundToast />)
    act(() => { useSoundStore.getState().setSoundOn(true) }); act(() => { vi.advanceTimersByTime(100) })
    act(() => { useSoundStore.getState().setSoundOn(false) })
    expect(toast().dataset.state).toBe('off'); expect(screen.getByRole('status')).toHaveTextContent('Sound off')
    act(() => { vi.advanceTimersByTime(200) })
    act(() => { useSoundStore.getState().setSoundOn(true) })
    expect(document.querySelectorAll('.sound-toast')).toHaveLength(1); expect(toast().dataset.state).toBe('on')
    act(() => { vi.advanceTimersByTime(2499) }); expect(toast()).not.toBeNull()
    act(() => { vi.advanceTimersByTime(1) }); expect(toast()).toBeNull()
  })
  it('reduced motion: no pop (the fade stays — it is not motion)', () => {
    render(<SoundToast />)
    act(() => { useSoundStore.getState().setSoundOn(true) })
    expect(toast().classList.contains('pop')).toBe(true)
    act(() => { vi.advanceTimersByTime(3000) })
    reduced(true)
    act(() => { useSoundStore.getState().setSoundOn(false) })
    expect(toast().classList.contains('pop')).toBe(false)
  })
  it('M and ⌘K "Sound" both show it', () => {
    render(<><Keys /><SoundToast /></>)
    fireEvent.keyDown(window, { code: 'KeyM', key: 'm' })
    expect(toast().dataset.state).toBe('on')
    act(() => { vi.advanceTimersByTime(3000) })
    act(() => { featureCommands().find((c) => c.id === 'f:sound').run() })
    expect(toast().dataset.state).toBe('off')
  })
})
