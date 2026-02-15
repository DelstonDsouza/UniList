import L from "leaflet"
import riderIconImg from "./motorcycle.png"
import passengerIconImg from "./person.png"

export const riderIcon = new L.Icon({
  iconUrl: riderIconImg,
  iconSize: [40, 40],
})

export const passengerIcon = new L.Icon({
  iconUrl: passengerIconImg,
  iconSize: [35, 35],
})
