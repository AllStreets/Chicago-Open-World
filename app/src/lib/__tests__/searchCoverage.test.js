// app/src/lib/__tests__/searchCoverage.test.js — ⌘K finds everything we add (user, 2026-09-30): every landmark in the
// shipped manifest is the first or near-first result for its own name, and for each of its aliases.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { buildPlaces, searchPlaces } from '../places.js'
import { BOOKMARKS } from '../bookmarks.js'
import { gamePlaces } from '../../sports/palette.js'
import { featureCommands, tourCommands, rideCommands } from '../paletteSources.js'

const APP = existsSync(`${process.cwd()}/public/world`) ? process.cwd() : `${process.cwd()}/app` // run from app/ or the repo root
const manifest = JSON.parse(readFileSync(`${APP}/public/world/manifest.json`, 'utf8')) // the shipped world (tests run in app/)
const heroes = JSON.parse(readFileSync(`${APP}/../pipeline/data/heroes.json`, 'utf8')).heroes
const riverwalk = JSON.parse(readFileSync(`${APP}/../pipeline/data/riverwalk.json`, 'utf8'))

// X-2: every site of the river (A1–A43) and Lincoln Park (B1–B28) inventories by the name the plan gives it, and the
// row ⌘K must offer for it in its top 3. Garibaldi (B20) is not built yet, so it has no row.
const SITES = [
  ['Wrigley Building', 'Wrigley Building'], ['Tribune Tower', 'Tribune Tower'], ['Trump International Hotel & Tower', 'Trump International Hotel & Tower'],
  ['Marina City', 'Marina City 1'], ['330 N Wabash', 'AMA Plaza'], ['AMA Plaza', 'AMA Plaza'], ['IBM Building', 'AMA Plaza'], ['333 W Wacker', '333 West Wacker'],
  ['Merchandise Mart', 'Merchandise Mart'], ['Art on theMART', 'Merchandise Mart'], ['theMART', 'Merchandise Mart'], ['110 N Wacker', '110 North Wacker'], ['150 N Riverside', '150 North Riverside'],
  ['River Point', 'River Point'], ['444 W Lake', 'River Point'], ['Wolf Point East', 'Wolf Point East'], ['Wolf Point West', 'Wolf Point West'], ['Wolf Point South', 'Salesforce Tower Chicago'],
  ['Boeing', 'Boeing International Headquarters'], ['100 N Riverside', 'Boeing International Headquarters'], ['Riverside Plaza', 'Riverside Plaza'],
  ['Chicago Daily News Building', 'Riverside Plaza'], ['2 N Riverside', 'Riverside Plaza'], ['Civic Opera House', 'Civic Opera House'], ['20 N Wacker', 'Civic Opera House'],
  ['Union Station', 'Union Station'], ['Old Main Post Office', 'Old Chicago Main Post Office'], ['River City', 'River City'], ['35 E Wacker', '35 East Wacker'],
  ['Jewelers Building', '35 East Wacker'], ['333 N Michigan', '333 North Michigan'], ['London Guarantee', 'London Guarantee Building'], ['LondonHouse', 'London Guarantee Building'],
  ['360 N Michigan', 'London Guarantee Building'], ['Carbide & Carbon', 'Carbide & Carbon Building'], ['Mather Tower', 'Mather Tower'], ['75 E Wacker', 'Mather Tower'],
  ['Leo Burnett Building', 'Leo Burnett Building'], ['35 W Wacker', 'Leo Burnett Building'], ['300 N LaSalle', '300 North LaSalle'], ['Reid Murdoch Center', 'Reid Murdoch Center'],
  ['St. Regis Chicago', 'St. Regis Chicago'], ['Vista Tower', 'St. Regis Chicago'], ['NBC Tower', 'NBC Tower'], ['Sheraton Grand Chicago Riverwalk', 'Sheraton Grand Chicago Riverwalk'],
  ['Hyatt Regency Chicago', 'Hyatt Regency Chicago'], ['Swissôtel Chicago', 'Swissôtel Chicago'], ['Equitable Building', 'Equitable Building'], ['401 N Michigan', 'Equitable Building'],
  ['Pioneer Court', 'Pioneer Court'], ['Apple Michigan Avenue', 'Apple Michigan Avenue'], ['Seventeenth Church of Christ, Scientist', 'Seventeenth Church of Christ, Scientist'],
  ['55 E Wacker', 'Seventeenth Church of Christ, Scientist'], ['Hotel 71', 'Royal Sonesta Chicago Downtown'], ['77 W Wacker', '77 West Wacker'], ['225 W Wacker', '225 West Wacker'],
  ['Builders Building', 'Builders Building'], ['LaSalle-Wacker', 'LaSalle–Wacker Building'], ['Salt Shed', 'The Salt Shed'], ['Morton Salt', 'The Salt Shed'],
  ['Montgomery Ward Catalog House', 'Montgomery Ward Catalog House'], ['Chicago Harbor Lock', 'Chicago Harbor Lock'], ['Lock House', 'Chicago Harbor Lock'],
  ['Centennial Fountain', 'Centennial Fountain'], ['Centennial arc', 'Centennial Fountain'], ['bridge house', 'McCormick Bridgehouse & Chicago River Museum'], ['DuSable Bridge', 'DuSable Bridge'],
  ['Kinzie Street railroad bridge', 'Kinzie Street Railroad Bridge'], ['Canal Street railroad bridge', 'Canal Street Railroad Bridge'], ['St. Charles Air Line', 'St. Charles Air Line Bridge'],
  ['Vietnam Veterans Memorial', 'Vietnam Veterans Memorial Plaza'], ['Heald Square monument', 'Heald Square Monument'], ['Ping Tom Park boathouse', 'Ping Tom Boathouse'], ['Willis Tower', 'Willis Tower'],
  ['Riverwalk', 'Chicago Riverwalk'], ['Riverwalk (river level)', 'Walk: The Riverwalk'], ['river level', 'Walk: The Riverwalk'],
  ['North Avenue Beach House', 'North Avenue Beach House'], ['North Avenue pedestrian bridge', 'Lincoln Park Passerelle'], ['Passerelle', 'Lincoln Park Passerelle'],
  ['Chicago History Museum', 'Chicago History Museum'], ['Couch Tomb', 'Couch Tomb'], ['Standing Lincoln', 'Standing Lincoln'], ['Lincoln Park Zoo', 'Kovler Lion House'], ['Kovler Lion House', 'Kovler Lion House'],
  ['Helen Brach Primate House', 'Helen Brach Primate House'], ['McCormick Bird House', 'McCormick Bird House'], ['Regenstein Center for African Apes', 'Regenstein Center for African Apes'],
  ['Small Mammal-Reptile House', 'Regenstein Small Mammal–Reptile House'], ['African Journey', 'Regenstein African Journey'], ['Birds of Prey', 'Regenstein Birds of Prey Exhibit'],
  ['Macaque Forest', 'Regenstein Macaque Forest'], ['Pritzker Penguin Cove', 'Pritzker Penguin Cove'], ["Pritzker Family Children's Zoo", "Pritzker Family Children's Zoo"],
  ['Zoo Administration', 'Lincoln Park Zoo Administration Building'], ['Conservation & Science Building', 'Conservation & Science Building'], ['Farm-in-the-Zoo', 'Farm-in-the-Zoo Main Barn'],
  ['Kovler Sea Lion Pool', 'Kovler Sea Lion Pool'], ['carousel', 'AT&T Endangered Species Carousel'], ['zoo gate', 'Searle Visitor Center'], ['Café Brauer', 'Café Brauer'],
  ['South Pond', 'Nature Boardwalk pavilion'], ['Nature Boardwalk', 'Nature Boardwalk pavilion'], ['honeycomb pavilion', 'Nature Boardwalk pavilion'],
  ['Lincoln Park Conservatory', 'Lincoln Park Conservatory'], ['Alfred Caldwell Lily Pool', 'Alfred Caldwell Lily Pool'], ['Peggy Notebaert Nature Museum', 'Peggy Notebaert Nature Museum'],
  ['North Pond', 'North Pond'], ['North Pond restaurant', 'North Pond'], ['Theater on the Lake', 'Theater on the Lake'], ['Chess Pavilion', 'Chess Pavilion'],
  ['Grant', 'General Grant Memorial'], ['Goethe', 'Goethe Monument'], ['Schiller', 'Schiller Monument'], ['Hans Christian Andersen', 'Hans Christian Andersen Monument'],
  ['Alexander Hamilton', 'Alexander Hamilton Monument'], ['Signal of Peace', 'A Signal of Peace'], ['Benjamin Franklin', 'Benjamin Franklin Monument'], ['Altgeld', 'John Peter Altgeld Monument'],
  ['Kwanusila', 'Kwanusila totem pole'], ['Diversey Harbor', 'Diversey Harbor'], ['Diversey Yacht Club', 'Diversey Harbor'], ['Lincoln Park Boat Club', 'Diversey Harbor'],
  ['Lagoon', 'Lincoln Park Lagoon'], ['Diversey Driving Range', 'Diversey Driving Range'], ['mini golf', 'Diversey Driving Range'], ['Belmont Harbor', 'Belmont Harbor'],
  ['Chicago Yacht Club', 'Belmont Harbor'], ['Belmont Harbor Market', 'Belmont Harbor'], ['Waveland Clock Tower', 'Waveland Clock Tower'], ['Sydney R. Marovitz Golf Course', 'Waveland Clock Tower'],
  ['Lakefront Trail', 'Walk: The Lakefront Trail: Grant Park to the Museum Campus'], ['Elks National Memorial', 'Elks National Veterans Memorial'], ['Lincoln Park Cultural Center', 'Lincoln Park Cultural Center'],
]
describe('search coverage', () => {
  const all = buildPlaces(manifest, BOOKMARKS)
  it('every manifest landmark is found by its name and each alias (top 5)', () => {
    const missed = []
    for (const l of manifest.landmarks) for (const q of [l.name, ...(l.aliases ?? [])]) {
      if (!searchPlaces(q, all).slice(0, 5).some((r) => r.name === l.name)) missed.push(`${l.key}: "${q}"`)
    }
    expect(missed).toEqual([])
  })
  // X-2: every heroes.json entry (the river and Lincoln Park blocks included) by its name and each alias. A hero built
  // as a group of buildings (`members`, no single manifest landmark) must still find something in the top 5; a "quiet"
  // one ("Lincoln Park Zoo building") is the generic hover name of unnamed members, not a site, and is skipped.
  it('every heroes.json name and alias finds its landmark (top 5)', () => {
    const lm = new Map(manifest.landmarks.map((l) => [l.key, l])), missed = []
    for (const h of heroes) {
      if (h.quiet && !lm.has(h.key)) continue
      for (const q of [h.name, ...(h.aliases ?? [])]) {
        const top = searchPlaces(q, all).slice(0, 5)
        if (lm.has(h.key) ? !top.some((r) => r.name === lm.get(h.key).name) : !top.length) missed.push(`${h.key}: "${q}"`)
      }
    }
    expect(missed).toEqual([])
  })
  it('every river and Lincoln Park site, the Riverwalk rooms, the tours and the rides by the names people use (top 3)', () => {
    const rows = [...all, ...featureCommands(), ...tourCommands(), ...rideCommands()]
    const missed = SITES.filter(([q, want]) => !searchPlaces(q, rows).slice(0, 3).some((r) => r.name === want)).map(([q, want]) => `"${q}" → ${want}`)
    for (const r of riverwalk.rooms) if (!searchPlaces(r.name, rows).slice(0, 3).some((x) => x.name === r.name)) missed.push(`room "${r.name}"`)
    for (const [q, want] of [['Lincoln Park tour', 'Tour: Lincoln Park, South to North'], ['Drive Lower Wacker', 'Drive: Lower Wacker · Columbus → Lake St'], ['Riverwalk (river level)', 'Walk: The Riverwalk']])
      if (searchPlaces(q, rows)[0]?.name !== want) missed.push(`"${q}" first → ${want}`)
    expect(missed).toEqual([])
  })
  // E4-4 / X-2: every "Play a game" command and "Stop the game" is the first result for its own words
  it('⌘K finds Play a Cubs / White Sox / Bears game, a Fire match, and Stop the game', () => {
    const rows = [...all, ...gamePlaces({ venues: [], states: {}, nowMs: Date.now() })]
    const names = ['Play a Cubs game at Wrigley Field', 'Play a White Sox game at Rate Field', 'Play a Bears game at Soldier Field', 'Play a Fire match at Soldier Field', 'Stop the game']
    for (const n of names) expect(searchPlaces(n, rows)[0]?.name, n).toBe(n)
    expect(searchPlaces('play a game', rows).slice(0, 5).filter((r) => /^Play a /.test(r.name)).length).toBeGreaterThanOrEqual(3)
    expect(searchPlaces('cubs game', rows).slice(0, 5).map((r) => r.name)).toContain('Play a Cubs game at Wrigley Field')
  })
  // D2-3 / X-2: the U view is a ⌘K command by its own name and by the streets it shows
  it('⌘K finds "Lower levels" (and "Lower Wacker") first', () => {
    const rows = [...all, ...featureCommands()]
    for (const q of ['Lower levels', 'lower wacker', 'lower level', 'Lower Michigan', 'Lower Lower Wacker', 'Lower Columbus']) expect(searchPlaces(q, rows)[0]?.id, q).toBe('f:lowerLevels')
  })
  it('Flexport Chicago is the first result for "flexport" and for "333 north green"', () => {
    expect(searchPlaces('flexport', all)[0].name).toMatch(/Flexport/)
    expect(searchPlaces('333 north green', all)[0].name).toMatch(/Flexport/)
  })
})
