# pipeline/heroes/scripts/statue_grant.py — the Ulysses S. Grant Memorial (Louis Rebisso, 1891, Lincoln Park): Grant
# in greatcoat and slouch hat on his standing horse, the bronze ≈ 18 ft (5.5 m) above a tall arched granite base.
# Source: https://en.wikipedia.org/wiki/Ulysses_S._Grant_Memorial_(Chicago)
# Run: blender -b -P pipeline/heroes/scripts/statue_grant.py -- --out pipeline/heroes/out/statue_grant.glb
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from _export import args, clear_scene, export_glb  # noqa: E402
from _shapes import ellipsoid, finish, lathe, limb  # noqa: E402

H = 5.5


def main():
    out = args().get('out', os.path.join(os.path.dirname(__file__), '..', 'out', 'statue_grant.glb'))
    clear_scene()
    p = []
    # the horse, facing +Y: barrel, chest and haunches overlapping into one body, legs about as long as the body is
    # deep (the near fore lifted), a thick arched neck, the head carried low, the tail
    p.append(ellipsoid('barrel', (0.0, 0.0, 1.75), (0.5, 1.05, 0.52), 24, 14))
    p.append(ellipsoid('chest', (0.0, 0.8, 1.85), (0.46, 0.5, 0.55)))
    p.append(ellipsoid('haunch', (0.0, -0.85, 1.85), (0.5, 0.52, 0.55)))
    for x, y, lift in [(-0.24, 0.95, 0.3), (0.24, 0.95, 0.0), (-0.26, -0.95, 0.0), (0.26, -0.95, 0.0)]:
        p.append(limb(f'thigh{x}{y}', (x, y, 1.6), (x, y - 0.05, 0.85 + lift * 0.6), 0.15))
        p.append(limb(f'cannon{x}{y}', (x, y - 0.05, 0.85 + lift * 0.6), (x, y + (0.3 if lift else 0.0), lift), 0.08))
    p.append(limb('neck', (0.0, 1.05, 2.05), (0.0, 1.55, 2.75), 0.3))
    p.append(ellipsoid('head', (0.0, 1.85, 2.55), (0.18, 0.42, 0.2)))
    p.append(limb('ear_l', (-0.08, 1.6, 2.85), (-0.1, 1.58, 3.02), 0.04))
    p.append(limb('ear_r', (0.08, 1.6, 2.85), (0.1, 1.58, 3.02), 0.04))
    p.append(limb('tail', (0.0, -1.3, 2.0), (0.0, -1.55, 1.0), 0.12))
    # the rider: greatcoat over the saddle, legs down the flanks, slouch hat
    p.append(lathe('rider', [(0.44, 2.1), (0.37, 2.5), (0.34, 2.85), (0.4, 3.15), (0.2, 3.28), (0.0, 3.3)], sides=20))
    p.append(limb('rider_leg_l', (-0.35, 0.05, 2.25), (-0.55, 0.25, 1.35), 0.11))
    p.append(limb('rider_leg_r', (0.35, 0.05, 2.25), (0.55, 0.25, 1.35), 0.11))
    p.append(limb('rein_arm_l', (-0.36, 0.05, 3.05), (-0.25, 0.55, 2.6), 0.08))
    p.append(limb('rein_arm_r', (0.36, 0.05, 3.05), (0.25, 0.55, 2.6), 0.08))
    p.append(ellipsoid('head_r', (0.0, 0.05, 3.48), (0.15, 0.17, 0.2)))
    p.append(lathe('hat', [(0.34, 3.61), (0.3, 3.67), (0.17, 3.69), (0.16, 3.89), (0.0, 3.93)], sides=20))
    finish(p, H)
    export_glb([o.name for o in p], os.path.abspath(out), 12000)


main()
