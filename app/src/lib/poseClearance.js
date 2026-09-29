// app/src/lib/poseClearance.js — every scripted camera pose clears the roofs below it (spec B.7, backlog G6).
// Built on the raw roof height: V1's clearanceAt already adds the 25 m, so using it here would count the margin twice.
import { roofHeightAt } from './clearance.js'
import { followPose } from '../transit/followCam.js'
import { venueFocusPose } from '../sports/venueFocus.js'

export const CLEAR_M = 25

export function ensureClear(pose, roof = roofHeightAt, margin = CLEAR_M) {
  const [x, y, z] = pose.position
  const floor = roof(x, z) + margin
  return { position: [x, Math.max(y, floor), z], target: [...pose.target] }
}

export const clearedFollowPose = (...args) => ensureClear(followPose(...args))
export const clearedVenuePose = (...args) => ensureClear(venueFocusPose(...args))
