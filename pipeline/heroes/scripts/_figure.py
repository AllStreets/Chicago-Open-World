# pipeline/heroes/scripts/_figure.py — a standing bronze figure built from the _shapes primitives (Lincoln Park pass,
# B-6), in a nominal 1.85 m body facing +Y; `finish()` then scales the whole statue to its sourced height. A pose is a
# few named choices — coat cut, arm targets, a held prop — so each monument script reads like its description.
from _shapes import box, ellipsoid, lathe, limb, sweep

def standing(name, coat='frock', arm_l=None, arm_r=None, hat=None, hair=True, stance=0.12, lean=0.0):
    """Legs, shoes, coat, neck, head (and hair or a hat), the two arms to their hand targets. Returns the parts."""
    p = []
    hem = {'frock': 0.92, 'cloak': 0.45, 'jacket': 1.25, 'robe': 0.08}[coat]
    p.append(limb(f'{name}_leg_l', (-0.11, 0.0, 0.0), (-0.1, lean * 0.3, 1.0), 0.085))
    p.append(limb(f'{name}_leg_r', (0.11 + stance * 0.3, -stance, 0.0), (0.1, lean * 0.3, 1.0), 0.085))
    p.append(box(f'{name}_shoe_l', (-0.11, 0.1, 0.045), (0.1, 0.27, 0.09)))
    p.append(box(f'{name}_shoe_r', (0.11 + stance * 0.3, 0.1 - stance, 0.045), (0.1, 0.27, 0.09)))
    body = [(0.27 if coat in ('frock', 'jacket') else 0.36, hem), (0.25, 1.02), (0.21, 1.15), (0.23, 1.35), (0.27, 1.5), (0.25, 1.56), (0.12, 1.6), (0.0, 1.61)]
    if coat == 'cloak': body = [(0.42, hem), (0.38, 0.8), (0.32, 1.15), (0.31, 1.4), (0.33, 1.52), (0.2, 1.58), (0.0, 1.6)]
    if coat == 'robe': body = [(0.33, 0.0), (0.3, 0.4), (0.24, 1.0), (0.23, 1.3), (0.27, 1.5), (0.2, 1.58), (0.0, 1.6)]
    p.append(lathe(f'{name}_coat', [(r, z) for r, z in body], sides=24))
    if coat in ('frock', 'jacket'):  # the coat's lapels and buttoned front, standing proud
        p.append(box(f'{name}_lapel', (0.0, 0.2, 1.38), (0.2, 0.06, 0.22)))
    p.append(limb(f'{name}_neck', (0.0, 0.02 + lean * 0.4, 1.58), (0.0, 0.04 + lean * 0.45, 1.68), 0.06))
    hx, hy, hz = 0.0, 0.05 + lean * 0.5, 1.77
    p.append(ellipsoid(f'{name}_head', (hx, hy, hz), (0.095, 0.11, 0.125), 16, 10))
    p.append(ellipsoid(f'{name}_nose', (hx, hy + 0.1, hz - 0.01), (0.02, 0.03, 0.035), 8, 6))
    if hair:
        p.append(ellipsoid(f'{name}_hair', (hx, hy - 0.025, hz + 0.035), (0.105, 0.11, 0.105), 14, 8))
    if hat == 'tricorne':
        p.append(lathe(f'{name}_hat', [(0.2, hz + 0.08), (0.17, hz + 0.12), (0.1, hz + 0.13), (0.09, hz + 0.2), (0.0, hz + 0.22)], sides=3))
    if hat == 'feathers':  # a war bonnet: a band and a fan of feathers sweeping down the back
        p.append(lathe(f'{name}_band', [(0.11, hz + 0.02), (0.11, hz + 0.08), (0.0, hz + 0.09)], sides=12))
        for k in range(9):
            a = -0.9 + k * 0.225
            p.append(limb(f'{name}_feather{k}', (0.1 * a, hy - 0.02, hz + 0.07), (0.28 * a, hy - 0.16, hz + 0.27 - 0.06 * abs(a)), 0.018))
        p.append(limb(f'{name}_trail', (0.0, hy - 0.1, hz), (0.0, hy - 0.3, hz - 0.85), 0.05))
    for side, tgt in (('l', arm_l), ('r', arm_r)):
        sx = -1 if side == 'l' else 1
        sh = (0.27 * sx, 0.0, 1.5)
        hand = tgt or (0.3 * sx, 0.02, 0.88)
        el = ((sh[0] + hand[0]) / 2 + 0.06 * sx, (sh[1] + hand[1]) / 2 - 0.05, (sh[2] + hand[2]) / 2 - 0.05)
        p.append(limb(f'{name}_upper_{side}', sh, el, 0.065))
        p.append(limb(f'{name}_fore_{side}', el, hand, 0.055))
        p.append(ellipsoid(f'{name}_hand_{side}', hand, (0.045, 0.06, 0.05), 8, 6))
    return p


def horse(name, at=(0.0, 0.0), rear=0.0, head_up=0.0):
    """A standing (or, rear > 0, lifting) horse facing +Y, as the Grant script's; returns parts and the saddle point."""
    x0, y0 = at
    p = []
    p.append(ellipsoid(f'{name}_barrel', (x0, y0, 1.6), (0.42, 0.95, 0.47), 24, 14))
    p.append(ellipsoid(f'{name}_chest', (x0, y0 + 0.72, 1.7 + rear * 0.3), (0.4, 0.45, 0.5)))
    p.append(ellipsoid(f'{name}_haunch', (x0, y0 - 0.78, 1.7), (0.43, 0.47, 0.5)))
    for x, y, lift in [(-0.2, 0.85, rear), (0.2, 0.85, 0.0), (-0.22, -0.85, 0.0), (0.22, -0.85, 0.0)]:
        p.append(limb(f'{name}_thigh{x}{y}', (x0 + x, y0 + y, 1.45), (x0 + x, y0 + y - 0.05, 0.8 + lift * 0.6), 0.13))
        p.append(limb(f'{name}_cannon{x}{y}', (x0 + x, y0 + y - 0.05, 0.8 + lift * 0.6), (x0 + x, y0 + y + (0.3 if lift else 0.0), lift), 0.07))
    p.append(limb(f'{name}_neck', (x0, y0 + 0.95, 1.95), (x0, y0 + 1.35, 2.55 + head_up), 0.26))
    p.append(ellipsoid(f'{name}_head', (x0, y0 + 1.62, 2.42 + head_up), (0.16, 0.38, 0.18)))
    p.append(limb(f'{name}_ear_l', (x0 - 0.07, y0 + 1.4, 2.68 + head_up), (x0 - 0.09, y0 + 1.38, 2.84 + head_up), 0.035))
    p.append(limb(f'{name}_ear_r', (x0 + 0.07, y0 + 1.4, 2.68 + head_up), (x0 + 0.09, y0 + 1.38, 2.84 + head_up), 0.035))
    p.append(limb(f'{name}_tail', (x0, y0 - 1.18, 1.85), (x0, y0 - 1.4, 0.9), 0.1))
    return p, (x0, y0 + 0.05, 2.0)
