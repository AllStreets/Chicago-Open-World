// app/src/landmarks/ShowMusic.jsx — the music for the city's two shows, heard where they happen: the Buckingham score
// from the fountain during a show, the boat-run processional (with the gate bells) from the raised bridge nearest you.
// Silent — no AudioContext at all — until the shared Sound button is on; a show started with Sound off says so.
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useStore } from '../state/store.js'
import { useSoundStore, getAudioContext } from '../audio/soundStore.js'
import { createShowMusic } from '../audio/showMusic.js'
import { SCORES } from '../audio/score.js'
import { fountainShow } from './fountainSchedule.js'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'
import { liveLift } from '../bridges/BridgeLeaves.jsx'
import { liftShowTime, nearestMoving } from './showClock.js'

const HEAR_FOUNTAIN_M = 2500, HEAR_BRIDGE_M = 3000
const SOUND_OFF = 'Sound is off — press M (or the Sound button) to hear the music'

export default function ShowMusic({ fountainCentre, bridges }) {
  const soundOn = useSoundStore((s) => s.soundOn)
  const fm = useRef(null), bm = useRef(null), fState = useRef({ at: -1, s: null })
  // a show someone starts while Sound is off: tell them how to hear it
  const lift = useStore((s) => s.bridgeLift), preview = useStore((s) => s.fountainPreview)
  useEffect(() => { if ((lift && !lift.stoppedAt) && !useSoundStore.getState().soundOn) useStore.getState().showToast(SOUND_OFF) }, [lift])
  useEffect(() => { if (preview && !useSoundStore.getState().soundOn) useStore.getState().showToast(SOUND_OFF) }, [preview])
  useEffect(() => () => { fm.current?.stop(); bm.current?.stop(); fm.current = bm.current = null }, [])
  useEffect(() => { if (!soundOn) { fm.current?.stop(); bm.current?.stop(); fm.current = bm.current = null } }, [soundOn])

  useFrame(({ camera, clock }) => {
    if (!soundOn) return
    const ctx = getAudioContext()
    if (!ctx) return
    const cam = [camera.position.x, camera.position.z], now = Date.now()
    // Buckingham: the schedule (an Intl clock) is read four times a second; the show time runs on between reads
    const f = fState.current
    if (clock.elapsedTime - f.at > 0.25) { f.at = clock.elapsedTime; f.s = fountainShow(new Date(now), { dark: facadeUniforms.uNight.value > 0.35, previewStart: useStore.getState().fountainPreview }); f.base = f.s.minute * 60 }
    const fShow = f.s?.state === 'show' && fountainCentre && Math.hypot(cam[0] - fountainCentre[0], cam[1] - fountainCentre[1]) < HEAR_FOUNTAIN_M
    if (fShow) {
      fm.current ??= createShowMusic(ctx, SCORES.fountain)
      fm.current.setPosition([fountainCentre[0], 10, fountainCentre[1]]); fm.current.setLevel(0.9)
      fm.current.tick(f.base + (clock.elapsedTime - f.at))
    } else if (fm.current) { fm.current.stop(); fm.current = null }
    // the bridges: a lift someone started (or a boat run) plays from the raised bridge nearest the camera
    const t = liftShowTime(useStore.getState().bridgeLift, now) ?? liveLift.elapsed
    const pos = t != null ? nearestMoving(bridges, liveLift.angles, cam) ?? (bridges[0] && [bridges[0].centre[0], 8, bridges[0].centre[1]]) : null
    if (t != null && pos && Math.hypot(cam[0] - pos[0], cam[1] - pos[2]) < HEAR_BRIDGE_M) {
      bm.current ??= createShowMusic(ctx, SCORES.bridge, { bells: true })
      bm.current.setPosition(pos); bm.current.setLevel(0.8); bm.current.tick(t)
    } else if (bm.current) { bm.current.stop(); bm.current = null }
  })
  return null
}
