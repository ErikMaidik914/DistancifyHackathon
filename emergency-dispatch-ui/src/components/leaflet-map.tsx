"use client"
import dynamic from "next/dynamic"
import type { EmergencyResource, EmergencyCall, Location } from "@/types"
import { useState } from "react"
import { logger } from "./logger"

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
export interface LeafletMapProps {
  locations: Location[]
  resources: EmergencyResource[]
  emergencies: EmergencyCall[]
  selectedEmergency: EmergencyCall | null
  selectedResource: EmergencyResource | null
}

// Dynamically import the map component with SSR disabled
const MapWithNoSSR = dynamic(() => import("./map"), {
  loading: MapPlaceholder,
  ssr: false, // Disable server-side rendering
})

export function LeafletMap(props: LeafletMapProps) {
  const [, setIsMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  // Handle map load event
  const handleMapLoad = () => {
    setIsMapLoaded(true)
    logger.info("Map loaded successfully")
  }

  // Handle map error
  const handleMapError = (error: string) => {
    setMapError(error)
    logger.error("Map loading error", { error })
  }

  return (
    <div className="relative h-full w-full">
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-10">
          <div className="bg-white p-4 rounded-md shadow-md text-red-600 max-w-md">
            <h3 className="font-bold mb-2">Map Error</h3>
            <p>{mapError}</p>
            <button
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      )}

      <MapWithNoSSR {...props} onLoad={handleMapLoad} onError={handleMapError} />
    </div>
  )
}
