// pipeline/tests/materialLook.test.js — material rows carry their glass/mullion/spandrel colours and night light.
import { describe, it, expect } from 'vitest'
import { materialLook, styleEntry } from '../lib/styles.js'

describe('materialLook', () => {
  it('keeps a row\'s own glass, mullion and spandrel colours (falling back to its base)', () => {
    expect(materialLook({ finish: 'glass', base: '#111111', glass: '#4f86c8', mullion: '#0e1114' })).toMatchObject({ glass: '#4f86c8', mullion: '#0e1114', spandrel: '#111111' })
    expect(materialLook({ finish: 'metal', base: '#222222' })).toMatchObject({ glass: '#222222', mullion: '#222222', spandrel: '#222222' })
  })
  it('passes a row\'s floodlight through, so sculpted detail lights with its building at night', () => {
    const row = { key: 'wrigley-terracotta', finish: 'terracotta', base: '#d9d1c1', crownLight: { kind: 'flood', color: '#fff3dc', fromM: 0, toM: 140, intensity: 1 } }
    expect(styleEntry(row.key, materialLook(row)).crown).toMatchObject({ kind: 'flood', fromM: 0, toM: 140 })
  })
})
