// components/leaflet-map.tsx
"use client"

import { JSX, useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, CircleMarker } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { AmbulanceLocation, EmergencyCall, Location } from "@/types"
import { calculateDistance } from "@/utils/distance"

// Fix Leaflet icon issues
function useFixLeafletIcons() {
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    })
  }, [])
}

// Custom icons
const ambulanceIcon = new L.Icon({
  iconUrl: "/ambulance-icon.png", // You'll need to add this image to your public folder
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
})

const emergencyIcon = new L.Icon({
  iconUrl: "/emergency-icon.png", // You'll need to add this image to your public folder
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
})

// Map bounds adjuster component
function MapBoundsAdjuster({ locations, ambulances, emergencies }: {
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
    locations.forEach(loc => {
      bounds.extend([loc.lat, loc.long])
    })
    
    // Add ambulances to bounds
    ambulances.forEach(amb => {
      bounds.extend([amb.latitude, amb.longitude])
    })
    
    // Add emergencies to bounds
    emergencies.forEach(emg => {
      bounds.extend([emg.latitude, emg.longitude])
    })
    
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [map, locations, ambulances, emergencies])
  
  return null
}

interface LeafletMapProps {
  locations: Location[]
  ambulances: AmbulanceLocation[]
  emergencies: EmergencyCall[]
  selectedEmergency: EmergencyCall | null
  selectedAmbulance: AmbulanceLocation | null
}

export function LeafletMap({
  locations,
  ambulances,
  emergencies,
  selectedEmergency,
  selectedAmbulance,
}: LeafletMapProps): JSX.Element {
  // Fix Leaflet icon issues
  useFixLeafletIcons()

  // Draw line between selected ambulance and emergency
  const [routeLine, setRouteLine] = useState<L.Polyline | null>(null)
  
  useEffect(() => {
    if (selectedAmbulance && selectedEmergency) {
      const line = L.polyline(
        [
          [selectedAmbulance.latitude, selectedAmbulance.longitude],
          [selectedEmergency.latitude, selectedEmergency.longitude]
        ],
        { color: 'blue', weight: 3, opacity: 0.7 }
      )
      setRouteLine(line)
    } else {
      setRouteLine(null)
    }
  }, [selectedAmbulance, selectedEmergency])

  return (
    <div className="h-full w-full">
      <MapContainer
        center={[45.9443, 25.0094]} // Center of Romania
        zoom={7}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBoundsAdjuster 
          locations={locations} 
          ambulances={ambulances} 
          emergencies={emergencies} 
        />
        
        {/* Render locations */}
        {locations.map((location, index) => (
          <Marker 
            key={`loc-${location.name}-${index}`}
            position={[location.lat, location.long]}
            opacity={0.6}
          >
            <Popup>
              <div>
                <strong>{location.name}</strong>
                <div>{location.county}</div>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* Render ambulances */}
        {ambulances.map((ambulance, index) => {
          const isSelected = selectedAmbulance && 
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
                  <strong>{ambulance.city}, {ambulance.county}</strong>
                  <div>Available: {ambulance.quantity}</div>
                  {selectedEmergency && (
                    <div>
                      Distance to selected emergency: {
                        calculateDistance(
                          ambulance.latitude,
                          ambulance.longitude,
                          selectedEmergency.latitude,
                          selectedEmergency.longitude
                        ).toFixed(2)
                      }
                    </div>
                  )}
                </div>
              </Popup>
              {isSelected && (
                <CircleMarker 
                          center={[ambulance.latitude, ambulance.longitude]}
                          pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.2 }} radius={300}                />
              )}
            </Marker>
          )
        })}
        
        {/* Render emergencies */}
        {emergencies.map((emergency, index) => {
          const isSelected = selectedEmergency && 
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
                  <strong>{emergency.city}, {emergency.county}</strong>
                  <div>Ambulances needed: {totalNeeded}</div>
                  {selectedAmbulance && (
                    <div>
                      Distance from selected ambulance: {
                        calculateDistance(
                          selectedAmbulance.latitude,
                          selectedAmbulance.longitude,
                          emergency.latitude,
                          emergency.longitude
                        ).toFixed(2)
                      }
                    </div>
                  )}
                </div>
              </Popup>
              {isSelected && (
                <CircleMarker 
                  center={[emergency.latitude, emergency.longitude]}
                  radius={2000}
                  pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.2 }}
                />
              )}
            </Marker>
          )
        })}
        
        {/* Render route line */}
        {routeLine && (
          <Polyline 
            positions={[
              [selectedAmbulance!.latitude, selectedAmbulance!.longitude],
              [selectedEmergency!.latitude, selectedEmergency!.longitude]
            ]}
            pathOptions={{ color: "blue", weight: 3, opacity: 0.7 }}
          />
        )}
      </MapContainer>
    </div>
  )
}