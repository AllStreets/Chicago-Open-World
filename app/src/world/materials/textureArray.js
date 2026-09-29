// app/src/world/materials/textureArray.js — N images → one DataArrayTexture.
import * as THREE from 'three'

export function packLayers(layers, size) {
  const row = size * 4
  const out = new Uint8Array(layers.length * size * row)
  layers.forEach((px, l) => {
    const base = l * size * row
    for (let y = 0; y < size; y++) out.set(px.subarray((size - 1 - y) * row, (size - y) * row), base + y * row)
  })
  return out
}

function loadImagePixels(url, size) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const grey = () => resolve(new Uint8ClampedArray(size * size * 4).fill(128))
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = size
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, size, size)
      resolve(g.getImageData(0, 0, size, size).data)
    }
    img.onerror = () => { console.warn(`texture failed: ${url}`); grey() }
    img.src = url
  })
}

export async function loadLayerArray(urls, size, { srgb = true } = {}) {
  const layers = await Promise.all(urls.map((u) => loadImagePixels(u, size)))
  const tex = new THREE.DataArrayTexture(packLayers(layers, size), size, size, layers.length)
  tex.format = THREE.RGBAFormat
  tex.type = THREE.UnsignedByteType
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 8
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}
