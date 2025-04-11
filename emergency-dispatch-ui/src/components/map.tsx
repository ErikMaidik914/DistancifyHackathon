"use client"

// All Leaflet imports are in this file, which is only loaded on the client
import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline, useMapEvents } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { AmbulanceLocation, EmergencyCall, Location } from "@/types"
import { calculateDistance } from "@/utils/distance"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"

// Map bounds adjuster component
function MapBoundsAdjuster({
  locations,
  ambulances,
  emergencies,
}: {
  locations: Location[]
  ambulances: AmbulanceLocation[]
  emergencies: EmergencyCall[]
}) {
  const map = useMap()

  useEffect(() => {
    if (locations.length === 0 && ambulances.length === 0 && emergencies.length === 0) {
      // Default view for Romania
      map.setView([45.9443, 25.0094], 7)
      return
    }

    const bounds = L.latLngBounds([])

    // Add locations to bounds
    locations.forEach((loc) => {
      bounds.extend([loc.lat, loc.long])
    })

    // Add ambulances to bounds
    ambulances.forEach((amb) => {
      bounds.extend([amb.latitude, amb.longitude])
    })

    // Add emergencies to bounds
    emergencies.forEach((emg) => {
      bounds.extend([emg.latitude, emg.longitude])
    })

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [map, locations, ambulances, emergencies])

  return null
}

// Map click handler component
function MapClickHandler({ onLocationClick }: { onLocationClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onLocationClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

interface LeafletMapProps {
  locations: Location[]
  ambulances: AmbulanceLocation[]
  emergencies: EmergencyCall[]
  selectedEmergency: EmergencyCall | null
  selectedAmbulance: AmbulanceLocation | null
}

export default function Map({
  locations,
  ambulances,
  emergencies,
  selectedEmergency,
  selectedAmbulance,
}: LeafletMapProps) {
  const [clickedLocation, setClickedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [nearbyAmbulances, setNearbyAmbulances] = useState<AmbulanceLocation[]>([])
  const [isLoadingNearby, setIsLoadingNearby] = useState(false)
  const [clickedLocationName, setClickedLocationName] = useState<string | null>(null)

  // Remove the useMap() hook from here - it's outside of MapContainer context
  // const map = useMap() - THIS IS THE PROBLEM

  // Create basic icons for markers
  const createAmbulanceIcon = () =>
    new L.DivIcon({
      className: "custom-div-icon",
      html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; border: 2px solid white;">A</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })

  const createEmergencyIcon = () =>
    new L.DivIcon({
      className: "custom-div-icon",
      html: `<div style="background-color: #ef4444; width: 20px; height: 20px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; border: 2px solid white;">E</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })

  const handleLocationClick = async (lat: number, lng: number) => {
    setClickedLocation({ lat, lng })
    setIsLoadingNearby(true)

    try {
      // Find the nearest location to the clicked point
      let nearestLocation: Location | null = null as Location | null
      let minDistance = Number.MAX_VALUE

      locations.forEach((location) => {
        const distance = calculateDistance(lat, lng, location.lat, location.long)
        if (distance < minDistance) {
          minDistance = distance
          nearestLocation = location
        }
      })

      if (nearestLocation) {
        setClickedLocationName(`${nearestLocation?.name || "Unknown"}, ${nearestLocation?.county || "Unknown"}`)

        // Find ambulances near this location
        const nearby = ambulances.filter((ambulance) => {
          const distance = calculateDistance(ambulance.latitude, ambulance.longitude, lat, lng)
          return distance < 0.5 // Arbitrary threshold, adjust as needed
        })

        setNearbyAmbulances(nearby)
      } else {
        setClickedLocationName("Unknown location")
        setNearbyAmbulances([])
      }
    } catch (error) {
      console.error("Error finding nearby ambulances:", error)
      setNearbyAmbulances([])
    } finally {
      setIsLoadingNearby(false)
    }
  }

  const closeLocationInfo = () => {
    setClickedLocation(null)
    setNearbyAmbulances([])
    setClickedLocationName(null)
  }

  // Create a MapController component to handle map instance operations
  const MapController = () => {
    const map = useMap()

    useEffect(() => {
      // If all data is cleared, reset the map view
      if (locations.length === 0 && ambulances.length === 0 && emergencies.length === 0) {
        map.setView([45.9443, 25.0094], 7) // Default view for Romania
      }
    }, [map, locations, ambulances, emergencies])

    return null
  }

  // Use the icons
  const ambulanceIcon = createAmbulanceIcon()
  const emergencyIcon = createEmergencyIcon()

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={[45.9443, 25.0094]} // Center of Romania
        zoom={7}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Add the MapController component inside MapContainer */}
        <MapController />

        <MapBoundsAdjuster locations={locations} ambulances={ambulances} emergencies={emergencies} />
        <MapClickHandler onLocationClick={handleLocationClick} />

        {/* Only render ambulances */}
        {ambulances.map((ambulance, index) => {
          const isSelected =
            selectedAmbulance &&
            ambulance.city === selectedAmbulance.city &&
            ambulance.county === selectedAmbulance.county

          return (
            <Marker
              key={`amb-${ambulance.city}-${index}`}
              position={[ambulance.latitude, ambulance.longitude]}
              icon={ambulanceIcon}
              opacity={isSelected ? 1 : 0.8}
            >
              <Popup>
                <div>
                  <strong>
                    {ambulance.city}, {ambulance.county}
                  </strong>
                  <div>Available: {ambulance.quantity}</div>
                  {selectedEmergency && (
                    <div>
                      Distance to selected emergency:{" "}
                      {calculateDistance(
                        ambulance.latitude,
                        ambulance.longitude,
                        selectedEmergency.latitude,
                        selectedEmergency.longitude,
                      ).toFixed(2)}
                    </div>
                  )}
                </div>
              </Popup>
              {isSelected && (
                <Circle
                  center={[ambulance.latitude, ambulance.longitude]}
                  radius={2000}
                  pathOptions={{ color: "blue", fillColor: "blue", fillOpacity: 0.2 }}
                />
              )}
            </Marker>
          )
        })}

        {/* Only render emergencies in queue */}
        {emergencies.map((emergency, index) => {
          const isSelected =
            selectedEmergency &&
            emergency.city === selectedEmergency.city &&
            emergency.county === selectedEmergency.county

          const totalNeeded = emergency.requests.reduce((sum, req) => sum + req.Quantity, 0)

          return (
            <Marker
              key={`emg-${emergency.city}-${index}`}
              position={[emergency.latitude, emergency.longitude]}
              icon={emergencyIcon}
              opacity={isSelected ? 1 : 0.8}
            >
              <Popup>
                <div>
                  <strong>
                    {emergency.city}, {emergency.county}
                  </strong>
                  <div>Ambulances needed: {totalNeeded}</div>
                  {selectedAmbulance && (
                    <div>
                      Distance from selected ambulance:{" "}
                      {calculateDistance(
                        selectedAmbulance.latitude,
                        selectedAmbulance.longitude,
                        emergency.latitude,
                        emergency.longitude,
                      ).toFixed(2)}
                    </div>
                  )}
                </div>
              </Popup>
              {isSelected && (
                <Circle
                  center={[emergency.latitude, emergency.longitude]}
                  radius={2000}
                  pathOptions={{ color: "red", fillColor: "red", fillOpacity: 0.2 }}
                />
              )}
            </Marker>
          )
        })}

        {/* Render route line - only if both selectedAmbulance and selectedEmergency are not null */}
        {selectedAmbulance && selectedEmergency && (
          <Polyline
            positions={[
              [selectedAmbulance.latitude, selectedAmbulance.longitude],
              [selectedEmergency.latitude, selectedEmergency.longitude],
            ]}
            color="blue"
            weight={3}
            opacity={0.7}
          />
        )}

        {/* Render clicked location marker */}
        {clickedLocation && (
          <Marker
            position={[clickedLocation.lat, clickedLocation.lng]}
            icon={
              new L.DivIcon({
                className: "custom-div-icon",
                html: `<div style="background-color: #6b7280; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white;"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })
            }
          >
            <Popup>
              <div>
                <strong>Clicked Location</strong>
                <div>
                  Lat: {clickedLocation.lat.toFixed(4)}, Lng: {clickedLocation.lng.toFixed(4)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Location info card */}
      {clickedLocation && (
        <Card className="absolute top-4 right-4 w-80 shadow-lg z-[1000]">
          <CardHeader className="pb-2 flex flex-row justify-between items-center">
            <CardTitle className="text-lg">{clickedLocationName}</CardTitle>
            <Button variant="ghost" size="sm" onClick={closeLocationInfo} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingNearby ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : nearbyAmbulances.length > 0 ? (
              <div className="space-y-2">
                <h3 className="font-medium">Available Ambulances Nearby:</h3>
                <div className="space-y-1">
                  {nearbyAmbulances.map((ambulance, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded-md">
                      <div className="font-medium">
                        {ambulance.city}, {ambulance.county}
                      </div>
                      <div className="text-sm">Available: {ambulance.quantity}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-2 text-center text-gray-500">No ambulances found nearby</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
