// app/src/hud/NoWebGL.jsx — what a browser without WebGL2 sees: the city as a picture, what's needed, and where to
// look instead. No 3D, no HUD, nothing that would fail behind it.
import './NoWebGL.css'

export default function NoWebGL() {
  return (
    <main className="nowebgl" aria-labelledby="nowebgl-title">
      <img className="nowebgl-img" src="/fallback/city-night.webp" alt="Chicago Open World at night: the Loop and the lakefront, office windows lit floor by floor" />
      <div className="nowebgl-card hud-panel">
        <span className="hud-label">Chicago Open World</span>
        <h1 id="nowebgl-title" className="nowebgl-title">This browser can&rsquo;t draw the 3D city</h1>
        <p>It needs WebGL2, which every recent version of Chrome, Edge, Firefox and Safari has on a laptop or desktop. If yours is up to date, hardware acceleration may be turned off in its settings.</p>
        <p className="nowebgl-links">
          <a href="https://github.com/AllStreets/Chicago-Open-World/blob/main/docs/TOUR.md">See the illustrated tour</a>
          <a href="https://connor-evans.vercel.app/work/chicago-open-world/">Read how it was built</a>
        </p>
      </div>
    </main>
  )
}
