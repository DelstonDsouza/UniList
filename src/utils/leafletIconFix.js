
import L from "leaflet"
import markerIcon from "./motorcycle.png"
import markerShadow from "./person.png"

delete L.Icon.Default.prototype._getIconUrl

L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})


