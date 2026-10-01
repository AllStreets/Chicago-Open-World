# X-0 visual parity (plan §6.1 V1–V5)

Before = the committed 199.7 MB world; after = the X-0 world. Same app code, same pose, same fixed clock; every `/world/*` request answered from the world under test (`app/e2e/parity.spec.js`). 1920 × 1080 at DPR 1 and 2; detail poses at DPR 2, cropped 1100 × 900 at native resolution (2× zoom). Pairs: `pairs/<pose>.jpg` (left before, right after). Not linked from the README.

Gate: pixel-diff ratio ≤ 3 % (hero-view's `maxDiffPixelRatio`, YIQ threshold 0.2) **and** SSIM ≥ 0.995. Water, cloud and light animation move between any two captures, so a second capture of the *before* world (the noise column) shows the floor; a pose below 0.995 passes only if it is within 0.0005 of its own noise floor.

| pose | diff % | SSIM | noise diff % | noise SSIM | result |
|---|---:|---:|---:|---:|---|
| detail-chess-pavilion@2x | 0.000 | 0.99984 | 0.000 | 1.00000 | pass |
| detail-crown-fountain@2x | 0.000 | 0.99980 | 0.000 | 0.99996 | pass |
| detail-dusable-bridgehouses@2x | 0.000 | 0.99239 | 0.012 | 0.97051 | pass |
| detail-marina-petals@2x | 0.000 | 0.99982 | 0.000 | 1.00000 | pass |
| detail-pilsen-murals@2x | 0.000 | 0.99981 | 0.000 | 1.00000 | pass |
| detail-tribune-crown@2x | 0.000 | 0.99990 | 0.000 | 0.99993 | pass |
| detail-trump-glass@2x | 0.000 | 0.99987 | 0.000 | 1.00000 | pass |
| detail-water-tower@2x | 0.000 | 0.99971 | 0.000 | 1.00000 | pass |
| detail-willis-setbacks@2x | 0.000 | 0.99994 | 0.000 | 0.99999 | pass |
| detail-wrigley-clock@2x | 0.000 | 0.99987 | 0.000 | 1.00000 | pass |
| hancock-day@1x | 0.000 | 0.99970 | 0.000 | 0.99962 | pass |
| hancock-day@2x | 0.000 | 0.99837 | 0.000 | 0.99970 | pass |
| hancock-night@1x | 0.005 | 0.99907 | 0.001 | 0.99936 | pass |
| hancock-night@2x | 0.001 | 0.99970 | 0.000 | 0.99990 | pass |
| loop-day-minimap@1x | 0.000 | 0.99990 | 0.000 | 0.99946 | pass |
| loop-day-minimap@2x | 0.000 | 0.99913 | 0.000 | 0.99854 | pass |
| loop-day@1x | 0.000 | 0.99976 | 0.000 | 0.99879 | pass |
| loop-day@2x | 0.000 | 0.99933 | 0.000 | 0.99588 | pass |
| loop-night@1x | 0.011 | 0.99567 | 0.012 | 0.99586 | pass |
| loop-night@2x | 0.003 | 0.99867 | 0.002 | 0.99918 | pass |
| museum-day@1x | 0.000 | 0.99977 | 0.000 | 0.99993 | pass |
| museum-day@2x | 0.000 | 0.99973 | 0.000 | 0.99983 | pass |
| museum-night@1x | 0.008 | 0.99607 | 0.007 | 0.99660 | pass |
| museum-night@2x | 0.002 | 0.99899 | 0.003 | 0.99889 | pass |
| navypier-day@1x | 0.010 | 0.98695 | 0.003 | 0.99367 | **FAIL** |
| navypier-day@2x | 0.002 | 0.99327 | 0.006 | 0.98722 | pass |
| navypier-night@1x | 0.016 | 0.99339 | 0.040 | 0.99017 | pass |
| navypier-night@2x | 0.019 | 0.99431 | 0.015 | 0.99468 | pass |
| river-day@1x | 0.000 | 0.99989 | 0.000 | 0.99988 | pass |
| river-day@2x | 0.000 | 0.99939 | 0.002 | 0.99840 | pass |
| river-night@1x | 0.006 | 0.99784 | 0.007 | 0.99726 | pass |
| river-night@2x | 0.002 | 0.99902 | 0.005 | 0.99894 | pass |
| streeterville-day@1x | 0.000 | 0.99984 | 0.000 | 0.99939 | pass |
| streeterville-day@2x | 0.000 | 0.99660 | 0.000 | 0.99812 | pass |
| streeterville-night@1x | 0.024 | 0.99043 | 0.012 | 0.99454 | **FAIL** |
| streeterville-night@2x | 0.021 | 0.99212 | 0.004 | 0.99889 | **FAIL** |
| westloop-day@1x | 0.000 | 0.99991 | 0.000 | 1.00000 | pass |
| westloop-day@2x | 0.441 | 0.98362 | 0.441 | 0.98386 | pass |
| westloop-night@1x | 0.004 | 0.99836 | 0.003 | 0.99829 | pass |
| westloop-night@2x | 0.001 | 0.99961 | 0.001 | 0.99960 | pass |
| willis-day@1x | 0.001 | 0.99990 | 0.000 | 0.99998 | pass |
| willis-day@2x | 0.000 | 0.99992 | 0.000 | 0.99996 | pass |
| willis-night@1x | 0.006 | 0.99709 | 0.007 | 0.99716 | pass |
| willis-night@2x | 0.002 | 0.99933 | 0.002 | 0.99928 | pass |
| wrigleyville-day@1x | 0.000 | 0.99995 | 0.000 | 1.00000 | pass |
| wrigleyville-day@2x | 0.000 | 0.99995 | 0.000 | 1.00000 | pass |
| wrigleyville-night@1x | 0.001 | 0.99945 | 0.001 | 0.99957 | pass |
| wrigleyville-night@2x | 0.000 | 0.99988 | 0.000 | 0.99990 | pass |

**45 / 48 poses pass.**

The three below the SSIM gate (navypier-day@1x, streeterville-night@1x and @2x; pixel diff ≤ 0.024 %) were inspected as ×8 amplified difference images: every differing pixel lies on animated water (the lake surface and its reflections of lit windows) — the same regions that differ in the noise run, larger here only because the water's phase depends on how long the scene took to load. Every pier, building, road and tree pixel is identical. Reviewed manually at 2× on the detail crops (Tribune crown, Wrigley clock, Marina petals, Water Tower, Chess Pavilion, Willis setbacks, Trump glass, DuSable bridge houses, Crown Fountain, Pilsen murals) and the minimap: no visible change.

Savings measured and rejected for artefacts (V5), with their pairs: [rejected.md](rejected.md).

## V2 — quantisation error against the unquantised build (every tile and block glb)

Measured by `QUANT_REPORT` in `build-world.js` (`quantizationError`, `pipeline/lib/tilepack.js`): each source vertex against its quantised self.

| LOD | files | layer | bits | vertices | max position error | max normal error | max UV error | integer customs exact | max fractional custom error |
|---|---:|---|---:|---:|---:|---:|---:|---|---:|
| lod0 | 512 | buildings | 14 | 7,004,640 | 12.28 cm | 0.092° | 1.95 mm | yes | 1.4e-4 |
| lod0 | 512 | ground | 14 | 1,395,549 | 6.64 cm | 0.000° | 1.95 mm | yes | 0.0e+0 |
| lod0 | 512 | transit | 14 | 4,036,458 | 3.22 cm | 0.093° | 0.00 mm | yes | 0.0e+0 |
| lod0 | 512 | ties | 14 | 1,833,240 | 2.88 cm | 0.000° | 0.00 mm | yes | 0.0e+0 |
| lod0 | 512 | glow | 14 | 194,028 | 2.98 cm | 0.090° | 0.00 mm | yes | 2.6e-4 |
| lod0 | 512 | stations | 14 | 100,371 | 2.90 cm | 0.072° | 0.00 mm | yes | 0.0e+0 |
| lod0 | 512 | water | 14 | 25,938 | 2.65 cm | 0.000° | 1.95 mm | yes | 6.5e-5 |
| lod0 | 512 | leaves | 14 | 114,768 | 3.04 cm | 0.090° | 1.95 mm | yes | 1.3e-4 |
| lod1 | 512 | buildings | 14 | 3,030,720 | 12.28 cm | 0.092° | 1.95 mm | yes | 1.4e-4 |
| lod1 | 512 | ground | 14 | 796,194 | 6.74 cm | 0.000° | 1.95 mm | yes | 0.0e+0 |
| lod1 | 512 | glow | 14 | 12,738 | 11.21 cm | 0.086° | 0.00 mm | yes | 2.6e-4 |
| lod1 | 512 | water | 14 | 25,938 | 2.65 cm | 0.000° | 1.95 mm | yes | 6.5e-5 |
| block | 99 | buildings | 14 | 4,538,700 | 18.57 cm | 0.092° | 1.95 mm | yes | 1.4e-4 |
| block | 99 | ground | 14 | 796,194 | 12.78 cm | 0.000° | 1.95 mm | yes | 0.0e+0 |
| block | 99 | water | 14 | 25,938 | 10.28 cm | 0.000° | 1.95 mm | yes | 6.5e-5 |
| block | 99 | glow | 14 | 12,738 | 15.73 cm | 0.086° | 0.00 mm | yes | 2.6e-4 |

Normals 10 bits, custom attributes unfiltered (integer ids exact; `_SEED` and glow intensity keep the 12-bit quantisation they always had), UVs in metres snapped to 1/256 m (≤ 2 mm; the Crown Fountain faces, painted fields and murals keep exact UVs). Positions keep the 14 bits per mesh volume every baseline was taken with — the same error as the committed world. V2's 16-bit / ≤ 1 cm position limit was built and measured (all LODs inside their limits, +0.3 MB), then **rejected for parity (V5)**: the corrected geometry moves edges by up to a pixel (SSIM 0.956–0.99 on detail poses, noise floor ≥ 0.9999). See [rejected.md](rejected.md).

## V3 — minimap

minimap.png (before) vs minimap.webp (after), 2048 × 2048: ΔE2000 average 0.000, maximum 0.000 (limits 2 / 5). Lossless WebP — every pixel identical. The 256-colour palette PNG (1.19 MB) was rejected: ΔE2000 max 8.4.

