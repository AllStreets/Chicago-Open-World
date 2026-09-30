// app/src/data/poiCategories.js — the ten place categories, in the pipeline's order (pipeline/lib/pois.js); a
// sidecar pin's `c` is an index into this list. Each has a colour, so the pins and chips tell categories apart
// at a glance (warm for food and drink, cool for culture, stays and services, green outdoors). The manifest carries the same list for older/newer worlds.
export const POI_CATEGORIES = [
  { id: 'food', color: '#ff8a3d', label: 'Food', icon: 'RiRestaurantLine', pin: 'RiRestaurantFill' },
  { id: 'drinks', color: '#ffc23d', label: 'Bars', icon: 'RiGoblet2Line', pin: 'RiGoblet2Fill' },
  { id: 'coffee', color: '#c98a5a', label: 'Coffee', icon: 'RiCupLine', pin: 'RiCupFill' },
  { id: 'nightlife', color: '#ff4fb4', label: 'Nightlife', icon: 'RiMoonLine', pin: 'RiMoonClearFill' },
  { id: 'venues', color: '#ff5a5a', label: 'Venues', icon: 'RiMusic2Line', pin: 'RiMusic2Fill' },
  { id: 'culture', color: '#a98bff', label: 'Culture', icon: 'RiBankLine', pin: 'RiBankFill' },
  { id: 'shops', color: '#3fd0c9', label: 'Shops', icon: 'RiShoppingBag3Line', pin: 'RiShoppingBag3Fill' },
  { id: 'outdoors', color: '#5fd46a', label: 'Outdoors', icon: 'RiLeafLine', pin: 'RiTreeFill' },
  { id: 'hotels', color: '#4f8dff', label: 'Hotels', icon: 'RiHotelLine', pin: 'RiHotelBedFill' },
  { id: 'services', color: '#9fb3c8', label: 'Services', icon: 'RiFirstAidKitLine', pin: 'RiFirstAidKitFill' },
]
export const POI_CAT_IDS = POI_CATEGORIES.map((c) => c.id)
