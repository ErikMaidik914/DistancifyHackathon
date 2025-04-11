"use client"

import { useEffect, useRef, useState } from "react"
import type { AmbulanceLocation, EmergencyCall, Location } from "@/types"
import { Card } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

interface MapContainerProps {
  locations: Location[]
  ambulances: AmbulanceLocation[]
  emergencies: EmergencyCall[]
  selectedEmergency: EmergencyCall | null
  selectedAmbulance: AmbulanceLocation | null
}

export function MapContainer({
  locations,
  ambulances,
  emergencies,
  selectedEmergency,
  selectedAmbulance,
}: MapContainerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Calculate bounds for the map
  const getBounds = () => {
    let minLat = Number.POSITIVE_INFINITY,
      maxLat = Number.NEGATIVE_INFINITY,
      minLong = Number.POSITIVE_INFINITY,
      maxLong = Number.NEGATIVE_INFINITY

    const allPoints = [
      ...locations.map((loc) => ({ lat: loc.lat, long: loc.long })),
      ...ambulances.map((amb) => ({ lat: amb.latitude, long: amb.longitude })),
      ...emergencies.map((emg) => ({ lat: emg.latitude, long: emg.longitude })),
    ]

    if (allPoints.length === 0) {
      return { minLat: 45, maxLat: 48, minLong: 20, maxLong: 30 } // Default for Romania
    }

    for (const point of allPoints) {
      minLat = Math.min(minLat, point.lat)
      maxLat = Math.max(maxLat, point.lat)
      minLong = Math.min(minLong, point.long)
      maxLong = Math.max(maxLong, point.long)
    }

    // Add padding
    const latPadding = (maxLat - minLat) * 0.1
    const longPadding = (maxLong - minLong) * 0.1

    return {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLong: minLong - longPadding,
      maxLong: maxLong + longPadding,
    }
  }

  const drawMap = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Get bounds
    const bounds = getBounds()

    // Draw background
    ctx.fillStyle = "#f0f0f0"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Function to convert coordinates to canvas position
    const toCanvasX = (long: number) => {
      return ((long - bounds.minLong) / (bounds.maxLong - bounds.minLong)) * canvas.width
    }

    const toCanvasY = (lat: number) => {
      return canvas.height - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * canvas.height
    }

    // Draw locations
    locations.forEach((location) => {
      const x = toCanvasX(location.long)
      const y = toCanvasY(location.lat)

      ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fillStyle = "#999999"
      ctx.fill()
    })

    // Draw ambulances
    ambulances.forEach((ambulance) => {
      const x = toCanvasX(ambulance.longitude)
      const y = toCanvasY(ambulance.latitude)

      const isSelected =
        selectedAmbulance && ambulance.city === selectedAmbulance.city && ambulance.county === selectedAmbulance.county

      ctx.beginPath()
      ctx.arc(x, y, isSelected ? 8 : 5, 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? "#2563eb" : "#3b82f6"
      ctx.fill()

      // Draw quantity
      ctx.font = "10px Arial"
      ctx.fillStyle = "#ffffff"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(ambulance.quantity.toString(), x, y)
    })

    // Draw emergencies
    emergencies.forEach((emergency) => {
      const x = toCanvasX(emergency.longitude)
      const y = toCanvasY(emergency.latitude)

      const isSelected =
        selectedEmergency && emergency.city === selectedEmergency.city && emergency.county === selectedEmergency.county

      ctx.beginPath()
      ctx.arc(x, y, isSelected ? 8 : 5, 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? "#dc2626" : "#ef4444"
      ctx.fill()

      // Draw quantity needed
      const quantity = emergency.requests.reduce((sum, req) => sum + req.Quantity, 0)
      ctx.font = "10px Arial"
      ctx.fillStyle = "#ffffff"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(quantity.toString(), x, y)
    })

    // Draw line between selected emergency and ambulance if both are selected
    if (selectedEmergency && selectedAmbulance) {
      const startX = toCanvasX(selectedAmbulance.longitude)
      const startY = toCanvasY(selectedAmbulance.latitude)
      const endX = toCanvasX(selectedEmergency.longitude)
      const endY = toCanvasY(selectedEmergency.latitude)

      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.strokeStyle = "#6366f1"
      ctx.lineWidth = 2
      ctx.stroke()
    }

    setIsLoading(false)
  }

  useEffect(() => {
    drawMap()

    // Redraw on window resize
    const handleResize = () => {
      drawMap()
    }

    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [locations, ambulances, emergencies, selectedEmergency, selectedAmbulance])

  return (
    <Card className="flex-1 m-4 relative overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}
      <div className="absolute top-2 left-2 z-10 bg-white p-2 rounded shadow-md text-sm">
        <div className="flex items-center mb-1">
          <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
          <span>Ambulance</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
          <span>Emergency</span>
        </div>
      </div>
      <canvas ref={canvasRef} className="w-full h-full"></canvas>
    </Card>
  )
}
