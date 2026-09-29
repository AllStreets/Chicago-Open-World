// app/src/transit/__tests__/fixtures.js — a tiny transit.json: a 30 km Red Line with two stations, a rush-only
// Purple Express, and an inbound BNSF run to Union Station.
export const P = { weekday: [['night', 0, 5], ['peak', 5, 9.5], ['midday', 9.5, 15.5], ['peak', 15.5, 18.5], ['evening', 18.5, 24]], weekend: [['night', 0, 6], ['weekend', 6, 24]] }
const DIMS = { cta5000: { length: 14.63, truckCentres: 10.06 }, cta7000: { length: 14.63, truckCentres: 10.06 }, metraCoach: { length: 25.91, truckCentres: 18.14 }, metraLoco: { length: 20.98, truckCentres: 12.8 } }
const svc = (headwayMin, extra = {}) => ({ stock: 'cta5000', cars: { peak: 8, offpeak: 8 }, headwayMin, dwellS: 25, vmaxKmh: 88, accel: 1.34, brake: 1.34, runBase: 800, ...extra })
const line = (id, operator, service) => ({ id, name: `${id} line`, operator, colour: '#c60c30', index: 0, service })
const track = (x0, z0, x1, z1, n) => Array.from({ length: n }, (_, i) => [x0 + ((x1 - x0) * i) / (n - 1), 7.2, z0 + ((z1 - z0) * i) / (n - 1)])
export const TRANSIT = {
  servicePeriods: P, rollingStock: DIMS,
  lines: [
    line('red', 'cta', svc({ peak: 5, midday: 7, evening: 10, night: 15, weekend: 8 })),
    line('purple', 'cta', svc({ peak: 8 }, { runBase: 500 })),
    line('bnsf', 'metra', svc({ peak: 15, midday: 60, evening: 60, weekend: 60 }, { stock: 'metra', cars: { peak: 7, offpeak: 5 }, dwellS: 45, vmaxKmh: 97, accel: 0.45, brake: 0.7, runBase: 1200 })),
  ],
  routes: [
    { id: 'r1', line: 'red', to: 'Loop', path: track(0, 15000, 0, -15000, 301), stops: [{ station: 'st-a', name: 'A', s: 7500 }, { station: 'st-b', name: 'B', s: 22500 }] },
    { id: 'p1', line: 'purple', to: 'Loop', path: track(50, 15000, 50, -15000, 301), stops: [] },
    { id: 'b1', line: 'bnsf', to: 'Union Station', path: track(-15000, 500, -600, 500, 145), stops: [{ station: 'st-u', name: 'Union Station', s: 14400 }] },
  ],
  services: [{ id: 'svc-r1', line: 'red', routes: ['r1'], inbound: false }, { id: 'svc-p1', line: 'purple', routes: ['p1'], inbound: false }, { id: 'svc-b1', line: 'bnsf', routes: ['b1'], inbound: true }],
  stations: [{ id: 'st-a', name: 'A', lines: ['red'], x: 0, z: 7500, y: 8.27, grade: 'elevated', heading: 0 }],
}
export { DIMS, svc }
