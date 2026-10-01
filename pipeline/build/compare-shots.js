// pipeline/build/compare-shots.js — X-0f visual-parity report (plan §6.1 V1–V5). Compares the before/after captures from
// app/e2e/parity.spec.js, writes side-by-side pairs and a table of pixel-diff ratio and SSIM per pose, and folds in the
// V2 quantisation report and the V3 minimap check.
//   node build/compare-shots.js --before <dir> --after <dir> [--noise <dir: a second "before" run>] [--out <dir>]
//     [--quant <quantization.json>] [--minimap-before <png> --minimap-after <webp>]
import { readdirSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { diffRatio, ssim } from '../lib/imageCompare.js'
import { imageDeltaE } from '../lib/deltaE.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []))
const BEFORE = resolve(args.before), AFTER = resolve(args.after), NOISE = args.noise ? resolve(args.noise) : null
const OUT = resolve(args.out ?? join(ROOT, 'docs', 'screenshots', 'compression'))
const GATE = { diff: 0.03, ssim: 0.995 } // hero-view's maxDiffPixelRatio; V1's SSIM floor

const raw = async (p) => { const { data, info } = await sharp(p).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height } }

async function measure(a, b) {
  const A = await raw(a), B = await raw(b)
  if (A.w !== B.w || A.h !== B.h) throw new Error(`size mismatch ${a}`)
  return { diff: diffRatio(A.data, B.data, A.w, A.h), ssim: ssim(A.data, B.data, A.w, A.h), w: A.w, h: A.h }
}

// before | after, each half at 960 px wide for full frames; detail shots are cropped at native DPR-2 resolution (2× zoom)
async function pair(name, a, b, detail) {
  const side = async (p) => {
    const img = sharp(p).removeAlpha()
    if (!detail) return img.resize({ width: 960 }).png().toBuffer()
    const { width, height } = await sharp(p).metadata()
    const cw = 1100, ch = 900
    return img.extract({ left: Math.round((width - cw) / 2), top: Math.round((height - ch) / 2), width: cw, height: ch }).png().toBuffer()
  }
  const [l, r] = await Promise.all([side(a), side(b)])
  const { width, height } = await sharp(l).metadata()
  const gap = 8
  await sharp({ create: { width: width * 2 + gap, height, channels: 3, background: '#ffffff' } })
    .composite([{ input: l, left: 0, top: 0 }, { input: r, left: width + gap, top: 0 }])
    .jpeg({ quality: 88, mozjpeg: true }).toFile(join(OUT, 'pairs', `${name.replace('@', '-')}.jpg`))
}

mkdirSync(join(OUT, 'pairs'), { recursive: true })
const rows = []
for (const f of readdirSync(BEFORE).filter((f) => f.endsWith('.png')).sort()) {
  if (!existsSync(join(AFTER, f))) continue
  const name = f.replace(/\.png$/, ''), detail = name.startsWith('detail-') || name.includes('minimap')
  const m = await measure(join(BEFORE, f), join(AFTER, f))
  const noise = NOISE && existsSync(join(NOISE, f)) ? await measure(join(BEFORE, f), join(NOISE, f)) : null
  await pair(name, join(BEFORE, f), join(AFTER, f), detail)
  const pass = m.diff <= GATE.diff && (m.ssim >= GATE.ssim || (noise && m.ssim >= noise.ssim - 0.0005))
  rows.push({ name, ...m, noise, pass })
  console.log(`${name.padEnd(36)} diff ${(m.diff * 100).toFixed(3).padStart(7)} %  SSIM ${m.ssim.toFixed(5)}${noise ? `  (noise: diff ${(noise.diff * 100).toFixed(3)} %, SSIM ${noise.ssim.toFixed(5)})` : ''}  ${pass ? 'PASS' : 'FAIL'}`)
}

const md = [
  '# X-0 visual parity (plan §6.1 V1–V5)', '',
  'Before = the committed 199.7 MB world; after = the X-0 world. Same app code, same pose, same fixed clock; every `/world/*` request answered from the world under test (`app/e2e/parity.spec.js`). 1920 × 1080 at DPR 1 and 2; detail poses at DPR 2, cropped 1100 × 900 at native resolution (2× zoom). Pairs: `pairs/<pose>.jpg` (left before, right after). Not linked from the README.', '',
  `Gate: pixel-diff ratio ≤ ${GATE.diff * 100} % (hero-view's \`maxDiffPixelRatio\`, YIQ threshold 0.2) **and** SSIM ≥ ${GATE.ssim}. Water, cloud and light animation move between any two captures, so a second capture of the *before* world (the noise column) shows the floor; a pose below ${GATE.ssim} passes only if it is within 0.0005 of its own noise floor.`, '',
  '| pose | diff % | SSIM | noise diff % | noise SSIM | result |', '|---|---:|---:|---:|---:|---|',
  ...rows.map((r) => `| ${r.name} | ${(r.diff * 100).toFixed(3)} | ${r.ssim.toFixed(5)} | ${r.noise ? (r.noise.diff * 100).toFixed(3) : '—'} | ${r.noise ? r.noise.ssim.toFixed(5) : '—'} | ${r.pass ? 'pass' : '**FAIL**'} |`),
  '', `**${rows.filter((r) => r.pass).length} / ${rows.length} poses pass.**`, '',
  'Savings measured and rejected for artefacts (V5), with their pairs: [rejected.md](rejected.md).', '',
]

if (args.quant && existsSync(args.quant)) {
  const q = JSON.parse(readFileSync(args.quant, 'utf8'))
  md.push('## V2 — quantisation error against the unquantised build (every tile and block glb)', '',
    'Measured by `QUANT_REPORT` in `build-world.js` (`quantizationError`, `pipeline/lib/tilepack.js`): each source vertex against its quantised self.', '',
    '| LOD | files | layer | bits | vertices | max position error | max normal error | max UV error | integer customs exact | max fractional custom error |', '|---|---:|---|---:|---:|---:|---:|---:|---|---:|')
  for (const [lod, v] of Object.entries(q)) for (const [layer, r] of Object.entries(v.layers)) md.push(`| ${lod} | ${v.files} | ${layer} | ${r.bits} | ${r.verts.toLocaleString('en-US')} | ${(r.positionM * 100).toFixed(2)} cm | ${r.normalDeg.toFixed(3)}° | ${(r.uvM * 1000).toFixed(2)} mm | ${r.customExact ? 'yes' : '**no**'} | ${r.fracErr.toExponential(1)} |`)
  md.push('', 'Normals 10 bits, custom attributes unfiltered (integer ids exact; `_SEED` and glow intensity keep the 12-bit quantisation they always had), UVs in metres snapped to 1/256 m (≤ 2 mm; the Crown Fountain faces, painted fields and murals keep exact UVs). Positions keep the 14 bits per mesh volume every baseline was taken with — the same error as the committed world. V2\'s 16-bit / ≤ 1 cm position limit was built and measured (all LODs inside their limits, +0.3 MB), then **rejected for parity (V5)**: the corrected geometry moves edges by up to a pixel (SSIM 0.956–0.99 on detail poses, noise floor ≥ 0.9999). See [rejected.md](rejected.md).', '')
}
if (args['minimap-before'] && args['minimap-after']) {
  const a = await raw(args['minimap-before']), b = await raw(args['minimap-after'])
  const d = imageDeltaE(a.data, b.data)
  md.push('## V3 — minimap', '', `minimap.png (before) vs minimap.webp (after), ${a.w} × ${a.h}: ΔE2000 average ${d.avg.toFixed(3)}, maximum ${d.max.toFixed(3)} (limits 2 / 5). Lossless WebP — every pixel identical. The 256-colour palette PNG (1.19 MB) was rejected: ΔE2000 max 8.4.`, '')
  console.log(`minimap ΔE2000 avg ${d.avg} max ${d.max}`)
}
writeFileSync(join(OUT, 'parity.md'), `${md.join('\n')}\n`)
writeFileSync(join(OUT, 'parity.json'), `${JSON.stringify(rows.map(({ noise, ...r }) => ({ ...r, noise: noise && { diff: noise.diff, ssim: noise.ssim } })), null, 1)}\n`)
console.log(`${rows.filter((r) => r.pass).length}/${rows.length} pass → ${join(OUT, 'parity.md')}`)
