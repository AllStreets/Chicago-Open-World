// app/src/lib/openingHours.js — today's hours from an OSM opening_hours string, in plain words ("Open today 11 am – 10 pm").
// Covers the common forms: day ranges and lists (Mo-Fr, Sa,Su), rules without days (every day), several time ranges,
// past-midnight closing, 24/7 and "off"; later rules override earlier ones for the same day. Anything else → null.
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function daySet(spec) {
  const out = new Set()
  for (const part of spec.split(',')) {
    const m = /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/.exec(part.trim())
    if (!m) return null
    const a = DAYS.indexOf(m[1]), b = m[2] ? DAYS.indexOf(m[2]) : a
    for (let d = a; ; d = (d + 1) % 7) { out.add(d); if (d === b) break }
  }
  return out
}

const clock = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  if (h === 12 && m === 0) return 'noon'
  if ((h === 0 || h === 24) && m === 0) return 'midnight'
  const hh = h % 12 === 0 ? 12 : h % 12, ap = h % 24 < 12 ? 'am' : 'pm'
  return `${hh}${m ? `:${String(m).padStart(2, '0')}` : ''} ${ap}`
}

export function hoursToday(spec, date = new Date()) {
  if (!spec || typeof spec !== 'string') return null
  const s = spec.trim()
  if (s === '24/7') return 'Open 24 hours'
  const today = date.getDay()
  let result, matched = false
  for (const raw of s.split(';')) {
    const rule = raw.trim()
    if (!rule || /^PH\b|^SH\b/.test(rule)) continue // public/school holidays: not today's routine
    const m = /^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?)+)?\s*(.*)$/.exec(rule)
    const days = m[1] ? daySet(m[1].replace(/,$/, '')) : new Set([0, 1, 2, 3, 4, 5, 6])
    const times = m[2].trim()
    if (!days) return null
    if (times === 'off' || times === 'closed') { if (days.has(today)) { result = 'Closed today'; matched = true } continue }
    if (times === '00:00-24:00' || times === '24/7') { if (days.has(today)) { result = 'Open 24 hours'; matched = true } continue }
    const ranges = times.split(',').map((r) => /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\+?$/.exec(r.trim()))
    if (!ranges.length || ranges.some((r) => !r)) return null
    if (days.has(today)) { result = `Open today ${ranges.map((r) => `${clock(r[1])} – ${clock(r[2])}`).join(', ')}`; matched = true }
  }
  if (matched) return result
  return 'Closed today' // every rule parsed, none covers today
}
