// app/src/hud/ControlDock.jsx — on-screen buttons for everything the keyboard does.
import './ControlDock.css'
import { RiAddLine, RiSubtractLine, RiArrowGoBackLine, RiArrowGoForwardLine, RiArrowUpSLine, RiArrowDownSLine, RiHome5Line, RiQuestionLine, RiArrowLeftSLine, RiArrowRightSLine, RiSearchLine } from 'react-icons/ri'
import { useSports } from '../sports/sportsStore.js'
import { FEATURE_CONTROLS } from './featureControls.js'
import { useStore } from '../state/store.js'
import { cycleQuality } from '../lib/quality.js'
import { VIEW_ORDER, VIEW_NAMES } from '../lib/views.js'

  function Btn({ label, onClick, children, wide, pressed, disabled }) {
    return (
      <button type="button" className={`dock-btn${wide ? ' wide' : ''}${pressed ? ' active' : ''}`} aria-label={label} title={label}
        aria-pressed={pressed} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onClick}>{children}</button>
    )
  }
  

// One button per city-life feature, from the registry (G3): the same list drives keys, ⌘K, help and hints.
function FeatureBtn({ c, live }) {
  const on = c.use(), available = c.useAvailable()
  const Icon = !on && c.iconOff ? c.iconOff : c.icon
  return (
    <button type="button" className={`dock-btn feature${on ? ' on' : ''}`} aria-pressed={on} aria-disabled={!available || undefined}
      aria-label={`${c.label} (${c.keyLabel})`} title={available ? `${c.label} (${c.keyLabel}) — ${c.help}` : `${c.label} — data unavailable`} onClick={() => { if (available) c.toggle() }}>
      <Icon /><span>{c.label}</span>{live && <span className="chip chip-live" aria-hidden="true">LIVE</span>}
    </button>
  )
}

export default function ControlDock() {
  const heading = useStore((s) => s.readout.heading)
  const quality = useStore((s) => s.quality)
  const viewIndex = useStore((s) => s.viewIndex)
  const cam = useStore((s) => s.camCommand)
  const view = VIEW_ORDER[viewIndex] ?? VIEW_ORDER[0]
  const live = useSports((s) => Object.values(s.states).some((x) => x?.state === 'live'))
  return (
    <div className="hud-panel dock" role="toolbar" aria-label="Camera controls">
      <Btn label="Search places (⌘K)" onClick={() => useStore.getState().setPaletteOpen(true)} wide><RiSearchLine /><span>Search</span><span className="hud-kbd">⌘K</span></Btn>
      <div className="dock-row features" role="group" aria-label="City life">
        {FEATURE_CONTROLS.map((c) => <FeatureBtn key={c.id} c={c} live={c.id === 'games' && live} />)}
      </div>
      <div className="dock-row">
        <Btn label="Zoom in" onClick={() => cam('zoom', 1)}><RiAddLine /></Btn>
        <Btn label="Zoom out" onClick={() => cam('zoom', -1)}><RiSubtractLine /></Btn>
        <Btn label="Face north" onClick={() => cam('north')}>
          <span className="dock-compass" style={{ transform: `rotate(${-heading}deg)` }}><i />N</span>
        </Btn>
      </div>
      <div className="dock-row">
        <Btn label="Turn left" onClick={() => cam('turn', -1)}><RiArrowGoBackLine /></Btn>
        <Btn label="Tilt up" onClick={() => cam('tilt', 1)}><RiArrowUpSLine /></Btn>
        <Btn label="Tilt down" onClick={() => cam('tilt', -1)}><RiArrowDownSLine /></Btn>
        <Btn label="Turn right" onClick={() => cam('turn', 1)}><RiArrowGoForwardLine /></Btn>
      </div>
      <div className="dock-row views">
        <Btn label="Previous view ([)" onClick={() => cam('view', -1)}><RiArrowLeftSLine /></Btn>
        <span className="dock-view" title={VIEW_NAMES[view]}>{VIEW_NAMES[view]}</span>
        <Btn label="Next view (])" onClick={() => cam('view', 1)}><RiArrowRightSLine /></Btn>
      </div>
      <div className="dock-row">
        <Btn label="Home view (H)" onClick={() => cam('home')}><RiHome5Line /></Btn>
        <Btn label={`Quality: ${quality} (click to change)`} onClick={() => useStore.getState().setQuality(cycleQuality(quality))} wide><span className="dock-q">{quality}</span></Btn>
        <Btn label="Help (?)" onClick={() => useStore.getState().setHelpOpen(true)}><RiQuestionLine /></Btn>
      </div>
    </div>
  )
}
