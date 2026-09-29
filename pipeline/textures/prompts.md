# Texture generation prompts

Model: Z-Image-Turbo (Hugging Face MCP tool `gr1_z_image_turbo_generate`), 1024x1024, 8 steps, shift 3.
Façade suffix used on every façade prompt: `perfectly straight-on orthographic elevation, no perspective, evenly lit overcast daylight, seamless tileable texture, photographic, no sky, no street, no people, no text`

| file | seed | prompt |
|---|---|---|
| loop-limestone.webp | 42 | `Orthographic flat front elevation texture of a Chicago prewar limestone office tower facade, perfectly straight-on, no perspective, evenly lit overcast, repeating grid of identical rectangular windows 4 columns by 4 floors, beige Indiana limestone piers and spandrels, dark glass windows with thin mullions, seamless tileable texture, photographic, no sky, no street, no people` |
| art-deco.webp | 7 | `Chicago 1930 art deco skyscraper facade, pale limestone with strong vertical piers and recessed dark spandrels, repeating grid of tall narrow windows 4 columns by 4 floors,` + suffix |
| prewar-brick.webp | 42 | `Chicago 1910s red-brown brick commercial building facade, repeating grid of double-hung windows with stone sills and lintels, 4 columns by 4 floors,` + suffix |
| curtain-glass.webp | 42 | `modern Chicago skyscraper curtain wall, blue-grey reflective glass panels with thin dark aluminium mullions, regular grid 6 columns by 4 floors,` + suffix |
| precast-concrete.webp | 42 | `1970s precast concrete office building facade, light grey concrete panels with deep-set dark windows, repeating grid 4 columns by 4 floors,` + suffix |
| river-north-loft.webp | 7 | `River North Chicago brick warehouse loft facade, dark red brick with arched windows, black steel window frames, repeating grid 4 columns by 3 floors,` + suffix |
| three-flat-brick.webp | 42 | `Chicago greystone and brick three-flat residential facade, tan brick with limestone trim, repeating grid of paired windows 3 columns by 3 floors,` + suffix |
| industrial.webp | 42 | `Chicago industrial building facade, weathered tan brick with large multi-pane steel factory windows, repeating grid 4 columns by 2 floors,` + suffix |

Ground textures (grass, asphalt, sidewalk, concrete, gravel, sand) are procedural — see `procedural.js` (the ZeroGPU quota ran out after the façades).

Crops in `textures.config.json` were set from `measure.js` (autocorrelation of column/row luminance → window period and pier phase) and checked with 2x2 tiling previews.
