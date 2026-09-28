import { describe, it, expect } from 'vitest'
import { clampCamera, glideVector, MIN_ALT, MAX_DIST } from '../cameraMath.js'

describe('clampCamera', () => {
  it('lifts the camera to minimum altitude', () => {
    expect(clampCamera([0, -50, 0], [0, 0, -10]).position[1]).toBe(MIN_ALT)
  })
  it('keeps the target on or above ground', () => {
    expect(clampCamera([0, 200, 0], [0, -20, -10]).target[1]).toBe(0)
  })
  it('limits camera-target distance', () => {
    const { position, target } = clampCamera([0, 9000, 0], [0, 0, 0])
    expect(Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2])).toBeCloseTo(MAX_DIST)
  })
  it('limits how far the target wanders from the origin', () => {
    const { target } = clampCamera([10000, 200, 0], [9000, 0, 0])
    expect(Math.hypot(target[0], target[2])).toBeCloseTo(MAX_DIST)
  })
  it('passes a valid pose through unchanged', () => {
    expect(clampCamera([100, 200, 300], [0, 0, 0])).toEqual({ position: [100, 200, 300], target: [0, 0, 0] })
  })
})

describe('glideVector', () => {
  it('W moves toward where the camera looks (azimuth 0 = looking north, -Z)', () => {
    const [dx, dz] = glideVector(new Set(['KeyW']), 0)
    expect(dx).toBeCloseTo(0); expect(dz).toBeCloseTo(-1)
  })
  it('D strafes right (east when looking north)', () => {
    const [dx] = glideVector(new Set(['KeyD']), 0)
    expect(dx).toBeCloseTo(1)
  })
  it('diagonal is normalized; no keys is zero', () => {
    const v = glideVector(new Set(['KeyW', 'KeyD']), 0)
    expect(Math.hypot(...v)).toBeCloseTo(1)
    expect(glideVector(new Set(), 0)).toEqual([0, 0])
  })
})
