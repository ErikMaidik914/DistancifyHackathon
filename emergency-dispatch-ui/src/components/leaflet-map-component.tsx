"use client"

import { useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { EmergencyResource, EmergencyCall, Location, EmergencyType } from "@/types"
import { EMERGENCY_TYPE_COLORS } from "@/types"
import { calculateDistance } from "@/utils/distance"

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

// Custom icons
const createResourceIcon = (type: EmergencyType) => {
  const color = EMERGENCY_TYPE_COLORS[type]
  return new L.DivIcon({
    className: "custom-div-icon",
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; border: 2px solid white;">${type.charAt(0)}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  })
}

const createEmergencyIcon = () =>
  new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/2518/2518048.png", // Using a public URL for the icon
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })

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
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [map, locations, resources, emergencies])

  return null
}

interface LeafletMapProps {
  locations: Location[]
  resources: EmergencyResource[]
  emergencies: EmergencyCall[]
  selectedEmergency: EmergencyCall | null
  selectedResource: EmergencyResource | null
}

export default function LeafletMapComponent({
  locations,
  resources,
  emergencies,
  selectedEmergency,
  selectedResource,
}: LeafletMapProps) {
  // Create icons only on the client side
  const emergencyIcon = createEmergencyIcon()

  return (
    <div className="h-full w-full">
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

        <MapBoundsAdjuster locations={locations} resources={resources} emergencies={emergencies} />

        {/* Render locations */}
        {locations.map((location, index) => (
          <Marker key={`loc-${location.name}-${index}`} position={[location.lat, location.long]} opacity={0.6}>
            <Popup>
              <div>
                <strong>{location.name}</strong>
                <div>{location.county}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Render resources */}
        {resources.map((resource, index) => {
          const isSelected =
            selectedResource &&
            resource.city === selectedResource.city &&
            resource.county === selectedResource.county &&
            resource.type === selectedResource.type

          return (
            <Marker
              key={`res-${resource.city}-${resource.county}-${resource.type}-${index}`}
              position={[resource.latitude, resource.longitude]}
              icon={createResourceIcon(resource.type)}
              opacity={isSelected ? 1 : 0.8}
            >
              <Popup>
                <div>
                  <strong>
                    {resource.city}, {resource.county}
                  </strong>
                  <div>
                    {resource.type} Available: {resource.quantity}
                  </div>
                  {selectedEmergency && (
                    <div>
                      Distance to selected emergency:{" "}
                      {calculateDistance(
                        resource.latitude,
                        resource.longitude,
                        selectedEmergency.latitude,
                        selectedEmergency.longitude,
                      ).toFixed(2)}
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
                  <div>Resources needed: {totalNeeded}</div>
                  <div className="text-sm mt-1">
                    {emergency.requests.map((req) => (
                      <div key={req.Type} className="flex items-center">
                        <div
                          className="w-2 h-2 rounded-full mr-1"
                          style={{ backgroundColor: EMERGENCY_TYPE_COLORS[req.Type] }}
                        ></div>
                        <span>
                          {req.Type}: {req.Quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                  {selectedResource && (
                    <div>
                      Distance from selected resource:{" "}
                      {calculateDistance(
                        selectedResource.latitude,
                        selectedResource.longitude,
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
          />
        )}
      </MapContainer>
    </div>
  )
}
