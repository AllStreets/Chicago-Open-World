// shared/teams.js — Chicago's seven major teams (pipeline + app): ESPN site-API ids, sourced colours, home venues.
// Colours: official brand guides as published by each club (Bears #0B162A/#C83803, Cubs #0E3386/#CC3433,
// White Sox #27251F/#C4CED4, Bulls #CE1141, Blackhawks #CF0A2C, Sky #418FDE/#FFCD00); Fire from ESPN's team API
// (color 7ccdef, alternateColor ff0000), with red first because it is the home kit and the fans' colour.
export const TEAMS = [
  { key: 'cubs', name: 'Cubs', full: 'Chicago Cubs', sport: 'baseball', league: 'mlb', espnId: 16, abbr: 'CHC', colors: ['#0E3386', '#CC3433'], home: 'wrigleyfield' },
  { key: 'whitesox', name: 'White Sox', full: 'Chicago White Sox', sport: 'baseball', league: 'mlb', espnId: 4, abbr: 'CHW', colors: ['#27251F', '#C4CED4'], home: 'ratefield' },
  { key: 'bears', name: 'Bears', full: 'Chicago Bears', sport: 'football', league: 'nfl', espnId: 3, abbr: 'CHI', colors: ['#0B162A', '#C83803'], home: 'soldierfield' },
  { key: 'bulls', name: 'Bulls', full: 'Chicago Bulls', sport: 'basketball', league: 'nba', espnId: 4, abbr: 'CHI', colors: ['#CE1141', '#000000'], home: 'unitedcenter' },
  { key: 'blackhawks', name: 'Blackhawks', full: 'Chicago Blackhawks', sport: 'hockey', league: 'nhl', espnId: 4, abbr: 'CHI', colors: ['#CF0A2C', '#000000'], home: 'unitedcenter' },
  { key: 'fire', name: 'Fire', full: 'Chicago Fire FC', sport: 'soccer', league: 'usa.1', espnId: 182, abbr: 'CHI', colors: ['#FF0000', '#7CCDEF'], home: 'soldierfield' },
  { key: 'sky', name: 'Sky', full: 'Chicago Sky', sport: 'basketball', league: 'wnba', espnId: 19, abbr: 'CHI', colors: ['#418FDE', '#FFCD00'], home: 'wintrust' },
]
// ESPN `competitions[0].venue.fullName` → our venue key. The venue decides where a game happens, not the team:
// the White Sox have played home games at Wrigley and the Sky at the United Center.
export const VENUE_BY_NAME = {
  'Wrigley Field': 'wrigleyfield', 'Rate Field': 'ratefield', 'Guaranteed Rate Field': 'ratefield',
  'Soldier Field': 'soldierfield', 'United Center': 'unitedcenter', 'Wintrust Arena': 'wintrust',
}
export const teamByKey = (key) => TEAMS.find((t) => t.key === key) ?? null
