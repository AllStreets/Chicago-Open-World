// app/src/world/materials/useGroundMaterials.js — one shared set of ground materials for every tile.
import { useEffect, useState } from 'react'
import { groundMaterials } from './groundMaterials.js'

let cached = null, pending = null
function load() {
  pending ??= fetch('/textures/ground/ground.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((g) => (cached = groundMaterials(g)))
  return pending
}
export function useGroundMaterials() {
  const [m, setM] = useState(cached)
  useEffect(() => { if (!m) load().then(setM) }, [m])
  return m
}
