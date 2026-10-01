// app/src/lib/cameraKeepKeys.js — keys that never take the camera back (C-fix, 2026-10-01): every city-life toggle
// (FEATURE_CONTROLS — a test checks the list against it), K (change the view), ? (help) and the 1–7 time presets.
// A train follow, a tour, a ride and a flight all keep going through them; only Esc, the movement keys and the camera
// commands (H, N, [ ]) take the camera back. A plain list, so followCam.js needn't import the store-bound registry.
export const FEATURE_KEY_CODES = ['KeyT', 'KeyG', 'KeyM', 'KeyB', 'KeyJ', 'KeyX', 'KeyP', 'KeyC', 'KeyV', 'KeyL', 'KeyY', 'KeyU']
export const KEEP_CAMERA_CODES = new Set([...FEATURE_KEY_CODES, 'KeyK', 'Slash', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'])
