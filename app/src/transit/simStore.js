// app/src/transit/simStore.js — one simulator per loaded transit.json, and the train list from the last frame
// (the follow cam, cards and audio read it instead of re-simulating).
import { createSim } from './sim.js'
import { useStore } from '../state/store.js'

let sim = null, trains = []
export function getSim() {
  const t = useStore.getState().transit
  if (!t?.services || !t.servicePeriods || !t.rollingStock) return null
  if (!sim || sim.transit !== t) sim = createSim(t)
  return sim
}
export const publishTrains = (list) => { trains = list }
export const getTrains = () => trains
