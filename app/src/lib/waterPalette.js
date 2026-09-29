// app/src/lib/waterPalette.js — every water colour as a function of sun elevation (one hue shore → horizon),
// and the St. Patrick's Day green river.
import * as THREE from 'three'
import { paletteFor } from './skyPalette.js'

const SHALLOW = new THREE.Color('#3d7a7e')
const FOAM = new THREE.Color('#dfe8e6')
const GREEN = new THREE.Color('#1f9e5a')

export function waterPalette(elev) {
  const p = paletteFor(elev)
  return {
    deep: p.water.clone(),
    shallow: p.water.clone().lerp(SHALLOW, 0.45 * (1 - 0.7 * p.night)),
    horizon: p.fog.clone().lerp(p.hemiSky, 0.55), // the sky just above the water line: bluer than the haze
    sky: p.hemiSky.clone(),
    foam: FOAM.clone().multiplyScalar(0.25 + 0.75 * (1 - p.night)),
    green: GREEN.clone().multiplyScalar(0.3 + 0.7 * (1 - p.night)),
    sunColor: p.sunColor.clone(),
    night: p.night,
  }
}

export function isGreenRiverDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'numeric', day: 'numeric' }).formatToParts(date)
  const get = (t) => Number(parts.find((x) => x.type === t).value)
  return get('month') === 3 && get('day') === 17
}
