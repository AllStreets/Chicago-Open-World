// app/src/data/poiIcons.js — the ten place-category glyphs, imported by name (the whole Remix set is thousands of
// icons: importing it wholesale slows every build and test that touches a place).
import { RiRestaurantLine, RiGoblet2Line, RiCupLine, RiMoonLine, RiMusic2Line, RiBankLine, RiShoppingBag3Line, RiLeafLine, RiHotelLine, RiFirstAidKitLine, RiMapPin2Line } from 'react-icons/ri'

export const POI_ICONS = { RiRestaurantLine, RiGoblet2Line, RiCupLine, RiMoonLine, RiMusic2Line, RiBankLine, RiShoppingBag3Line, RiLeafLine, RiHotelLine, RiFirstAidKitLine }
export const poiIcon = (name) => POI_ICONS[name] ?? RiMapPin2Line
