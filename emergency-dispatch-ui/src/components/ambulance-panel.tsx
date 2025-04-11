"use client"

import { useState, useEffect } from "react"
import type { AmbulanceLocation, EmergencyCall } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Ambulance, ArrowRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { calculateDistance } from "@/utils/distance"
import { dispatchAmbulance } from "@/services/api"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { logger } from "./logger"

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
  const [suggestedAmbulance, setSuggestedAmbulance] = useState<AmbulanceLocation | null>(null)
  const [dispatchError, setDispatchError] = useState<string | null>(null)

  // Calculate the remaining ambulances needed for the selected emergency
  const getRemainingNeeded = () => {
    if (!selectedEmergency) return 0

    const totalNeeded = selectedEmergency.requests.reduce((sum, req) => sum + req.Quantity, 0)
    const dispatched = selectedEmergency.dispatched || 0
    return Math.max(0, totalNeeded - dispatched)
  }

  // Auto-suggest the best ambulance when an emergency is selected
  useEffect(() => {
    if (selectedEmergency && ambulances.length > 0) {
      // Find ambulances with available units
      const availableAmbulances = ambulances.filter((amb) => amb.quantity > 0)

      if (availableAmbulances.length > 0) {
        // Sort by distance to the emergency
        const sorted = [...availableAmbulances].sort((a, b) => {
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
        })

        // Suggest the closest ambulance
        setSuggestedAmbulance(sorted[0])

        // Auto-select if no ambulance is currently selected
        if (!selectedAmbulance) {
          onSelect(sorted[0])
        }

        // Set default dispatch quantity based on remaining need
        const remaining = getRemainingNeeded()
        if (remaining > 0) {
          const suggested = sorted[0]
          setDispatchQuantity(Math.min(remaining, suggested.quantity))
        }
      } else {
        setSuggestedAmbulance(null)
      }
    } else {
      setSuggestedAmbulance(null)
    }

    // Clear any previous dispatch errors when selection changes
    setDispatchError(null)
  }, [selectedEmergency, ambulances, selectedAmbulance, onSelect])

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
    if (!selectedAmbulance || !selectedEmergency) {
      setDispatchError("No ambulance or emergency selected")
      return
    }

    // Clear any previous errors
    setDispatchError(null)

    try {
      setIsDispatching(true)

      // Calculate distance for tracking
      const distance = calculateDistance(
        selectedAmbulance.latitude,
        selectedAmbulance.longitude,
        selectedEmergency.latitude,
        selectedEmergency.longitude,
      )

      // Log the dispatch attempt with detailed information
      logger.info("Attempting to dispatch ambulance", {
        sourceCounty: selectedAmbulance.county,
        sourceCity: selectedAmbulance.city,
        targetCounty: selectedEmergency.county,
        targetCity: selectedEmergency.city,
        quantity: dispatchQuantity,
        distance: distance,
      })

      // Make the API call with the correctly formatted request
      const response = await dispatchAmbulance({
        sourceCounty: selectedAmbulance.county,
        sourceCity: selectedAmbulance.city,
        targetCounty: selectedEmergency.county,
        targetCity: selectedEmergency.city,
        quantity: dispatchQuantity,
      })

      // Log the successful dispatch
      logger.info("Ambulance dispatched successfully", {
        response,
        from: `${selectedAmbulance.city}, ${selectedAmbulance.county}`,
        to: `${selectedEmergency.city}, ${selectedEmergency.county}`,
        quantity: dispatchQuantity,
      })

      // Show success toast
      toast.success("Ambulance Dispatched", {
        description: `Successfully dispatched ${dispatchQuantity} ambulance(s) from ${selectedAmbulance.city} to ${selectedEmergency.city}`,
      })

      // Update the UI via the parent component
      onDispatchSuccess(selectedAmbulance.city, selectedEmergency.city, dispatchQuantity, distance * dispatchQuantity)
    } catch (error) {
      // Handle the error and provide a user-friendly message
      console.error("Dispatch error:", error)

      let errorMessage = "Failed to dispatch ambulance. Please try again."

      if (error instanceof Error) {
        // Extract more specific error details if available
        if (error.message.includes("400")) {
          errorMessage = "Invalid dispatch request format. Please check the data and try again."
          logger.error("Invalid dispatch request format", { error: error.message })
        } else if (error.message.includes("404")) {
          errorMessage = "Ambulance or emergency location not found in the system."
          logger.error("Resource not found during dispatch", { error: error.message })
        } else if (error.message.includes("500")) {
          errorMessage = "Server error occurred. Please try again later."
          logger.error("Server error during dispatch", { error: error.message })
        } else if (error.message.includes("fetch failed")) {
          errorMessage = "Network error. Please check your connection and try again."
          logger.error("Network error during dispatch", { error: error.message })
        }

        // Set the error message for display in the UI
        setDispatchError(errorMessage)
      }

      // Show error toast
      toast.error("Dispatch Failed", {
        description: errorMessage,
      })
    } finally {
      setIsDispatching(false)
    }
  }

  const canDispatch = () => {
    if (!selectedAmbulance || !selectedEmergency) return false
    if (dispatchQuantity <= 0) return false
    if (dispatchQuantity > selectedAmbulance.quantity) return false

    // Check if there are still ambulances needed for this emergency
    const remaining = getRemainingNeeded()
    if (remaining <= 0) return false

    return true
  }

  // Calculate distance between selected ambulance and emergency
  const selectedDistance =
    selectedAmbulance && selectedEmergency
      ? calculateDistance(
          selectedAmbulance.latitude,
          selectedAmbulance.longitude,
          selectedEmergency.latitude,
          selectedEmergency.longitude,
        )
      : 0

  // Get ambulance rating based on distance and availability
  const getAmbulanceRating = (ambulance: AmbulanceLocation) => {
    if (!selectedEmergency) return null

    const distance = calculateDistance(
      ambulance.latitude,
      ambulance.longitude,
      selectedEmergency.latitude,
      selectedEmergency.longitude,
    )

    // Simple rating algorithm: closer is better, more available units is better
    if (distance < 0.1) return "Excellent"
    if (distance < 0.3) return "Good"
    if (distance < 0.5) return "Fair"
    return "Poor"
  }

  // Get color for rating
  const getRatingColor = (rating: string | null) => {
    if (!rating) return ""
    switch (rating) {
      case "Excellent":
        return "bg-green-100 text-green-800 border-green-300"
      case "Good":
        return "bg-blue-100 text-blue-800 border-blue-300"
      case "Fair":
        return "bg-yellow-100 text-yellow-800 border-yellow-300"
      case "Poor":
        return "bg-red-100 text-red-800 border-red-300"
      default:
        return ""
    }
  }

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

        {selectedEmergency && (
          <div className="bg-blue-50 p-2 rounded-md border border-blue-100">
            <p className="text-sm text-blue-700 font-medium">
              Emergency: {selectedEmergency.city}, {selectedEmergency.county}
            </p>
            <p className="text-xs text-blue-600">
              Ambulances needed: {getRemainingNeeded()} of{" "}
              {selectedEmergency.requests.reduce((sum, req) => sum + req.Quantity, 0)}
            </p>
            {suggestedAmbulance && (
              <p className="text-xs text-blue-600 mt-1">
                Suggested: {suggestedAmbulance.city} ({suggestedAmbulance.quantity} available)
              </p>
            )}
          </div>
        )}

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

                const isSuggested =
                  suggestedAmbulance &&
                  ambulance.city === suggestedAmbulance.city &&
                  ambulance.county === suggestedAmbulance.county

                let distance = 0
                if (selectedEmergency) {
                  distance = calculateDistance(
                    ambulance.latitude,
                    ambulance.longitude,
                    selectedEmergency.latitude,
                    selectedEmergency.longitude,
                  )
                }

                const rating = getAmbulanceRating(ambulance)

                return (
                  <Button
                    key={`${ambulance.city}-${ambulance.county}-${index}`}
                    variant={isSelected ? "default" : "outline"}
                    className={`w-full justify-start h-auto py-2 text-left ${isSuggested && !isSelected ? "border-blue-300 bg-blue-50" : ""}`}
                    onClick={() => onSelect(ambulance)}
                    disabled={ambulance.quantity <= 0}
                  >
                    <div className="flex flex-col w-full">
                      <div className="font-medium flex justify-between">
                        <span>
                          {ambulance.city}, {ambulance.county}
                          {isSuggested && !isSelected && (
                            <span className="ml-2 text-xs text-blue-600">(Suggested)</span>
                          )}
                        </span>
                        {rating && selectedEmergency && (
                          <Badge variant="outline" className={`text-xs ${getRatingColor(rating)}`}>
                            {rating}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex justify-between">
                        <span>
                          Available:{" "}
                          <span
                            className={`font-semibold ${ambulance.quantity > 0 ? "text-blue-500" : "text-gray-400"}`}
                          >
                            {ambulance.quantity}
                          </span>
                        </span>
                        {selectedEmergency && (
                          <span>
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
              <div className="flex justify-between">
                <span>
                  Distance: <span className="font-semibold">{selectedDistance.toFixed(2)}</span>
                </span>
                <span>
                  Needed: <span className="font-semibold text-red-500">{getRemainingNeeded()}</span>
                </span>
              </div>
              {dispatchQuantity > 1 && (
                <div className="mt-1">
                  Total distance:{" "}
                  <span className="font-semibold">{(selectedDistance * dispatchQuantity).toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div>
                <Label htmlFor="quantity">Quantity to dispatch:</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={Math.min(selectedAmbulance.quantity, getRemainingNeeded())}
                  value={dispatchQuantity}
                  onChange={(e) => setDispatchQuantity(Number.parseInt(e.target.value) || 0)}
                  className="w-full"
                />
              </div>

              {dispatchError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-2 text-sm text-red-600 flex items-start">
                  <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{dispatchError}</span>
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleDispatch}
                disabled={!canDispatch() || isDispatching}
                aria-label="Dispatch Ambulance"
              >
                {isDispatching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Dispatching...
                  </>
                ) : getRemainingNeeded() <= 0 ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Emergency Fulfilled
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
