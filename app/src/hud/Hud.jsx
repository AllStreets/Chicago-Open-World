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
import PerfOverlay from './PerfOverlay.jsx'
import LensRail from './LensRail.jsx'
import ContextPanel from './ContextPanel.jsx'
import BuildingTooltip from './BuildingTooltip.jsx'
import PlacePopup from './PlacePopup.jsx'
import TourBar from './TourBar.jsx'
import { bootFeeds } from '../services/feeds.js'

export default function Hud() {
  useFeatureKeys()
  useEffect(() => { bootFeeds() }, []) // P5: probe CHI once; offline, everything stays simulated
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
      {/* one scrollable column for every side panel (V7): cards first, then the games list and the line legend */}
      <div className="hud-left-stack">
        <ContextPanel />
        <TransitCard />
        <VenueCard />
        <GamesPanel />
        <TransitLegend />
      </div>
      <LensRail />
      <ControlPills />
      <HintBar layoutW={size[0] / scale} />
      <Minimap manifest={manifest} />
      <ControlDock />
      <FlightChip />
      <PerfOverlay />
      <FollowChip />
      <Toast />
      <BuildingTooltip />
      <PlacePopup />
      <TourBar />
      <CommandPalette />
      <HelpOverlay />
      <LoadingScreen />
    </div>
  )
}
