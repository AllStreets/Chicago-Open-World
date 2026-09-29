import './Hud.css'
import WordmarkBlock from './WordmarkBlock.jsx'
import ControlPills from './ControlPills.jsx'
import HintBar from './HintBar.jsx'
import LoadingScreen from './LoadingScreen.jsx'
import Minimap from './Minimap.jsx'
import ControlDock from './ControlDock.jsx'
import CommandPalette from './CommandPalette.jsx'
import HelpOverlay from './HelpOverlay.jsx'
import FlightChip from './FlightChip.jsx'
import GamesPanel from './GamesPanel.jsx'
import VenueCard from './VenueCard.jsx'
import FollowChip from './FollowChip.jsx'
import TransitCard from './TransitCard.jsx'
import { useEffect, useState } from 'react'
import { useStore } from '../state/store.js'
import { hudScale, hudCompact } from '../lib/hudScale.js'
import TransitLegend from './TransitLegend.jsx'
import { useFeatureKeys } from './useFeatureKeys.js'
import Toast from './Toast.jsx'

export default function Hud() {
  useFeatureKeys()
  const manifest = useStore((s) => s.manifest)
  const [size, setSize] = useState(() => [window.innerWidth, window.innerHeight])
  useEffect(() => {
    const on = () => setSize([window.innerWidth, window.innerHeight])
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  // The whole HUD shrinks together (designed at 1280×800) so nothing is ever cut off.
  const scale = hudScale(size[0], size[1])
  return (
    <div className="hud-root" style={{ zoom: scale }} data-compact={hudCompact(size[0], size[1])}>
      <div className="hud-vignette" />
      <WordmarkBlock />
      <ControlPills />
      <HintBar layoutW={size[0] / scale} />
      <Minimap manifest={manifest} />
      <ControlDock />
      <TransitLegend />
      <FlightChip />
      <GamesPanel />
      <VenueCard />
      <FollowChip />
      <Toast />
      <TransitCard />
      <CommandPalette />
      <HelpOverlay />
      <LoadingScreen />
    </div>
  )
}
