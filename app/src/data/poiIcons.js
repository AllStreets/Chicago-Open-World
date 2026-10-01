// app/src/data/poiIcons.js — the place-category glyphs, imported by name (the whole Remix set is thousands of icons:
// importing it wholesale slows every build and test that touches a place). Line glyphs label the filter chips; the
// solid Fill glyphs sit on the map pins, where they read at 28 px.
import {
  RiRestaurantLine, RiGoblet2Line, RiCupLine, RiMoonLine, RiMusic2Line, RiBankLine, RiShoppingBag3Line, RiLeafLine, RiHotelLine, RiFirstAidKitLine, RiMapPin2Line, RiHome4Line, RiBuilding2Line,
  RiRestaurantFill, RiGoblet2Fill, RiCupFill, RiMoonClearFill, RiMusic2Fill, RiBankFill, RiShoppingBag3Fill, RiTreeFill, RiHotelBedFill, RiFirstAidKitFill, RiMapPin2Fill, RiHome4Fill, RiBuilding2Fill,
} from 'react-icons/ri'

export const POI_ICONS = {
  RiRestaurantLine, RiGoblet2Line, RiCupLine, RiMoonLine, RiMusic2Line, RiBankLine, RiShoppingBag3Line, RiLeafLine, RiHotelLine, RiFirstAidKitLine, RiHome4Line, RiBuilding2Line,
  RiRestaurantFill, RiGoblet2Fill, RiCupFill, RiMoonClearFill, RiMusic2Fill, RiBankFill, RiShoppingBag3Fill, RiTreeFill, RiHotelBedFill, RiFirstAidKitFill, RiHome4Fill, RiBuilding2Fill,
}
export const poiIcon = (name) => POI_ICONS[name] ?? RiMapPin2Line
export const poiPinIcon = (name) => POI_ICONS[name] ?? RiMapPin2Fill
