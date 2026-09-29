// pipeline/textures/process.js — raw generated images → app textures.
import sharp from 'sharp'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeSeamless, windowMaskFromLuma, windowMaskFromChroma } from './seamless.js'
import { proceduralTexture } from './procedural.js'
import { FACADE_FAMILIES } from '../lib/classify.js'
import { FLOOR_M } from '../lib/height.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const RAW = join(HERE, 'raw')
const OUT = join(HERE, '..', '..', 'app', 'public', 'textures')
const SIZE = 1024
const cfg = JSON.parse(readFileSync(join(HERE, 'textures.config.json'), 'utf8'))
mkdirSync(join(OUT, 'facades'), { recursive: true })
mkdirSync(join(OUT, 'ground'), { recursive: true })
const rgbOut = (data, ch = 3) => sharp(Buffer.from(data), { raw: { width: SIZE, height: SIZE, channels: ch } })

const facades = []
for (const [index, family] of FACADE_FAMILIES.entries()) {
  const c = cfg.facades[family]
  if (!c) throw new Error(`textures.config.json missing façade ${family}`)
  const [left, top, width, height] = c.crop
  const base = sharp(join(RAW, c.raw)).extract({ left, top, width, height }).resize(SIZE, SIZE, { fit: 'fill' })
  const { data } = await base.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true })
  await rgbOut(makeSeamless(data, SIZE, SIZE, 3, 24)).jpeg({ quality: 88 }).toFile(join(OUT, 'facades', `${family}.jpg`))
  let mask
  if (c.allGlass) mask = new Uint8Array(SIZE * SIZE).fill(215)
  else if (c.mask === 'chroma') {
    const { data: rgb } = await base.clone().removeAlpha().blur(2.5).raw().toBuffer({ resolveWithObject: true })
    mask = windowMaskFromChroma(rgb, c.lo, c.hi)
  } else {
    const { data: luma } = await base.clone().greyscale().blur(1.2).raw().toBuffer({ resolveWithObject: true })
    mask = windowMaskFromLuma(luma, c.lo, c.hi)
  }
  await rgbOut(makeSeamless(mask, SIZE, SIZE, 1, 24), 1).png().toFile(join(OUT, 'facades', `${family}-win.png`))
  const tileH = c.floors * (c.floorM ?? FLOOR_M)
  facades.push({ family, index, albedo: `facades/${family}.jpg`, win: `facades/${family}-win.png`,
    tileW: +(tileH * (width / height)).toFixed(2), tileH: +tileH.toFixed(2), bays: c.bays, floors: c.floors })
  console.log(`  ✓ ${family}`)
}
writeFileSync(join(OUT, 'facades', 'facades.json'), JSON.stringify(facades, null, 2))

const ground = {}
for (const [name, c] of Object.entries(cfg.ground)) {
  let data
  if (c.procedural) data = proceduralTexture(c.procedural, SIZE)
  else data = makeSeamless((await sharp(join(RAW, c.raw)).resize(SIZE, SIZE, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })).data, SIZE, SIZE, 3, 64)
  await rgbOut(data).jpeg({ quality: 85 }).toFile(join(OUT, 'ground', `${name}.jpg`))
  ground[name] = { file: `ground/${name}.jpg`, sizeM: c.sizeM }
  console.log(`  ✓ ${name}`)
}
writeFileSync(join(OUT, 'ground', 'ground.json'), JSON.stringify(ground, null, 2))
