// app/src/transit/trainSource.js — the one place that decides where trains come from (P5 · C11/C12): live CTA trains
// when the feed is LIVE and has trains, V4's simulator otherwise; Metra is always simulated. One CTA line is never
// a mix of live and simulated trains (ruling).
import { CHI_LINE } from '../lib/nearestTransit.js'

const CTA = new Set(Object.values(CHI_LINE))
const lineOf = (t) => t.lineId ?? t.line

export function pickTrains({ ctaStatus, tracker, simTrainsAt, tMs, decorate = (t) => t }) {
  const sim = simTrainsAt(tMs)
  if (ctaStatus !== 'LIVE' || !tracker || tracker.size() === 0) return sim
  const live = tracker.trainsAt(tMs).map(decorate).filter(Boolean)
  if (!live.length) return sim
  return [...live, ...sim.filter((t) => !CTA.has(lineOf(t)))]
}
