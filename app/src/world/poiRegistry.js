// app/src/world/poiRegistry.js — the places of every LOD0 tile on screen (P4): TileContent registers a tile's
// sidecar `pois` when it loads and drops them when it unloads; live CHI places join as their own entry.
import { useSyncExternalStore } from 'react'

const byTile = new Map()
let version = 0
const listeners = new Set()
const bump = () => { version++; for (const l of listeners) l() }

export function registerTilePois(tileId, pois) { if (pois?.length) { byTile.set(tileId, pois); bump() } }
export function unregisterTilePois(tileId) { if (byTile.delete(tileId)) bump() }
export function allTilePois() { return [...byTile.values()].flat() }
export function usePoiVersion() { return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => version) }
