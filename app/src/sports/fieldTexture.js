// app/src/sports/fieldTexture.js — paints every open-air venue into one sRGB DataArrayTexture (layer = slot).
import * as THREE from 'three'
import { fieldMarks } from './fieldMarks.js'
import { paintField } from './paintField.js'

export const FIELD_TEX = { LOW: [1024, 512], HIGH: [2048, 1024], ULTRA: [2048, 1024] }

export function layoutFor(venueKey, sport) {
  if (venueKey === 'wrigleyfield') return 'baseball-wrigley'
  if (venueKey === 'ratefield') return 'baseball-sox'
  return sport === 'soccer' ? 'soccer' : 'football'
}

// Soldier Field is repainted for the Fire when their game is on, or starts within 36 h.
export function fieldSport(st, nowMs) {
  if (st?.game) return st.game.sport
  if (st?.next && Date.parse(st.next.start) - nowMs < 36 * 3600000) return st.next.sport
  return null
}

const domCanvas = (W, H) => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c }

export function buildFieldArray(entries, quality, makeCanvas = domCanvas) {
  const [W, H] = FIELD_TEX[quality] ?? FIELD_TEX.HIGH
  const depth = Math.max(1, ...entries.map((e) => e.slot + 1))
  const data = new Uint8Array(W * H * 4 * depth)
  for (const e of entries) {
    const ctx = makeCanvas(W, H).getContext('2d', { willReadFrequently: true })
    paintField(ctx, fieldMarks(e.layout, e.frame), e.frame, W, H)
    data.set(ctx.getImageData(0, 0, W, H).data, e.slot * W * H * 4)
  }
  const tex = new THREE.DataArrayTexture(data, W, H, depth)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}
