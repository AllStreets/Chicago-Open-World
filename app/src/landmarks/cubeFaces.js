// app/src/landmarks/cubeFaces.js — Cloud Gate's mirror budget: a 128 px cube, one face per frame, refreshed every 30 frames.
export const CUBE = { size: 128, period: 30, near: 1, far: 3000, maxDist: 1500 }
export function cubeFaceFor(frame, period = CUBE.period) {
  const f = ((frame % period) + period) % period
  return f < 6 ? f : -1
}
export const cubeActive = ({ quality, camDist }) => quality !== 'LOW' && camDist <= CUBE.maxDist
