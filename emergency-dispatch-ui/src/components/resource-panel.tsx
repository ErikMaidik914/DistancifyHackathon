"use client"

import { useState, useEffect } from "react"
import type { EmergencyCall, EmergencyResource, EmergencyType } from "@/types"
import { EMERGENCY_TYPE_COLORS } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Ambulance, ArrowRight, Loader2, CheckCircle2, AlertCircle, Filter } from "lucide-react"
import { calculateDistance } from "@/utils/distance"
import { dispatchResource } from "@/services/api"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { logger } from "./logger"

interface ResourcePanelProps {
  resources: EmergencyResource[]
  onSelect: (resource: EmergencyResource) => void
  selectedResource: EmergencyResource | null
  selectedEmergency: EmergencyCall | null
  onDispatchSuccess: (from: string, to: string, quantity: number, distance: number, type: EmergencyType) => void
}

export function ResourcePanel({
  resources,
  onSelect,
  selectedResource,
  selectedEmergency,
  onDispatchSuccess,
}: ResourcePanelProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [dispatchQuantity, setDispatchQuantity] = useState(1)
  const [isDispatching, setIsDispatching] = useState(false)
  const [suggestedResource, setSuggestedResource] = useState<EmergencyResource | null>(null)
  const [dispatchError, setDispatchError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<EmergencyType>("Medical")
  const [typeFilters, setTypeFilters] = useState<Record<EmergencyType, boolean>>({
    Medical: true,
    Police: true,
    Fire: true,
    Rescue: true,
    Utility: true,
  })

  // Calculate the remaining resources needed for the selected emergency by type
  const getRemainingNeededByType = (type: EmergencyType) => {
    if (!selectedEmergency) return 0

    // Find requests of this type
    const typeRequests = selectedEmergency.requests.filter((req) => req.Type === type)
    const totalNeeded = typeRequests.reduce((sum, req) => sum + req.Quantity, 0)

    // Get dispatched count for this type
    const dispatched = (selectedEmergency.dispatched as unknown as Record<EmergencyType, number>)?.[type] || 0

    return Math.max(0, totalNeeded - dispatched)
  }

  // Auto-suggest the best resource when an emergency is selected
  useEffect(() => {
    if (selectedEmergency && resources.length > 0) {
      // Get the emergency types needed
      const neededTypes = selectedEmergency.requests.map((req) => req.Type)

      // If we have an active tab, prioritize that type
      const priorityType = neededTypes.includes(activeTab) ? activeTab : neededTypes[0]

      if (priorityType) {
        // Find resources of this type with available units
        const availableResources = resources.filter((res) => res.type === priorityType && res.quantity > 0)

        if (availableResources.length > 0) {
          // Sort by distance to the emergency
          const sorted = [...availableResources].sort((a, b) => {
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

          // Suggest the closest resource
          setSuggestedResource(sorted[0])

          // Auto-select if no resource is currently selected
          if (!selectedResource) {
            onSelect(sorted[0])
          }

          // Set default dispatch quantity based on remaining need
          const remaining = getRemainingNeededByType(priorityType)
          if (remaining > 0) {
            const suggested = sorted[0]
            setDispatchQuantity(Math.min(remaining, suggested.quantity))
          }

          // Set the active tab to the priority type
          setActiveTab(priorityType)
        } else {
          setSuggestedResource(null)
        }
      }
    } else {
      setSuggestedResource(null)
    }

    // Clear any previous dispatch errors when selection changes
    setDispatchError(null)
  }, [selectedEmergency, resources, selectedResource, onSelect, activeTab])

  // Filter resources based on search term, type filters, and active tab
  const filteredResources = resources
    .filter(
      (resource) =>
        // Match search term
        (resource.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
          resource.county.toLowerCase().includes(searchTerm.toLowerCase())) &&
        // Match type filters
        typeFilters[resource.type] &&
        // Match active tab
        resource.type === activeTab,
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
    if (!selectedResource || !selectedEmergency) {
      setDispatchError("No resource or emergency selected")
      return
    }

    // Clear any previous errors
    setDispatchError(null)

    try {
      setIsDispatching(true)

      // Calculate distance for tracking
      const distance = calculateDistance(
        selectedResource.latitude,
        selectedResource.longitude,
        selectedEmergency.latitude,
        selectedEmergency.longitude,
      )

      // Log the dispatch attempt with detailed information
      logger.info(`Attempting to dispatch ${selectedResource.type} resource`, {
        type: selectedResource.type,
        sourceCounty: selectedResource.county,
        sourceCity: selectedResource.city,
        targetCounty: selectedEmergency.county,
        targetCity: selectedEmergency.city,
        quantity: dispatchQuantity,
        distance: distance,
      })

      // Make the API call with the correctly formatted request
      const response = await dispatchResource(selectedResource.type, {
        sourceCounty: selectedResource.county,
        sourceCity: selectedResource.city,
        targetCounty: selectedEmergency.county,
        targetCity: selectedEmergency.city,
        quantity: dispatchQuantity,
      })

      // Log the successful dispatch
      logger.info(`${selectedResource.type} resource dispatched successfully`, {
        response,
        type: selectedResource.type,
        from: `${selectedResource.city}, ${selectedResource.county}`,
        to: `${selectedEmergency.city}, ${selectedEmergency.county}`,
        quantity: dispatchQuantity,
      })

      // Show success toast
      toast.success(`${selectedResource.type} Dispatched`, {
        description: `Successfully dispatched ${dispatchQuantity} ${selectedResource.type.toLowerCase()} unit(s) from ${selectedResource.city} to ${selectedEmergency.city}`,
      })

      // Update the UI via the parent component
      onDispatchSuccess(
        selectedResource.city,
        selectedEmergency.city,
        dispatchQuantity,
        distance * dispatchQuantity,
        selectedResource.type,
      )
    } catch (error) {
      // Handle the error and provide a user-friendly message
      console.error("Dispatch error:", error)

      let errorMessage = `Failed to dispatch ${selectedResource.type.toLowerCase()} resource. Please try again.`

      if (error instanceof Error) {
        // Extract more specific error details if available
        if (error.message.includes("400")) {
          errorMessage = "Invalid dispatch request format. Please check the data and try again."
          logger.error("Invalid dispatch request format", { error: error.message })
        } else if (error.message.includes("404")) {
          errorMessage = "Resource or emergency location not found in the system."
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
    if (!selectedResource || !selectedEmergency) return false
    if (dispatchQuantity <= 0) return false
    if (dispatchQuantity > selectedResource.quantity) return false

    // Check if there are still resources needed for this emergency of the selected type
    const remaining = getRemainingNeededByType(selectedResource.type)
    if (remaining <= 0) return false

    // Check if the emergency actually needs this type of resource
    const needsThisType = selectedEmergency.requests.some((req) => req.Type === selectedResource.type)
    if (!needsThisType) return false

    return true
  }

  // Calculate distance between selected resource and emergency
  const selectedDistance =
    selectedResource && selectedEmergency
      ? calculateDistance(
          selectedResource.latitude,
          selectedResource.longitude,
          selectedEmergency.latitude,
          selectedEmergency.longitude,
        )
      : 0

  // Get resource rating based on distance and availability
  const getResourceRating = (resource: EmergencyResource) => {
    if (!selectedEmergency) return null

    const distance = calculateDistance(
      resource.latitude,
      resource.longitude,
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

  // Toggle a type filter
  const toggleTypeFilter = (type: EmergencyType) => {
    setTypeFilters((prev) => ({
      ...prev,
      [type]: !prev[type],
    }))

    // If we're toggling the current tab off, switch to another active tab
    if (type === activeTab && typeFilters[type]) {
      const nextActiveType =
        Object.entries(typeFilters)
          .filter(([t, active]) => t !== type && active)
          .map(([t]) => t as EmergencyType)[0] || "Medical"

      setActiveTab(nextActiveType)
    }
  }

  // Check if all filters are selected
  const allFiltersSelected = Object.values(typeFilters).every(Boolean)

  // Toggle all filters
  const toggleAllFilters = () => {
    const newValue = !allFiltersSelected
    setTypeFilters({
      Medical: newValue,
      Police: newValue,
      Fire: newValue,
      Rescue: newValue,
      Utility: newValue,
    })
  }

  // Get the icon for a resource type
  const getResourceTypeIcon = (type: EmergencyType) => {
    switch (type) {
      case "Medical":
        return <Ambulance className="h-5 w-5 text-red-500 mr-2" />
      case "Police":
        return (
          <div className="h-5 w-5 bg-blue-500 rounded-full mr-2 flex items-center justify-center text-white text-xs font-bold">
            P
          </div>
        )
      case "Fire":
        return (
          <div className="h-5 w-5 bg-orange-500 rounded-full mr-2 flex items-center justify-center text-white text-xs font-bold">
            F
          </div>
        )
      case "Rescue":
        return (
          <div className="h-5 w-5 bg-yellow-500 rounded-full mr-2 flex items-center justify-center text-white text-xs font-bold">
            R
          </div>
        )
      case "Utility":
        return (
          <div className="h-5 w-5 bg-green-500 rounded-full mr-2 flex items-center justify-center text-white text-xs font-bold">
            U
          </div>
        )
      default:
        return <div className="h-5 w-5 bg-gray-500 rounded-full mr-2"></div>
    }
  }

  // Count resources by type
  const resourceCounts = resources.reduce(
    (counts, resource) => {
      counts[resource.type] = (counts[resource.type] || 0) + 1
      return counts
    },
    {} as Record<EmergencyType, number>,
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center">
            {getResourceTypeIcon(activeTab)}
            Available Resources
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2">
                <Filter className="h-4 w-4 mr-1" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem checked={allFiltersSelected} onCheckedChange={toggleAllFilters}>
                All Types
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={typeFilters.Medical}
                onCheckedChange={() => toggleTypeFilter("Medical")}
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                  Medical ({resourceCounts.Medical || 0})
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={typeFilters.Police} onCheckedChange={() => toggleTypeFilter("Police")}>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                  Police ({resourceCounts.Police || 0})
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={typeFilters.Fire} onCheckedChange={() => toggleTypeFilter("Fire")}>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
                  Fire ({resourceCounts.Fire || 0})
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={typeFilters.Rescue} onCheckedChange={() => toggleTypeFilter("Rescue")}>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                  Rescue ({resourceCounts.Rescue || 0})
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={typeFilters.Utility}
                onCheckedChange={() => toggleTypeFilter("Utility")}
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                  Utility ({resourceCounts.Utility || 0})
                </div>
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EmergencyType)}>
          <TabsList className="w-full grid grid-cols-5">
            {typeFilters.Medical && (
              <TabsTrigger value="Medical" disabled={!typeFilters.Medical}>
                <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                Medical
              </TabsTrigger>
            )}
            {typeFilters.Police && (
              <TabsTrigger value="Police" disabled={!typeFilters.Police}>
                <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                Police
              </TabsTrigger>
            )}
            {typeFilters.Fire && (
              <TabsTrigger value="Fire" disabled={!typeFilters.Fire}>
                <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
                Fire
              </TabsTrigger>
            )}
            {typeFilters.Rescue && (
              <TabsTrigger value="Rescue" disabled={!typeFilters.Rescue}>
                <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                Rescue
              </TabsTrigger>
            )}
            {typeFilters.Utility && (
              <TabsTrigger value="Utility" disabled={!typeFilters.Utility}>
                <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                Utility
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

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
            <div className="text-xs text-blue-600">
              {selectedEmergency.requests.map((req) => (
                <p key={req.Type}>
                  {req.Type} needed: {getRemainingNeededByType(req.Type)} of {req.Quantity}
                </p>
              ))}
            </div>
            {suggestedResource && (
              <p className="text-xs text-blue-600 mt-1">
                Suggested: {suggestedResource.city} ({suggestedResource.quantity} {suggestedResource.type} available)
              </p>
            )}
          </div>
        )}

        <ScrollArea className="h-[200px]">
          {filteredResources.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No {activeTab.toLowerCase()} resources available</div>
          ) : (
            <div className="space-y-1">
              {filteredResources.map((resource, index) => {
                const isSelected =
                  selectedResource &&
                  resource.city === selectedResource.city &&
                  resource.county === selectedResource.county &&
                  resource.type === selectedResource.type

                const isSuggested =
                  suggestedResource &&
                  resource.city === suggestedResource.city &&
                  resource.county === suggestedResource.county &&
                  resource.type === suggestedResource.type

                let distance = 0
                if (selectedEmergency) {
                  distance = calculateDistance(
                    resource.latitude,
                    resource.longitude,
                    selectedEmergency.latitude,
                    selectedEmergency.longitude,
                  )
                }

                const rating = getResourceRating(resource)
                const typeColor = EMERGENCY_TYPE_COLORS[resource.type]

                return (
                  <Button
                    key={`${resource.city}-${resource.county}-${resource.type}-${index}`}
                    variant={isSelected ? "default" : "outline"}
                    className={`w-full justify-start h-auto py-2 text-left ${isSuggested && !isSelected ? `border-${typeColor} bg-${typeColor}/10` : ""}`}
                    onClick={() => onSelect(resource)}
                    disabled={resource.quantity <= 0}
                    style={
                      isSuggested && !isSelected ? { borderColor: typeColor, backgroundColor: `${typeColor}10` } : {}
                    }
                  >
                    <div className="flex flex-col w-full">
                      <div className="font-medium flex justify-between">
                        <span>
                          {resource.city}, {resource.county}
                          {isSuggested && !isSelected && (
                            <span className="ml-2 text-xs" style={{ color: typeColor }}>
                              (Suggested)
                            </span>
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
                            className={`font-semibold ${resource.quantity > 0 ? "text-blue-500" : "text-gray-400"}`}
                          >
                            {resource.quantity}
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

        {selectedEmergency && selectedResource && (
          <div className="border rounded-md p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">{selectedResource.city}</div>
              <ArrowRight className="h-4 w-4 text-gray-500" />
              <div className="text-sm font-medium">{selectedEmergency.city}</div>
            </div>

            <div className="text-sm mb-2">
              <div className="flex justify-between">
                <span>
                  Distance: <span className="font-semibold">{selectedDistance.toFixed(2)}</span>
                </span>
                <span>
                  {selectedResource.type} Needed:{" "}
                  <span className="font-semibold text-red-500">{getRemainingNeededByType(selectedResource.type)}</span>
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
                  max={Math.min(selectedResource.quantity, getRemainingNeededByType(selectedResource.type))}
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
                aria-label={`Dispatch ${selectedResource.type}`}
                style={{ backgroundColor: canDispatch() ? EMERGENCY_TYPE_COLORS[selectedResource.type] : undefined }}
              >
                {isDispatching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Dispatching...
                  </>
                ) : getRemainingNeededByType(selectedResource.type) <= 0 ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Emergency Fulfilled
                  </>
                ) : (
                  `Dispatch ${selectedResource.type}`
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
