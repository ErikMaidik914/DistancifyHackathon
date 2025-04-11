"use client"
import dynamic from "next/dynamic"
import type { AmbulanceLocation, EmergencyCall, Location } from "@/types"

// Create a placeholder component to show while the map is loading
function MapPlaceholder() {
  return (
    <div className="flex items-center justify-center h-full w-full bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
        <p>Loading map...</p>
      </div>
    </div>
  )
}

// Define the props interface
interface LeafletMapProps {
  locations: Location[]
  ambulances: AmbulanceLocation[]
  emergencies: EmergencyCall[]
  selectedEmergency: EmergencyCall | null
  selectedAmbulance: AmbulanceLocation | null
}

// Dynamically import the map component with SSR disabled
// This is crucial - we're not importing any Leaflet code at the top level
const MapWithNoSSR = dynamic(() => import("./map"), {
  loading: MapPlaceholder,
  ssr: false, // Disable server-side rendering
})

export function LeafletMap(props: LeafletMapProps) {
  return <MapWithNoSSR {...props} />
}
