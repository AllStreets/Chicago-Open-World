// app/src/world/PostFX.jsx — AO, bloom, filmic tone map, SMAA, vignette.
import { EffectComposer, N8AO, Bloom, ToneMapping, SMAA, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useStore } from '../state/store.js'
import { QUALITY } from '../lib/quality.js'

export default function PostFX() {
  const q = QUALITY[useStore((s) => s.quality)]
  // a softer vignette on clear days: over a bright sky the dark corners read as grey haze (user fixes)
  const clear = useStore((s) => s.timePreset === 'DAY' || s.timePreset === 'SUNNY')
  const effects = [
    q.ao && <N8AO key="ao" halfRes aoRadius={18} distanceFalloff={0.6} intensity={2.2} quality="medium" />,
    <Bloom key="bloom" mipmapBlur luminanceThreshold={0.55} luminanceSmoothing={0.25} intensity={1.1} radius={0.75} />,
    <ToneMapping key="tm" mode={ToneMappingMode.ACES_FILMIC} />,
    <SMAA key="smaa" />,
    <Vignette key="vig" offset={0.28} darkness={clear ? 0.3 : 0.55} />,
  ].filter(Boolean)
  return <EffectComposer multisampling={0} enableNormalPass={false}>{effects}</EffectComposer>
}
