// app/src/hud/panels/PoiFilters.jsx — one chip per place category, plus All and None (P4 · I-4.1).
import * as Ri from 'react-icons/ri'
import { useStore } from '../../state/store.js'
import { POI_CATEGORIES, POI_CAT_IDS } from '../../data/poiCategories.js'

export default function PoiFilters() {
  const cats = useStore((s) => s.poiCats), setPoiCats = useStore((s) => s.setPoiCats)
  const on = cats === 'all' ? POI_CAT_IDS : cats
  const toggle = (id) => setPoiCats(on.includes(id) ? on.filter((c) => c !== id) : POI_CAT_IDS.filter((c) => c === id || on.includes(c)))
  return (
    <div className="poi-filters" role="group" aria-label="Place categories">
      {POI_CATEGORIES.map(({ id, label, icon }) => {
        const Icon = Ri[icon] ?? Ri.RiMapPin2Line
        return <button key={id} type="button" className={`hud-pill poi-chip${on.includes(id) ? ' active' : ''}`} aria-pressed={on.includes(id)} onClick={() => toggle(id)}><Icon aria-hidden="true" /> {label}</button>
      })}
      <button type="button" className="tl-mini" onClick={() => setPoiCats([...POI_CAT_IDS])}>All</button>
      <button type="button" className="tl-mini" onClick={() => setPoiCats([])}>None</button>
    </div>
  )
}
