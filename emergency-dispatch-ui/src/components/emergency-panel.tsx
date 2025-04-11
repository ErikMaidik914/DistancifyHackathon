"use client"

import { useEffect, useState } from "react"
import type { EmergencyCall, EmergencyStatus } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { AlertCircle, Loader2 } from "lucide-react"
import { Badge } from "./ui/badge"
import { Progress } from "./ui/progress"

interface EmergencyPanelProps {
  emergencies: EmergencyCall[]
  onSelect: (emergency: EmergencyCall) => void
  selectedEmergency: EmergencyCall | null
}

export function EmergencyPanel({ emergencies, onSelect, selectedEmergency }: EmergencyPanelProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [prevEmergencyCount, setPrevEmergencyCount] = useState(0)
  const [highlightedEmergencies, setHighlightedEmergencies] = useState<Record<string, boolean>>({})

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

  // Generate a unique ID for an emergency
  const getEmergencyId = (emergency: EmergencyCall, index: number) => {
    return `${emergency.city}-${emergency.county}-${index}`
  }

  // Check if an emergency is highlighted
  const isHighlighted = (emergency: EmergencyCall) => {
    const id = `${emergency.city}-${emergency.county}`
    return highlightedEmergencies[id]
  }

  // Calculate emergency status (total, dispatched, remaining)
  const getEmergencyStatus = (emergency: EmergencyCall): EmergencyStatus => {
    const total = emergency.requests.reduce((sum, req) => sum + req.Quantity, 0)
    const dispatched = emergency.dispatched || 0
    const remaining = Math.max(0, total - dispatched)

    return { total, dispatched, remaining }
  }

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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            Emergencies ({emergencies.length})
          </div>
          {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[200px]">
          {emergencies.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No active emergencies</div>
          ) : (
            <div className="space-y-1 p-2">
              {emergencies.map((emergency, index) => {
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
                        <div className="flex justify-between mb-1">
                          <span>
                            Ambulances needed: <span className="font-semibold text-red-500">{status.remaining}</span>
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
