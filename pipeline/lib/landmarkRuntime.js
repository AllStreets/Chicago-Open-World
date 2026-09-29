// pipeline/lib/landmarkRuntime.js — what the app needs at runtime from the landmark builders (landmarks.json).
export function collectRuntime(entries) {
  const out = { version: 1, plazas: [], detached: [] }
  for (const { key, runtime, detached } of entries) {
    for (const [k, v] of Object.entries(runtime ?? {})) {
      if (k === 'plazas') out.plazas.push(...v)
      else if (out[k] !== undefined) throw new Error(`landmark runtime "${k}" defined twice (second by ${key})`)
      else out[k] = v
    }
    for (const d of detached ?? []) out.detached.push({ key: d.key, file: `landmarks/${d.key}.glb`, centre: d.centre })
  }
  return out
}
