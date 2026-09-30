// app/src/world/labelRegistry.js — the items WorldLabels lays out (P4): beacons (VISIT) and neighbourhood names (LIVE)
// register here as { id, x, y, z, priority, text, color?, onClick? }.
const groups = new Map()
export function setLabels(group, items) { if (items?.length) groups.set(group, items); else groups.delete(group) }
export function allLabels() { return [...groups.values()].flat() }
