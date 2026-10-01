// app/src/data/poiCategories.js — the place categories, in the pipeline's order (pipeline/lib/pois.js); a sidecar pin's
// `c` is an index into this list. Deep, saturated, clearly distinct hues (Google-Maps-like) so categories separate at a
// glance; the pin shader pre-compensates them through the tone map (lib/pinColors.js). The manifest carries the same list.
export const POI_CATEGORIES = [
  { id: 'food', color: '#E8590C', label: 'Food', icon: 'RiRestaurantLine', pin: 'RiRestaurantFill' },
  { id: 'drinks', color: '#7048E8', label: 'Bars', icon: 'RiGoblet2Line', pin: 'RiGoblet2Fill' },
  { id: 'coffee', color: '#8D5524', label: 'Coffee', icon: 'RiCupLine', pin: 'RiCupFill' },
  { id: 'nightlife', color: '#D6336C', label: 'Nightlife', icon: 'RiMoonLine', pin: 'RiMoonClearFill' },
  { id: 'venues', color: '#C92A2A', label: 'Venues', icon: 'RiMusic2Line', pin: 'RiMusic2Fill' },
  { id: 'culture', color: '#1C7ED6', label: 'Culture', icon: 'RiBankLine', pin: 'RiBankFill' },
  { id: 'shops', color: '#0CA678', label: 'Shops', icon: 'RiShoppingBag3Line', pin: 'RiShoppingBag3Fill' },
  { id: 'outdoors', color: '#2F9E44', label: 'Outdoors', icon: 'RiLeafLine', pin: 'RiTreeFill' },
  { id: 'hotels', color: '#0B3D91', label: 'Hotels', icon: 'RiHotelLine', pin: 'RiHotelBedFill' },
  { id: 'services', color: '#495057', label: 'Services', icon: 'RiFirstAidKitLine', pin: 'RiFirstAidKitFill' },
  { id: 'apartments', color: '#E8A317', label: 'Apartments', icon: 'RiHome4Line', pin: 'RiHome4Fill' },
  { id: 'offices', color: '#364FC7', label: 'Offices', icon: 'RiBuilding2Line', pin: 'RiBuilding2Fill' },
]
export const POI_CAT_IDS = POI_CATEGORIES.map((c) => c.id)
