// pipeline/lib/waterLevels.js — the build's water levels for the landmark builders that stand in the water (the Harbor
// Lock's gates, the harbour lighthouse on its breakwater). build-world.js sets them from levels.json before the heroes are
// applied; unset (null) is the flat world, where every builder keeps its old heights.
let levels = { river: null, lake: null }
export const setWaterLevels = ({ river = null, lake = null } = {}) => { levels = { river, lake } }
export const waterLevels = () => levels
