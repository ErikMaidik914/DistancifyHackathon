"use client"

import { useState } from "react"
import type { AmbulanceLocation, EmergencyCall } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Ambulance, ArrowRight, Loader2 } from 'lucide-react'
import { calculateDistance } from "@/utils/distance"
import { dispatchAmbulance } from "@/services/api"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from 'sonner'

interface AmbulancePanelProps {
  ambulances: AmbulanceLocation[]
  onSelect: (ambulance: AmbulanceLocation) => void
  selectedAmbulance: AmbulanceLocation | null
  selectedEmergency: EmergencyCall | null
  onDispatchSuccess: (from: string, to: string, quantity: number, distance: number) => void
}

export function AmbulancePanel({
  ambulances,
  onSelect,
  selectedAmbulance,
  selectedEmergency,
  onDispatchSuccess,
}: AmbulancePanelProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [dispatchQuantity, setDispatchQuantity] = useState(1)
  const [isDispatching, setIsDispatching] = useState(false)

  const filteredAmbulances = ambulances
    .filter(
      (ambulance) =>
        ambulance.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ambulance.county.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      if (selectedEmergency) {
        const distA = calculateDistance(
          a.latitude,
          a.longitude,
          selectedEmergency.latitude,
          selectedEmergency.longitude,
        )
        const distB = calculateDistance(
          b.latitude,
          b.longitude,
          selectedEmergency.latitude,
          selectedEmergency.longitude,
        )
        return distA - distB
      }
      return 0
    })

  const handleDispatch = async () => {
    if (!selectedAmbulance || !selectedEmergency) return

    try {
      setIsDispatching(true)

      // Calculate distance for tracking
      const distance = calculateDistance(
        selectedAmbulance.latitude,
        selectedAmbulance.longitude,
        selectedEmergency.latitude,
        selectedEmergency.longitude,
      )

      // Updated dispatch request format
      await dispatchAmbulance({
        sourceCounty: selectedAmbulance.county,
        sourceCity: selectedAmbulance.city,
        targetCounty: selectedEmergency.county,
        targetCity: selectedEmergency.city,
        quantity: dispatchQuantity,
      })

      toast.success('Ambulance Dispatched', {
        description: `Successfully dispatched ${dispatchQuantity} ambulance(s) from ${selectedAmbulance.city} to ${selectedEmergency.city}`
      })

      // Pass the distance to the parent component
      onDispatchSuccess(
        selectedAmbulance.city, 
        selectedEmergency.city, 
        dispatchQuantity, 
        distance * dispatchQuantity
      )
    } catch (error) {
      console.error(error)
      toast.error('Dispatch Failed', {
        description: 'Failed to dispatch ambulance. Please try again.'
      })
    } finally {
      setIsDispatching(false)
    }
  }

  const canDispatch = () => {
    if (!selectedAmbulance || !selectedEmergency) return false
    if (dispatchQuantity <= 0) return false
    if (dispatchQuantity > selectedAmbulance.quantity) return false
    return true
  }

  // Calculate distance between selected ambulance and emergency
  const selectedDistance = selectedAmbulance && selectedEmergency
    ? calculateDistance(
        selectedAmbulance.latitude,
        selectedAmbulance.longitude,
        selectedEmergency.latitude,
        selectedEmergency.longitude,
      )
    : 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          <Ambulance className="h-5 w-5 text-blue-500 mr-2" />
          Available Ambulances
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Input
            placeholder="Search by city or county..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>

        <ScrollArea className="h-[200px]">
          {filteredAmbulances.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No ambulances available</div>
          ) : (
            <div className="space-y-1">
              {filteredAmbulances.map((ambulance, index) => {
                const isSelected =
                  selectedAmbulance &&
                  ambulance.city === selectedAmbulance.city &&
                  ambulance.county === selectedAmbulance.county

                let distance = 0
                if (selectedEmergency) {
                  distance = calculateDistance(
                    ambulance.latitude,
                    ambulance.longitude,
                    selectedEmergency.latitude,
                    selectedEmergency.longitude,
                  )
                }

                return (
                  <Button
                    key={`${ambulance.city}-${ambulance.county}-${index}`}
                    variant={isSelected ? "default" : "outline"}
                    className="w-full justify-start h-auto py-2 text-left"
                    onClick={() => onSelect(ambulance)}
                  >
                    <div className="flex flex-col">
                      <div className="font-medium">
                        {ambulance.city}, {ambulance.county}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Available: <span className="font-semibold text-blue-500">{ambulance.quantity}</span>
                        {selectedEmergency && (
                          <span className="ml-2">
                            Distance: <span className="font-semibold">{distance.toFixed(2)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </Button>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {selectedEmergency && selectedAmbulance && (
          <div className="border rounded-md p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">{selectedAmbulance.city}</div>
              <ArrowRight className="h-4 w-4 text-gray-500" />
              <div className="text-sm font-medium">{selectedEmergency.city}</div>
            </div>

            <div className="text-sm mb-2">
              Distance: <span className="font-semibold">{selectedDistance.toFixed(2)}</span>
              {dispatchQuantity > 1 && (
                <span className="ml-2">
                  Total: <span className="font-semibold">{(selectedDistance * dispatchQuantity).toFixed(2)}</span>
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div>
                <Label htmlFor="quantity">Quantity to dispatch:</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={selectedAmbulance.quantity}
                  value={dispatchQuantity}
                  onChange={(e) => setDispatchQuantity(Number.parseInt(e.target.value) || 0)}
                  className="w-full"
                />
              </div>

              <Button className="w-full" onClick={handleDispatch} disabled={!canDispatch() || isDispatching}>
                {isDispatching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Dispatching...
                  </>
                ) : (
                  "Dispatch Ambulance"
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}