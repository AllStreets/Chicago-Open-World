// app/src/lib/seasons.js — Chicago's trees follow the real calendar.
const P = {
  bare: ['#5b4a3c', '#6a5646', '#4d3f34'],
  spring: ['#9bc46a', '#86b85a', '#a9cf78', '#7fae52'],
  summer: ['#3f6d33', '#4a7a3a', '#365f2d', '#557f40'],
  sept: ['#4a7a3a', '#3f6d33', '#557f40', '#6d8a3a', '#c9a23a'],
  oct: ['#c8702a', '#d9922f', '#b5452a', '#e0b23a', '#8f6b2c', '#6d8a3a'],
  nov: ['#8f6b2c', '#6e5238', '#a0612a', '#5b4a3c'],
}
export function treePalette(month) {
  if ([12, 1, 2, 3].includes(month)) return { canopy: P.bare, bare: true, density: 0 }
  if ([4, 5].includes(month)) return { canopy: P.spring, bare: false, density: 0.85 }
  if ([6, 7, 8].includes(month)) return { canopy: P.summer, bare: false, density: 1 }
  if (month === 9) return { canopy: P.sept, bare: false, density: 1 }
  if (month === 10) return { canopy: P.oct, bare: false, density: 0.9 }
  return { canopy: P.nov, bare: false, density: 0.5 }
}
export function chicagoMonth(date = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'numeric' }).format(date))
}
