"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline, useMapEvents } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { EmergencyResource, EmergencyCall, Location, EmergencyType } from "@/types"
import { EMERGENCY_TYPE_COLORS } from "@/types"
import { calculateDistance } from "@/utils/distance"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Info, AlertCircle, CheckCircle } from "lucide-react"
import { logger } from "./logger"
import { Progress } from "@/components/ui/progress"

// Fix Leaflet icon issues
const FixLeafletIcons = () => {
  useEffect(() => {
    // Fix Leaflet icon issues
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    })
  }, [])

  return null
}

// Map bounds adjuster component
function MapBoundsAdjuster({
  locations,
  resources,
  emergencies,
}: {
  locations: Location[]
  resources: EmergencyResource[]
  emergencies: EmergencyCall[]
}) {
  const map = useMap()
  const boundsRef = useRef<L.LatLngBounds | null>(null)

  useEffect(() => {
    if (locations.length === 0 && resources.length === 0 && emergencies.length === 0) {
      // Default view for Romania
      map.setView([45.9443, 25.0094], 7)
      return
    }

    const bounds = L.latLngBounds([])

    // Add locations to bounds
    locations.forEach((loc) => {
      bounds.extend([loc.lat, loc.long])
    })

    // Add resources to bounds
    resources.forEach((res) => {
      bounds.extend([res.latitude, res.longitude])
    })

    // Add emergencies to bounds
    emergencies.forEach((emg) => {
      bounds.extend([emg.latitude, emg.longitude])
    })

    if (bounds.isValid()) {
      // Only update bounds if they've changed significantly
      if (!boundsRef.current || !boundsRef.current.equals(bounds, 0.1)) {
        map.fitBounds(bounds, { padding: [50, 50], animate: true })
        boundsRef.current = bounds
      }
    }
  }, [map, locations, resources, emergencies])

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

// Create resource icon based on type
const createResourceIcon = (type: EmergencyType, quantity: number, isSelected = false) => {
  const color = EMERGENCY_TYPE_COLORS[type]
  const size = isSelected ? 30 : 24
  const borderWidth = isSelected ? 3 : 2
  const borderColor = isSelected ? "white" : "#f8f8f8"
  const isAvailable = quantity > 0

  return new L.DivIcon({
    className: "custom-div-icon",
    html: `
      <div style="
        background-color: ${isAvailable ? color : "#9ca3af"}; 
        width: ${size}px; 
        height: ${size}px; 
        border-radius: 50%; 
        display: flex; 
        justify-content: center; 
        align-items: center; 
        color: white; 
        font-weight: bold; 
        border: ${borderWidth}px solid ${borderColor};
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        ${quantity}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

// Create emergency icon
const createEmergencyIcon = (totalNeeded: number, isSelected = false, isFulfilled = false) => {
  const size = isSelected ? 30 : 24
  const borderWidth = isSelected ? 3 : 2
  const bgColor = isFulfilled ? "#10b981" : "#ef4444" // Green if fulfilled, red otherwise

  return new L.DivIcon({
    className: "custom-div-icon",
    html: `
      <div style="
        background-color: ${bgColor}; 
        width: ${size}px; 
        height: ${size}px; 
        border-radius: 50%; 
        display: flex; 
        justify-content: center; 
        align-items: center; 
        color: white; 
        font-weight: bold; 
        border: ${borderWidth}px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        ${isFulfilled ? "✓" : totalNeeded}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

interface MapProps {
  locations: Location[]
  resources: EmergencyResource[]
  emergencies: EmergencyCall[]
  selectedEmergency: EmergencyCall | null
  selectedResource: EmergencyResource | null
  onLoad?: () => void
  onError?: (error: string) => void
}

export default function Map({
  locations,
  resources,
  emergencies,
  selectedEmergency,
  selectedResource,
  onLoad,
  onError,
}: MapProps) {
  const [clickedLocation, setClickedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [nearbyResources, setNearbyResources] = useState<EmergencyResource[]>([])
  const [isLoadingNearby, setIsLoadingNearby] = useState(false)
  const [clickedLocationName, setClickedLocationName] = useState<string | null>(null)
  const [visibleTypes, setVisibleTypes] = useState<Record<EmergencyType, boolean>>({
    Medical: true,
    Police: true,
    Fire: true,
    Rescue: true,
    Utility: true,
  })
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)
  const [isMapReady, setIsMapReady] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Create a MapController component to handle map instance operations
  const MapController = () => {
    const map = useMap()

    useEffect(() => {
      setMapInstance(map)
      setIsMapReady(true)

      if (onLoad) {
        onLoad()
      }

      // Handle map errors
      map.on("error", (e: any) => {
        logger.error("Map error", { error: e.error || "Unknown map error" })
        if (onError) {
          onError(e.error || "An error occurred with the map")
        }
      })

      return () => {
        map.off("error")
      }
    }, [map])

    return null
  }

  // Update lastUpdated when resources or emergencies change
  useEffect(() => {
    setLastUpdated(new Date())
  }, [resources, emergencies])

  const handleLocationClick = useCallback(
    async (lat: number, lng: number) => {
      setClickedLocation({ lat, lng })
      setIsLoadingNearby(true)

      try {
        // Find the nearest location to the clicked point
        let nearestLocation: Location | null = null
        let minDistance = Number.MAX_VALUE

        locations.forEach((location) => {
          const distance = calculateDistance(lat, lng, location.lat, location.long)
          if (distance < minDistance) {
            minDistance = distance
            nearestLocation = location
          }
        })

        if (nearestLocation) {
          setClickedLocationName(`${nearestLocation.name}, ${nearestLocation.county}`)

          // Find resources near this location
          const nearby = resources.filter((resource) => {
            const distance = calculateDistance(resource.latitude, resource.longitude, lat, lng)
            return distance < 0.5 // Arbitrary threshold, adjust as needed
          })

          setNearbyResources(nearby)
        } else {
          setClickedLocationName("Unknown location")
          setNearbyResources([])
        }
      } catch (error) {
        logger.error("Error finding nearby resources:", { error })
        setNearbyResources([])
      } finally {
        setIsLoadingNearby(false)
      }
    },
    [locations, resources],
  )

  const closeLocationInfo = useCallback(() => {
    setClickedLocation(null)
    setNearbyResources([])
    setClickedLocationName(null)
  }, [])

  // Toggle visibility of a resource type
  const toggleResourceType = useCallback((type: EmergencyType) => {
    setVisibleTypes((prev) => ({
      ...prev,
      [type]: !prev[type],
    }))
  }, [])

  // Filter resources by visible types
  const filteredResources = resources.filter((resource) => visibleTypes[resource.type])

  // Get emergency requests by type with status
  const getEmergencyRequestsWithStatus = useCallback((emergency: EmergencyCall) => {
    return emergency.requests.map((req) => {
      const dispatched = (emergency.dispatched as Record<EmergencyType, number>)?.[req.Type] || 0
      const remaining = Math.max(0, req.Quantity - dispatched)
      const isFulfilled = remaining === 0

      return (
        <div key={req.Type} className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <div
              className="w-2 h-2 rounded-full mr-1"
              style={{ backgroundColor: EMERGENCY_TYPE_COLORS[req.Type] }}
            ></div>
            <span>{req.Type}:</span>
          </div>
          <div className="flex items-center">
            <span className={isFulfilled ? "text-green-600 font-medium" : "font-medium"}>
              {dispatched}/{req.Quantity}
            </span>
            {isFulfilled && <CheckCircle className="h-3 w-3 text-green-600 ml-1" />}
          </div>
        </div>
      )
    })
  }, [])

  // Calculate total needed resources for an emergency
  const calculateTotalNeeded = useCallback((emergency: EmergencyCall) => {
    return emergency.requests.reduce((sum, req) => sum + req.Quantity, 0)
  }, [])

  // Calculate dispatched resources for an emergency
  const calculateDispatched = useCallback((emergency: EmergencyCall) => {
    if (!emergency.dispatched) return 0
    return Object.values(emergency.dispatched as Record<EmergencyType, number>).reduce((sum, count) => sum + count, 0)
  }, [])

  // Calculate remaining needed resources for an emergency
  const calculateRemaining = useCallback(
    (emergency: EmergencyCall) => {
      const total = calculateTotalNeeded(emergency)
      const dispatched = calculateDispatched(emergency)
      return Math.max(0, total - dispatched)
    },
    [calculateTotalNeeded, calculateDispatched],
  )

  // Calculate completion percentage for an emergency
  const calculateCompletionPercentage = useCallback(
    (emergency: EmergencyCall) => {
      const total = calculateTotalNeeded(emergency)
      if (total === 0) return 100
      const dispatched = calculateDispatched(emergency)
      return Math.min(100, Math.round((dispatched / total) * 100))
    },
    [calculateTotalNeeded, calculateDispatched],
  )

  // Check if an emergency is fulfilled
  const isEmergencyFulfilled = useCallback(
    (emergency: EmergencyCall) => {
      return calculateRemaining(emergency) === 0
    },
    [calculateRemaining],
  )

  // Recenter map when selection changes
  useEffect(() => {
    if (!mapInstance || !isMapReady) return

    if (selectedEmergency && selectedResource) {
      // Create bounds that include both selected emergency and resource
      const bounds = L.latLngBounds([
        [selectedEmergency.latitude, selectedEmergency.longitude],
        [selectedResource.latitude, selectedResource.longitude],
      ])

      // Add padding to the bounds
      const paddedBounds = bounds.pad(0.3)
      mapInstance.fitBounds(paddedBounds, { animate: true })
    } else if (selectedEmergency) {
      mapInstance.setView([selectedEmergency.latitude, selectedEmergency.longitude], 10, { animate: true })
    } else if (selectedResource) {
      mapInstance.setView([selectedResource.latitude, selectedResource.longitude], 10, { animate: true })
    }
  }, [mapInstance, isMapReady, selectedEmergency, selectedResource])

  return (
    <div className="h-full w-full relative">
      {/* Type filter controls */}
      <div className="absolute top-2 left-2 z-10 bg-white p-2 rounded shadow-md">
        <div className="text-xs font-medium mb-1">Filter Resources:</div>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(visibleTypes) as EmergencyType[]).map((type) => (
            <Badge
              key={type}
              variant={visibleTypes[type] ? "default" : "outline"}
              className="cursor-pointer"
              style={{
                backgroundColor: visibleTypes[type] ? EMERGENCY_TYPE_COLORS[type] : "transparent",
                borderColor: EMERGENCY_TYPE_COLORS[type],
                color: visibleTypes[type] ? "white" : EMERGENCY_TYPE_COLORS[type],
              }}
              onClick={() => toggleResourceType(type)}
            >
              {type}
            </Badge>
          ))}
        </div>
      </div>

      {/* Map legend */}
      <div className="absolute bottom-2 left-2 z-10 bg-white p-2 rounded shadow-md text-xs">
        <div className="font-medium mb-1">Legend:</div>
        <div className="flex items-center mb-1">
          <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
          <span>Emergency</span>
        </div>
        <div className="flex items-center mb-1">
          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
          <span>Fulfilled Emergency</span>
        </div>
        {(Object.keys(EMERGENCY_TYPE_COLORS) as EmergencyType[]).map((type) => (
          <div key={type} className="flex items-center mb-1">
            <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: EMERGENCY_TYPE_COLORS[type] }}></div>
            <span>{type} Resources</span>
          </div>
        ))}
      </div>

      {/* Last updated indicator */}
      <div className="absolute bottom-2 right-2 z-10 bg-white p-2 rounded shadow-md text-xs">
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
          <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
        </div>
      </div>

      <MapContainer
        center={[45.9443, 25.0094]} // Center of Romania
        zoom={7}
        style={{ height: "100%", width: "100%" }}
      >
        <FixLeafletIcons />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Add the MapController component inside MapContainer */}
        <MapController />

        <MapBoundsAdjuster locations={locations} resources={resources} emergencies={emergencies} />
        <MapClickHandler onLocationClick={handleLocationClick} />

        {/* Render resources by type */}
        {filteredResources.map((resource, index) => {
          const isSelected =
            selectedResource &&
            resource.city === selectedResource.city &&
            resource.county === selectedResource.county &&
            resource.type === selectedResource.type

          return (
            <Marker
              key={`res-${resource.city}-${resource.county}-${resource.type}-${index}`}
              position={[resource.latitude, resource.longitude]}
              icon={createResourceIcon(resource.type, resource.quantity, isSelected)}
              opacity={isSelected ? 1 : 0.8}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-bold mb-1 flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-1"
                        style={{ backgroundColor: EMERGENCY_TYPE_COLORS[resource.type] }}
                      ></div>
                      <span>{resource.type} Resource</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`ml-2 text-xs ${resource.quantity > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                    >
                      {resource.quantity > 0 ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                  <div className="mb-1">
                    <strong>Location:</strong> {resource.city}, {resource.county}
                  </div>
                  <div className="mb-1">
                    <strong>Units:</strong>{" "}
                    <span className={resource.quantity > 0 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                      {resource.quantity}
                    </span>
                  </div>
                  {selectedEmergency && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-500 mb-1">Selected Emergency</div>
                      <div>
                        <strong>Distance:</strong>{" "}
                        {calculateDistance(
                          resource.latitude,
                          resource.longitude,
                          selectedEmergency.latitude,
                          selectedEmergency.longitude,
                        ).toFixed(2)}
                      </div>
                      {selectedEmergency.requests.some((req) => req.Type === resource.type) ? (
                        <div className="text-xs text-green-600 mt-1">This resource type is needed at the emergency</div>
                      ) : (
                        <div className="text-xs text-yellow-600 mt-1">This resource type is not requested</div>
                      )}
                    </div>
                  )}
                </div>
              </Popup>
              {isSelected && (
                <Circle
                  center={[resource.latitude, resource.longitude]}
                  radius={2000}
                  pathOptions={{
                    color: EMERGENCY_TYPE_COLORS[resource.type],
                    fillColor: EMERGENCY_TYPE_COLORS[resource.type],
                    fillOpacity: 0.2,
                  }}
                />
              )}
            </Marker>
          )
        })}

        {/* Render emergencies */}
        {emergencies.map((emergency, index) => {
          const isSelected =
            selectedEmergency &&
            emergency.city === selectedEmergency.city &&
            emergency.county === selectedEmergency.county

          const totalNeeded = calculateTotalNeeded(emergency)
          const remaining = calculateRemaining(emergency)
          const fulfilled = isEmergencyFulfilled(emergency)
          const completionPercentage = calculateCompletionPercentage(emergency)

          return (
            <Marker
              key={`emg-${emergency.city}-${emergency.county}-${index}`}
              position={[emergency.latitude, emergency.longitude]}
              icon={createEmergencyIcon(remaining, isSelected, fulfilled)}
              opacity={isSelected ? 1 : fulfilled ? 0.8 : 0.9}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-bold mb-1 flex items-center justify-between">
                    <span>Emergency</span>
                    {fulfilled ? (
                      <Badge variant="outline" className="bg-green-100 text-green-800">
                        Fulfilled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                        {remaining} needed
                      </Badge>
                    )}
                  </div>
                  <div className="mb-1">
                    <strong>Location:</strong> {emergency.city}, {emergency.county}
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Completion:</span>
                      <span>{completionPercentage}%</span>
                    </div>
                    <Progress
                      value={completionPercentage}
                      className="h-1.5"
                      indicatorClassName={fulfilled ? "bg-green-500" : "bg-blue-500"}
                    />
                  </div>

                  <div className="text-xs mt-2 pt-2 border-t border-gray-200">
                    <div className="font-medium mb-1">Resource Status:</div>
                    {getEmergencyRequestsWithStatus(emergency)}
                  </div>

                  {selectedResource && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-500 mb-1">Selected Resource</div>
                      <div className="flex items-center justify-between">
                        <span>{selectedResource.type}:</span>
                        <span
                          className={
                            selectedResource.quantity > 0 ? "text-green-600 font-medium" : "text-red-500 font-medium"
                          }
                        >
                          {selectedResource.quantity} units
                        </span>
                      </div>
                      <div className="mt-1">
                        <strong>Distance:</strong>{" "}
                        {calculateDistance(
                          selectedResource.latitude,
                          selectedResource.longitude,
                          emergency.latitude,
                          emergency.longitude,
                        ).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </Popup>
              {isSelected && (
                <Circle
                  center={[emergency.latitude, emergency.longitude]}
                  radius={2000}
                  pathOptions={{
                    color: fulfilled ? "green" : "red",
                    fillColor: fulfilled ? "green" : "red",
                    fillOpacity: 0.2,
                  }}
                />
              )}
            </Marker>
          )
        })}

        {/* Render route line - only if both selectedResource and selectedEmergency are not null */}
        {selectedResource && selectedEmergency && (
          <Polyline
            positions={[
              [selectedResource.latitude, selectedResource.longitude],
              [selectedEmergency.latitude, selectedEmergency.longitude],
            ]}
            color={EMERGENCY_TYPE_COLORS[selectedResource.type]}
            weight={3}
            opacity={0.7}
            dashArray={[5, 5]}
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
        <Card className="absolute bottom-10 right-4 w-64 shadow-lg z-20">
          <div className="p-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-sm">{clickedLocationName || "Selected Location"}</h3>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={closeLocationInfo}>
                ×
              </Button>
            </div>

            {isLoadingNearby ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
                <span className="text-sm">Loading nearby resources...</span>
              </div>
            ) : nearbyResources.length > 0 ? (
              <div>
                <div className="text-xs font-medium mb-1">Nearby Resources:</div>
                <div className="max-h-40 overflow-y-auto">
                  {nearbyResources.map((resource, index) => (
                    <div
                      key={index}
                      className="text-xs p-2 mb-1 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div
                            className="w-3 h-3 rounded-full mr-1"
                            style={{ backgroundColor: EMERGENCY_TYPE_COLORS[resource.type] }}
                          ></div>
                          <span className="font-medium">{resource.type}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            resource.quantity > 0
                              ? "bg-green-100 text-green-800 text-[10px]"
                              : "bg-red-100 text-red-800 text-[10px]"
                          }
                        >
                          {resource.quantity > 0 ? `${resource.quantity} units` : "Unavailable"}
                        </Badge>
                      </div>
                      <div className="mt-1">
                        <span className="text-gray-600">
                          {resource.city}, {resource.county}
                        </span>
                      </div>
                      {selectedEmergency && (
                        <div className="mt-1 text-[10px] flex justify-between">
                          <span>Distance:</span>
                          <span className="font-medium">
                            {calculateDistance(
                              resource.latitude,
                              resource.longitude,
                              selectedEmergency.latitude,
                              selectedEmergency.longitude,
                            ).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-4 text-gray-500 text-sm">
                <Info className="h-4 w-4 mr-1" />
                No resources found nearby
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Resource details card - only show when a resource is selected */}
      {selectedResource && (
        <Card className="absolute top-4 right-4 w-72 shadow-lg z-20">
          <div className="p-3">
            <div className="flex items-center mb-2 justify-between">
              <div className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full mr-1"
                  style={{ backgroundColor: EMERGENCY_TYPE_COLORS[selectedResource.type] }}
                ></div>
                <h3 className="font-medium text-sm">{selectedResource.type} Resource</h3>
              </div>
              <Badge
                variant="outline"
                className={`${selectedResource.quantity > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
              >
                {selectedResource.quantity > 0 ? `${selectedResource.quantity} units` : "Unavailable"}
              </Badge>
            </div>

            <div className="bg-gray-50 p-2 rounded mb-2">
              <div className="text-sm font-medium">
                {selectedResource.city}, {selectedResource.county}
              </div>
              <div className="text-xs text-gray-600">
                Coordinates: {selectedResource.latitude.toFixed(4)}, {selectedResource.longitude.toFixed(4)}
              </div>
            </div>

            {selectedEmergency && (
              <div className="bg-blue-50 p-2 rounded border border-blue-100">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-medium text-blue-800">Selected Emergency</div>
                  {isEmergencyFulfilled(selectedEmergency) ? (
                    <Badge variant="outline" className="bg-green-100 text-green-800 text-[10px]">
                      Fulfilled
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-[10px]">
                      {calculateRemaining(selectedEmergency)} needed
                    </Badge>
                  )}
                </div>
                <div className="text-xs">
                  {selectedEmergency.city}, {selectedEmergency.county}
                </div>
                <div className="mt-1 text-xs">
                  <strong>Distance:</strong>{" "}
                  {calculateDistance(
                    selectedResource.latitude,
                    selectedResource.longitude,
                    selectedEmergency.latitude,
                    selectedEmergency.longitude,
                  ).toFixed(2)}
                </div>

                {selectedEmergency.requests.some((req) => req.Type === selectedResource.type) ? (
                  <div className="mt-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span>Needed:</span>
                      <span className="font-medium">
                        {selectedEmergency.requests.find((req) => req.Type === selectedResource.type)?.Quantity || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Dispatched:</span>
                      <span className="font-medium">
                        {(selectedEmergency.dispatched as Record<EmergencyType, number>)?.[selectedResource.type] || 0}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-yellow-600">
                    <AlertCircle className="h-3 w-3 inline mr-1" />
                    This resource type is not requested
                  </div>
                )}
              </div>
            )}

            {!selectedEmergency && (
              <div className="text-xs text-gray-500 italic text-center mt-2">
                Select an emergency to see dispatch options
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
