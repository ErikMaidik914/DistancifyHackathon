"use client"

import { useEffect, useState, useCallback } from "react"
import type { EmergencyCall, EmergencyStatus, EmergencyType } from "@/types"
import { EMERGENCY_TYPE_COLORS } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { AlertCircle, Loader2, Filter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface EmergencyPanelProps {
  emergencies: EmergencyCall[]
  onSelect: (emergency: EmergencyCall) => void
  selectedEmergency: EmergencyCall | null
}

export function EmergencyPanel({ emergencies, onSelect, selectedEmergency }: EmergencyPanelProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [prevEmergencyCount, setPrevEmergencyCount] = useState(0)
  const [highlightedEmergencies, setHighlightedEmergencies] = useState<Record<string, boolean>>({})
  const [typeFilters, setTypeFilters] = useState<Record<EmergencyType, boolean>>({
    Medical: true,
    Police: true,
    Fire: true,
    Rescue: true,
    Utility: true,
  })

  // Detect changes in emergencies to highlight new or updated ones
  useEffect(() => {
    if (prevEmergencyCount > 0 && emergencies.length !== prevEmergencyCount) {
      setIsUpdating(true)

      // Create a map of emergency IDs to highlight
      const newHighlights: Record<string, boolean> = {}

      emergencies.forEach((emergency) => {
        const id = `${emergency.city}-${emergency.county}`
        newHighlights[id] = true
      })

      setHighlightedEmergencies(newHighlights)

      // Clear highlights after 2 seconds
      const timer = setTimeout(() => {
        setHighlightedEmergencies({})
        setIsUpdating(false)
      }, 2000)

      return () => clearTimeout(timer)
    }

    setPrevEmergencyCount(emergencies.length)
  }, [emergencies, prevEmergencyCount])

  // Add this useEffect right after the existing useEffect for highlighting
  useEffect(() => {
    // When emergencies change, ensure UI is updated
    setPrevEmergencyCount(emergencies.length)

    // If we have a selected emergency, update it with the latest data
    if (selectedEmergency) {
      const updatedEmergency = emergencies.find(
        (e) => e.city === selectedEmergency.city && e.county === selectedEmergency.county,
      )

      if (updatedEmergency) {
        // Update the selected emergency without triggering a full selection change
        onSelect(updatedEmergency)
      }
    }
  }, [emergencies, selectedEmergency, onSelect])

  // Generate a unique ID for an emergency
  const getEmergencyId = (emergency: EmergencyCall, index: number) => {
    return `${emergency.city}-${emergency.county}-${index}`
  }

  // Check if an emergency is highlighted
  const isHighlighted = (emergency: EmergencyCall) => {
    const id = `${emergency.city}-${emergency.county}`
    return highlightedEmergencies[id]
  }

  // Calculate emergency status (total, dispatched, remaining) for a specific type
  const getEmergencyStatusByType = (emergency: EmergencyCall, type: EmergencyType): EmergencyStatus => {
    // Find requests of this type
    const typeRequests = emergency.requests.filter((req) => req.Type === type)
    const total = typeRequests.reduce((sum, req) => sum + req.Quantity, 0)

    // Get dispatched count for this type
    const dispatched = (emergency.dispatched as Record<EmergencyType, number>)?.[type] || 0
    const remaining = Math.max(0, total - dispatched)

    return { total, dispatched, remaining }
  }

  // Calculate overall emergency status (total, dispatched, remaining)
  const getEmergencyStatus = useCallback((emergency: EmergencyCall): EmergencyStatus => {
    const total = emergency.requests.reduce((sum, req) => sum + req.Quantity, 0)

    // Sum up dispatched counts across all types
    const dispatched = Object.values((emergency.dispatched as Record<EmergencyType, number>) || {}).reduce(
      (sum, count) => sum + count,
      0,
    )

    const remaining = Math.max(0, total - dispatched)

    return { total, dispatched, remaining }
  }, [])

  // Get status color based on dispatch progress
  const getStatusColor = (status: EmergencyStatus) => {
    if (status.remaining === 0) return "bg-green-500"
    if (status.dispatched === 0) return "bg-red-500"
    return "bg-yellow-500"
  }

  // Calculate progress percentage
  const getProgressPercentage = (status: EmergencyStatus) => {
    if (status.total === 0) return 0
    return (status.dispatched / status.total) * 100
  }

  // Check if an emergency has a specific type of request
  const hasEmergencyType = (emergency: EmergencyCall, type: EmergencyType): boolean => {
    return emergency.requests.some((req) => req.Type === type)
  }

  // Filter emergencies based on selected types
  const filteredEmergencies = emergencies.filter((emergency) => {
    // Check if any of the emergency's request types match our active filters
    return emergency.requests.some((req) => typeFilters[req.Type])
  })

  // Toggle a type filter
  const toggleTypeFilter = (type: EmergencyType) => {
    setTypeFilters((prev) => ({
      ...prev,
      [type]: !prev[type],
    }))
  }

  // Check if all filters are selected
  const allFiltersSelected = Object.values(typeFilters).every(Boolean)

  // Check if no filters are selected
  const noFiltersSelected = Object.values(typeFilters).every((value) => !value)

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

  // Get emergency type badges
  const getEmergencyTypeBadges = (emergency: EmergencyCall) => {
    // Get unique types from requests
    const types = [...new Set(emergency.requests.map((req) => req.Type))]

    return types.map((type) => {
      const status = getEmergencyStatusByType(emergency, type)
      const bgColor = EMERGENCY_TYPE_COLORS[type]

      return (
        <Badge
          key={type}
          variant="outline"
          className="mr-1 mb-1"
          style={{
            backgroundColor: `${bgColor}20`,
            borderColor: bgColor,
            color: bgColor,
          }}
        >
          {type}: {status.remaining}/{status.total}
        </Badge>
      )
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            Emergencies ({filteredEmergencies.length})
          </div>
          <div className="flex items-center">
            {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-blue-500 mr-2" />}
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
                    Medical
                  </div>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={typeFilters.Police}
                  onCheckedChange={() => toggleTypeFilter("Police")}
                >
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                    Police
                  </div>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={typeFilters.Fire} onCheckedChange={() => toggleTypeFilter("Fire")}>
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
                    Fire
                  </div>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={typeFilters.Rescue}
                  onCheckedChange={() => toggleTypeFilter("Rescue")}
                >
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                    Rescue
                  </div>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={typeFilters.Utility}
                  onCheckedChange={() => toggleTypeFilter("Utility")}
                >
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                    Utility
                  </div>
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[200px]">
          {filteredEmergencies.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {noFiltersSelected
                ? "No filters selected. Please select at least one emergency type."
                : "No active emergencies"}
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredEmergencies.map((emergency, index) => {
                const status = getEmergencyStatus(emergency)
                const isSelected =
                  selectedEmergency &&
                  emergency.city === selectedEmergency.city &&
                  emergency.county === selectedEmergency.county

                return (
                  <Button
                    key={getEmergencyId(emergency, index)}
                    variant={isSelected ? "default" : "outline"}
                    className={`w-full justify-start h-auto py-2 text-left transition-colors ${
                      isHighlighted(emergency) ? "bg-yellow-50 border-yellow-200" : ""
                    }`}
                    onClick={() => onSelect(emergency)}
                  >
                    <div className="flex flex-col w-full">
                      <div className="font-medium flex justify-between items-center">
                        <span>
                          {emergency.city}, {emergency.county}
                        </span>
                        {isHighlighted(emergency) && (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 ml-2">
                            Updated
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <div className="flex flex-wrap mb-1">{getEmergencyTypeBadges(emergency)}</div>
                        <div className="flex justify-between mb-1">
                          <span>
                            Total needed: <span className="font-semibold text-red-500">{status.remaining}</span>
                            {status.dispatched > 0 && <span className="text-gray-500"> (of {status.total})</span>}
                          </span>
                          {status.remaining === 0 && (
                            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                              Fulfilled
                            </Badge>
                          )}
                        </div>
                        <Progress
                          value={getProgressPercentage(status)}
                          className="h-1.5"
                          indicatorClassName={getStatusColor(status)}
                        />
                      </div>
                    </div>
                  </Button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
