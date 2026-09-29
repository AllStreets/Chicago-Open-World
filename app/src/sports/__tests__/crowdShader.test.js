import { describe, it, expect } from 'vitest'
import { CROWD_VERT } from '../Crowd.jsx'

describe('crowd billboards', () => {
  it('face the camera (front-facing, flags not mirrored): right = (toCam.z, 0, −toCam.x)', () => {
    // camera on +z looking at −z: a quad's +x must map to world +x so its CCW winding stays front-facing
    expect(CROWD_VERT).toContain('normalize(vec3(toCam.z, 0.0, -toCam.x)')
  })
})
