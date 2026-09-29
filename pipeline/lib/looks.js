// pipeline/lib/looks.js — sourced colour + material blocks ("looks") for landmarks and tagged buildings (spec B.6).
export const FINISHES = ['glass', 'metal', 'granite', 'limestone', 'terracotta', 'concrete']
// F8 "similar materials": one preset per finish, applied as parameters of the shared façade shader — never a new material.
export const FINISH_PRESETS = {
  glass: { roughness: 0.18, metalness: 0.6 },
  metal: { roughness: 0.35, metalness: 0.75 },
  granite: { roughness: 0.45, metalness: 0.05 },   // polished stone (granite, marble)
  limestone: { roughness: 0.85, metalness: 0 },
  terracotta: { roughness: 0.4, metalness: 0.02 }, // glazed terra cotta; fired brick uses it too
  concrete: { roughness: 0.9, metalness: 0 },
}
export const CROWN_KINDS = ['none', 'flood', 'lantern']

const HEX = /^#[0-9a-f]{6}$/i
export const isHex = (s) => typeof s === 'string' && HEX.test(s)
export function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const httpsList = (v) => { const a = [].concat(v ?? []); return a.length > 0 && a.every((u) => typeof u === 'string' && u.startsWith('https://')) }

export function validateLook(look, key = '?') {
  if (!look || typeof look !== 'object') return [`${key}: no look block`]
  const errs = []
  if (!FINISHES.includes(look.finish)) errs.push(`${key}: finish "${look.finish}" is not one of ${FINISHES.join('|')}`)
  for (const k of ['base', 'glass', 'mullion', 'spandrel']) if (!isHex(look[k])) errs.push(`${key}: ${k} must be #rrggbb`)
  if (look.top !== undefined) {
    if (!isHex(look.top)) errs.push(`${key}: top must be #rrggbb`)
    if (!(look.topM > (look.topFromM ?? 0))) errs.push(`${key}: top needs topM above topFromM`)
  }
  if (!httpsList(look.source)) errs.push(`${key}: source must be one or more https URLs`)
  if (typeof look.material !== 'string' || look.material.length < 8) errs.push(`${key}: material description missing`)
  if (look.parts !== undefined && !(Array.isArray(look.parts) && look.parts.every((p) => typeof p === 'string'))) errs.push(`${key}: parts must be a list of mesh part names`)
  if (look.render === false && !(typeof look.note === 'string' && look.note.length > 0)) errs.push(`${key}: render:false needs a note saying why`)
  const c = look.crownLight
  if (c) {
    if (!CROWN_KINDS.slice(1).includes(c.kind)) errs.push(`${key}: crownLight.kind must be flood|lantern`)
    if (!isHex(c.color)) errs.push(`${key}: crownLight.color must be #rrggbb`)
    if (!(c.fromM >= 0 && c.toM > c.fromM)) errs.push(`${key}: crownLight needs 0 <= fromM < toM`)
    if (!(c.intensity > 0 && c.intensity <= 4)) errs.push(`${key}: crownLight.intensity must be in (0, 4]`)
    if (!httpsList(c.source)) errs.push(`${key}: crownLight.source must be https URL(s)`)
  }
  return errs
}
