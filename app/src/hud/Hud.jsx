import './Hud.css'
import WordmarkBlock from './WordmarkBlock.jsx'
import ControlPills from './ControlPills.jsx'
import HintBar from './HintBar.jsx'
import LoadingScreen from './LoadingScreen.jsx'

export default function Hud() {
  return (
    <div className="hud-root">
      <div className="hud-vignette" />
      <WordmarkBlock />
      <ControlPills />
      <HintBar />
      <LoadingScreen />
    </div>
  )
}
