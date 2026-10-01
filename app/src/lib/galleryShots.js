// app/src/lib/galleryShots.js — README gallery filenames: new names only, never an overwrite (B.1.3).
export const GALLERY_TIMES = ['day', 'dusk', 'night']

export function galleryFile({ dir = 'docs/screenshots', milestone, subject, time }) {
  if (!/^v\d+$/.test(milestone ?? '')) throw new Error(`milestone must look like v6, got ${milestone}`)
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(subject ?? '')) throw new Error(`subject must be kebab-case, got ${subject}`)
  if (!GALLERY_TIMES.includes(time)) throw new Error(`time must be day, dusk or night, got ${time}`)
  return `${dir}/${milestone}-${subject}-${time}.png`
}

export function parseGallery(spec) {
  return spec.split(',').map((s) => s.trim()).filter(Boolean).map((item) => {
    const m = /^([a-z0-9]+):([a-z0-9-]+)@(day|dusk|night)$/.exec(item)
    if (!m) throw new Error(`gallery item must be view:subject@time, got ${item}`)
    return { view: m[1], subject: m[2], time: m[3] }
  })
}

export function refuseOverwrite(path, exists) {
  if (exists(path)) throw new Error(`${path} already exists — README images are history; pick a new subject`)
  return path
}

// ── E3-4 / E4-6 (sports pass, 2026-10-01): fixed poses for the README's sports frames ─────────────────────────────
// `sports` pins the venue state (?sports=…); `showcase: [venue, team, msIn]` starts "Play a game" that far in.
export const SPORTS_GALLERY = {
  'united-center': { pose: { position: [-3655, 88, 375], target: [-3846, 44, 150] } },
  'united-center-live': { pose: { position: [-3655, 88, 375], target: [-3846, 44, 150] }, sports: 'live:bulls' },
  'showcase-wrigley': { pose: { position: [-2400, 62, -7255], target: [-2240, 6, -7410] }, showcase: ['wrigleyfield', 'cubs', 42000], card: 'wrigleyfield' },
  'showcase-rate-field': { pose: { position: [-590, 72, 5690], target: [-440, 8, 5845] }, showcase: ['ratefield', 'whitesox', 45000] },
  'showcase-soldier-field': { pose: { position: [1060, 120, 2200], target: [925, 0, 2160] }, showcase: ['soldierfield', 'bears', 47000] },
  'showcase-wrigley-w': { pose: { position: [-2300, 40, -7350], target: [-2222, 28, -7428] }, showcase: ['wrigleyfield', 'cubs', 81000] },
}
export const sportsShotQuery = ({ pose, sports }, time) => `pose=${[...pose.position, ...pose.target].join(',')}&time=${time}&stats${sports ? `&sports=${sports}` : ''}`

// ── B-0 (Lincoln Park pass, 2026-10-01): fixed poses for the "Lincoln Park" README frames, south → north. The frames
// taken before the pass, at the same poses, are docs/screenshots/evolution/before-<subject>-<time>.png.
export const LINCOLN_PARK_GALLERY = {
  'lp-north-avenue-beach': { pose: { position: [420, 45, -3600], target: [290, 0, -3440] } },
  'lp-zoo-mall': { pose: { position: [-320, 85, -4190], target: [-470, 0, -4380] } },
  'lp-south-pond': { pose: { position: [-420, 40, -3930], target: [-500, 6, -4110] } },
  'lp-conservatory': { pose: { position: [-600, 42, -4445], target: [-615, 8, -4690] } },
  'lp-theater-on-the-lake': { pose: { position: [-60, 60, -4890], target: [-240, 0, -5010] } },
  'lp-belmont-waveland': { pose: { position: [-560, 160, -6500], target: [-980, 0, -7350] } },
}
export const poseShotQuery = ({ pose }, time) => `pose=${[...pose.position, ...pose.target].join(',')}&time=${time}`
