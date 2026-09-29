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
