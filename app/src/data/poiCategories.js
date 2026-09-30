// app/src/data/poiCategories.js — the ten place categories, in the pipeline's order (pipeline/lib/pois.js); a
// sidecar pin's `c` is an index into this list. The manifest carries the same list for older/newer worlds.
export const POI_CATEGORIES = [
  { id: 'food', label: 'Food', icon: 'RiRestaurantLine' },
  { id: 'drinks', label: 'Bars', icon: 'RiGoblet2Line' },
  { id: 'coffee', label: 'Coffee', icon: 'RiCupLine' },
  { id: 'nightlife', label: 'Nightlife', icon: 'RiMoonLine' },
  { id: 'venues', label: 'Venues', icon: 'RiMusic2Line' },
  { id: 'culture', label: 'Culture', icon: 'RiBankLine' },
  { id: 'shops', label: 'Shops', icon: 'RiShoppingBag3Line' },
  { id: 'outdoors', label: 'Outdoors', icon: 'RiLeafLine' },
  { id: 'hotels', label: 'Hotels', icon: 'RiHotelLine' },
  { id: 'services', label: 'Services', icon: 'RiFirstAidKitLine' },
]
export const POI_CAT_IDS = POI_CATEGORIES.map((c) => c.id)
