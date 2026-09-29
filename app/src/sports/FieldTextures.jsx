// app/src/sports/FieldTextures.jsx — repaints the field array when venues, the layout or the quality change.
import { useEffect } from 'react'
import { useSports } from './sportsStore.js'
import { useStore } from '../state/store.js'
import { buildFieldArray, layoutFor, fieldSport } from './fieldTexture.js'
import { facadeUniforms, setFieldFrames } from '../world/materials/facadeMaterial.js'

export default function FieldTextures() {
  const venues = useSports((s) => s.venues)
  const states = useSports((s) => s.states)
  const quality = useStore((s) => s.quality)
  const entries = venues.filter((v) => v.frame).map((v) => ({ slot: v.slot, frame: v.frame, layout: layoutFor(v.key, fieldSport(states[v.key], Date.now())) }))
  const key = `${quality}|${entries.map((e) => `${e.slot}:${e.layout}`).join(',')}`
  useEffect(() => {
    if (!entries.length) return
    const old = facadeUniforms.uFieldTex.value
    facadeUniforms.uFieldTex.value = buildFieldArray(entries, quality)
    setFieldFrames(entries)
    old.dispose?.()
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
