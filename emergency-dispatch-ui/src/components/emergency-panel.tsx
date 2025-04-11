"use client"

import type { EmergencyCall } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

interface EmergencyPanelProps {
  emergencies: EmergencyCall[]
  onSelect: (emergency: EmergencyCall) => void
  selectedEmergency: EmergencyCall | null
}

export function EmergencyPanel({ emergencies, onSelect, selectedEmergency }: EmergencyPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          Emergencies ({emergencies.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[200px]">
          {emergencies.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No active emergencies</div>
          ) : (
            <div className="space-y-1 p-2">
              {emergencies.map((emergency, index) => {
                const totalNeeded = emergency.requests.reduce((sum, req) => sum + req.Quantity, 0)
                const isSelected =
                  selectedEmergency &&
                  emergency.city === selectedEmergency.city &&
                  emergency.county === selectedEmergency.county

                return (
                  <Button
                    key={`${emergency.city}-${emergency.county}-${index}`}
                    variant={isSelected ? "default" : "outline"}
                    className="w-full justify-start h-auto py-2 text-left"
                    onClick={() => onSelect(emergency)}
                  >
                    <div className="flex flex-col">
                      <div className="font-medium">
                        {emergency.city}, {emergency.county}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Ambulances needed: <span className="font-semibold text-red-500">{totalNeeded}</span>
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
