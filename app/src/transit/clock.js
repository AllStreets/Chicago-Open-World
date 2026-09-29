// app/src/transit/clock.js — Chicago wall-clock time, and which service period it falls in.
const FMT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' })
const partsOf = (ms) => Object.fromEntries(FMT.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
const hoursOf = (p, ms) => +p.hour + +p.minute / 60 + +p.second / 3600 + (((ms % 1000) + 1000) % 1000) / 3600000

export function chicagoClock(ms) {
  const p = partsOf(ms), hours = hoursOf(p, ms)
  let midnightMs = ms - Math.round(hours * 3600000)
  const h2 = hoursOf(partsOf(midnightMs), midnightMs) // on DST days wall-clock hours ≠ elapsed hours: correct once
  if (h2 !== 0) midnightMs -= Math.round((h2 >= 12 ? h2 - 24 : h2) * 3600000)
  return { date: `${p.year}-${p.month}-${p.day}`, hours, weekday: p.weekday, weekend: p.weekday === 'Sat' || p.weekday === 'Sun', midnightMs }
}

export function periodOf(clock, periods) {
  const table = clock.weekend ? periods.weekend : periods.weekday
  return (table.find(([, a, b]) => clock.hours >= a && clock.hours < b) ?? table[0])[0]
}
