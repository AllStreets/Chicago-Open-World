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
import { useStore } from '../state/store.js'

export default function Hud() {
  const manifest = useStore((s) => s.manifest)
  return (
    <div className="hud-root">
      <div className="hud-vignette" />
      <WordmarkBlock />
      <ControlPills />
      <HintBar />
      <Minimap manifest={manifest} />
      <ControlDock />
      <FlightChip />
      <CommandPalette />
      <HelpOverlay />
      <LoadingScreen />
    </div>
  )
}
