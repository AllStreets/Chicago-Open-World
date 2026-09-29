// V4 final-review fixes: each test reproduces one reviewer finding.
import { describe, it, expect, beforeEach } from 'vitest'
import * as THREE from 'three'
import { useStore } from '../../state/store.js'
import { followStep, shouldExitFollow } from '../followCam.js'
import { refreshPickBounds } from '../pick.js'
import { stationClickWins } from '../StationHits.jsx'

const none = () => 0
beforeEach(() => useStore.setState(useStore.getInitialState()))

describe('V4 review fixes', () => {
  it('#1 a pick mesh first raycast while empty still hits instances added later', () => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 4)
    m.count = 0
    const ray = new THREE.Raycaster(new THREE.Vector3(50, 10, 0), new THREE.Vector3(0, -1, 0))
    expect(ray.intersectObject(m)).toHaveLength(0)            // caches an empty sphere
    m.setMatrixAt(0, new THREE.Matrix4().makeTranslation(50, 0, 0)); m.count = 1
    refreshPickBounds(m)
    expect(ray.intersectObject(m).length).toBeGreaterThan(0)
  })
  it('#2 a flight or a camera button ends following', () => {
    useStore.getState().startFollow('a'); useStore.getState().startFlight({ position: [0, 1, 0], target: [0, 0, 0] })
    expect(useStore.getState().follow).toBeNull()
    useStore.getState().startFollow('a'); useStore.getState().camCommand('home')
    expect(useStore.getState().follow).toBeNull()
  })
  it('#3 a train missing from the last published frame is looked up before following ends', () => {
    const t = { id: 'a', head: { p: [0, 7.2, 0], dir: [1, 0, 0] }, cars: [] }
    expect(followStep({ trainId: 'a', view: 'chase' }, [], none, (id) => (id === 'a' ? t : null)).pose).toBeTruthy()
    expect(followStep({ trainId: 'a', view: 'chase' }, [], none, () => null)).toEqual({ ended: 'left' })
  })
  it('#4 a train inside a station box wins the click', () => {
    const trainHit = { object: { userData: { trainHits: true } } }, stationHit = { object: { userData: {} } }
    expect(stationClickWins([stationHit, trainHit])).toBe(false)
    expect(stationClickWins([stationHit])).toBe(true)
  })
  it('#5 keyboard use of the HUD does not end following', () => {
    const btn = document.createElement('button')
    expect(shouldExitFollow({ key: 'Tab', target: document.body })).toBe(false)
    expect(shouldExitFollow({ key: 'Enter', target: btn })).toBe(false)
    expect(shouldExitFollow({ key: ' ', target: btn })).toBe(false)
    expect(shouldExitFollow({ key: 'a', target: document.body })).toBe(true)
  })
})
