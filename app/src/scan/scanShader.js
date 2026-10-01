// app/src/scan/scanShader.js — Scan's look (P5 · I-5.4, spec §7), one uniform set shared by the façade and ground
// materials (no mesh swaps): inside the sweep the city turns to near-black massing with cyan (--accent) creases,
// floor lines every 3.8 m and a fresnel rim; the ground gets a 100 m cyan grid; a bright ring marks the moving front.
import * as THREE from 'three'

export const scanUniforms = {
  uScan: { value: 0 },
  uScanRadius: { value: 0 },
  uScanOrigin: { value: new THREE.Vector2() },
  uScanAccent: { value: new THREE.Color('#45d8ff') },
  uScanMax: { value: 9000 },
}

export const SCAN_HEAD = /* glsl */ `
uniform float uScan;
uniform float uScanRadius;
uniform vec2 uScanOrigin;
uniform vec3 uScanAccent;
uniform float uScanMax;
// screen-space derivatives are taken at the top of main (uniform control flow — ANGLE/D3D safe), read in the branch
float gScanCrease; float gScanFw; vec2 gScanGw;
float scanAmount(vec2 p) {
  float d = distance(p, uScanOrigin);
  return uScan * (1.0 - smoothstep(uScanRadius - 80.0, uScanRadius + 80.0, d));
}
float scanRing(vec2 p) {
  if (uScanRadius >= uScanMax - 1.0 || uScanRadius <= 1.0) return 0.0; // only while the front moves
  float d = distance(p, uScanOrigin) - uScanRadius;
  return exp(-d * d / 1600.0);
}
`

// first thing in main: the derivatives the Scan look needs
export const SCAN_FACADE_DERIV = /* glsl */ `
gScanCrease = clamp(length(fwidth(normalize(vWNormal))) * 3.0, 0.0, 1.0);
gScanFw = max(fwidth(vWPos.y / 3.8), 1e-4);
`
export const SCAN_GROUND_DERIV = /* glsl */ `
gScanGw = max(fwidth(vGWPos.xz / 100.0), vec2(1e-4));
`

// after <dithering_fragment>: vWPos / vWNormal are the façade's world varyings, `normal` the view-space normal
export const SCAN_FACADE = /* glsl */ `
{
  float sk = scanAmount(vWPos.xz), ring = scanRing(vWPos.xz);
  if (sk > 0.001 || ring > 0.001) {
    vec3 n = normalize(vWNormal);
    float crease = gScanCrease;
    float f = vWPos.y / 3.8, fw = gScanFw;
    float floorLine = (1.0 - smoothstep(0.0, 1.5 * fw, abs(fract(f + 0.5) - 0.5))) * (1.0 - abs(n.y)) * (1.0 - smoothstep(0.25, 0.6, fw));
    float rim = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0);
    vec3 holo = vec3(0.004, 0.007, 0.012) + uScanAccent * (0.12 * floorLine + 0.7 * crease + 0.1 * rim);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, holo, sk) + uScanAccent * ring * 1.2;
  }
}
`

// the ground: dark, with a 100 m grid at 12 %
export const SCAN_GROUND = /* glsl */ `
{
  float sk = scanAmount(vGWPos.xz), ring = scanRing(vGWPos.xz);
  if (sk > 0.001 || ring > 0.001) {
    vec2 g = vGWPos.xz / 100.0, gw = gScanGw;
    vec2 ln = 1.0 - smoothstep(vec2(0.0), 1.5 * gw, abs(fract(g + 0.5) - 0.5));
    float grid = max(ln.x, ln.y) * (1.0 - smoothstep(0.2, 0.5, max(gw.x, gw.y)));
    vec3 holo = vec3(0.008, 0.013, 0.022) + uScanAccent * 0.12 * grid;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, holo, sk) + uScanAccent * ring * 0.9;
  }
}
`
