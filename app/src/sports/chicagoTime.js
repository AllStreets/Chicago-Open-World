// app/src/sports/chicagoTime.js — Chicago wall-clock dates and times, DST-aware, independent of the host time zone.
const TZ = 'America/Chicago'
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' })
const short = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: '2-digit' })

export function chicagoParts(ms) {
  const p = {}
  for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second, weekday: p.weekday }
}
const pad = (n) => String(n).padStart(2, '0')
export function chicagoDate(ms) { const p = chicagoParts(ms); return `${p.year}-${pad(p.month)}-${pad(p.day)}` }
export function offsetMinutes(ms) {
  const p = chicagoParts(ms)
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000) / 60000)
}
// Wall time in Chicago → UTC ms. Two passes settle the offset on DST-change days.
export function chicagoToUtc(date, hour, minute = 0) {
  const [y, m, d] = date.split('-').map(Number)
  const wall = Date.UTC(y, m - 1, d, hour, minute)
  const first = wall - offsetMinutes(wall) * 60000
  return wall - offsetMinutes(first) * 60000
}
export function addDays(date, n) { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10) }
export function weekday(date) { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() }
export const formatChicago = (ms) => short.format(new Date(ms)).replace(/ /g, ' ').replace(',', '')

// When a game is, said the way a person would: "Tonight 7:05 PM", "Tomorrow 1:20 PM", else with its date
// ("Sun Oct 4 12:00 PM") — a weekday alone makes a game weeks away read as this week.
const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
export function whenChicago(ms, nowMs = Date.now()) {
  const d = chicagoDate(ms), today = chicagoDate(nowMs), time = timeFmt.format(new Date(ms)).replace(/\u202f/g, ' ')
  if (d === today) return `${chicagoParts(ms).hour >= 17 ? 'Tonight' : 'Today'} ${time}`
  if (d === addDays(today, 1)) return `Tomorrow ${time}`
  return `${dayFmt.format(new Date(ms)).replace(',', '')} ${time}`
}
