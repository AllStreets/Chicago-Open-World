// app/src/hud/SoundGlyph.jsx — one speaker drawing for both sound states (Workstream C, 2026-10-01): ON adds two sound
// waves, OFF strikes the same speaker through with a slash (cut clean out of the speaker so it reads at any size).
// It draws in currentColor — the toast colours it green (on) or red (off).
import { useId } from 'react'

const SPEAKER = 'M5 17.5h8.5L25 8v32l-11.5-9.5H5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z'
const SLASH = 'M7 7l34 34'

export default function SoundGlyph({ on, className = '' }) {
  const cut = `sg-cut-${useId().replace(/:/g, '')}`
  return (
    <svg className={`sound-glyph ${className}`.trim()} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {!on && (
        <mask id={cut} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          <path d={SLASH} stroke="#000" strokeWidth="9" strokeLinecap="round" />
        </mask>
      )}
      <path data-part="speaker" d={SPEAKER} fill="currentColor" strokeLinejoin="round" mask={on ? undefined : `url(#${cut})`} />
      {on ? (
        <>
          <path data-part="wave" d="M30.5 17.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
          <path data-part="wave" d="M35.5 12a16.5 16.5 0 0 1 0 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
        </>
      ) : (
        <path data-part="slash" d={SLASH} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      )}
    </svg>
  )
}
