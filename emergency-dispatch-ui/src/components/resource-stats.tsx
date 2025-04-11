"use client"

import type React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type EmergencyType, type ResourceAvailability, type EmergencyStats, EMERGENCY_TYPE_COLORS } from "@/types"
import { Progress } from "@/components/ui/progress"

interface ResourceStatsProps {
  resourceStats: ResourceAvailability[]
  emergencyStats: EmergencyStats
}

export function ResourceStats({ resourceStats, emergencyStats }: ResourceStatsProps) {
  // Calculate total resources

  // Calculate total emergencies
  const totalRequests = Object.values(emergencyStats.totalRequests).reduce((sum, count) => sum + count, 0)
  const totalPending = Object.values(emergencyStats.pendingRequests).reduce((sum, count) => sum + count, 0)
  const totalDispatched = Object.values(emergencyStats.dispatchedRequests).reduce((sum, count) => sum + count, 0)

  // Calculate completion percentage
  const completionPercentage = totalRequests > 0 ? Math.round((totalDispatched / totalRequests) * 100) : 0

  // Get resource utilization by type
  const getResourceUtilization = (type: EmergencyType) => {
    const resource = resourceStats.find((r) => r.type === type)
    const pending = emergencyStats.pendingRequests[type] || 0
    const available = resource?.available || 0

    // Calculate if we have enough resources
    const deficit = Math.max(0, pending - available)
    const surplus = Math.max(0, available - pending)

    return {
      type,
      pending,
      available,
      deficit,
      surplus,
      status: deficit > 0 ? "deficit" : "sufficient",
    }
  }

  const resourceUtilization = [
    getResourceUtilization("Medical"),
    getResourceUtilization("Police"),
    getResourceUtilization("Fire"),
    getResourceUtilization("Rescue"),
    getResourceUtilization("Utility"),
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Emergency Response Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="text-sm text-gray-500">Total Emergencies</div>
              <div className="font-medium text-xl">{emergencyStats.totalCalls}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="text-sm text-gray-500">Total Requests</div>
              <div className="font-medium text-xl">{totalRequests}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="text-sm text-gray-500">Pending Requests</div>
              <div className="font-medium text-xl text-red-500">{totalPending}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="text-sm text-gray-500">Dispatched</div>
              <div className="font-medium text-xl text-green-500">{totalDispatched}</div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Overall Completion</span>
              <span className="text-sm font-medium">{completionPercentage}%</span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Emergency Requests by Type</h3>
            {Object.entries(emergencyStats.totalRequests).map(([type, count]) => {
              const dispatched = emergencyStats.dispatchedRequests[type as EmergencyType] || 0
              const percentage = count > 0 ? Math.round((dispatched / count) * 100) : 0
              const typeColor = EMERGENCY_TYPE_COLORS[type as EmergencyType]

              return (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: typeColor }}></div>
                      <span className="text-sm">{type}</span>
                    </div>
                    <span className="text-sm">
                      {dispatched}/{count} ({percentage}%)
                    </span>
                  </div>
                  <Progress
                    value={percentage}
                    className="h-1.5"
                    indicatorClassName={`bg-[${typeColor}]`}
                    style={
                      {
                        "--progress-background": "rgb(243 244 246)",
                      } as React.CSSProperties
                    }
                  />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Resource Availability</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {resourceStats.map((stat) => (
              <div key={stat.type} className="bg-gray-50 p-3 rounded-md">
                <div className="text-sm text-gray-500">{stat.type}</div>
                <div className="font-medium text-xl">{stat.available}</div>
                <div className="text-xs text-gray-500">{stat.locations} locations</div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Resource Utilization</h3>
            {resourceUtilization.map((util) => {
              const typeColor = EMERGENCY_TYPE_COLORS[util.type]

              return (
                <div key={util.type} className="p-3 rounded-md border" style={{ borderColor: `${typeColor}30` }}>
                  <div className="flex justify-between mb-1">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: typeColor }}></div>
                      <span className="font-medium">{util.type}</span>
                    </div>
                    <div className={`text-sm ${util.status === "deficit" ? "text-red-500" : "text-green-500"}`}>
                      {util.status === "deficit" ? "Shortage" : "Sufficient"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <div className="text-xs text-gray-500">Pending Requests</div>
                      <div className="text-sm font-medium">{util.pending}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Available Resources</div>
                      <div className="text-sm font-medium">{util.available}</div>
                    </div>
                    {util.status === "deficit" && (
                      <div>
                        <div className="text-xs text-red-500">Deficit</div>
                        <div className="text-sm font-medium text-red-500">-{util.deficit}</div>
                      </div>
                    )}
                    {util.status !== "deficit" && (
                      <div>
                        <div className="text-xs text-green-500">Surplus</div>
                        <div className="text-sm font-medium text-green-500">+{util.surplus}</div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
