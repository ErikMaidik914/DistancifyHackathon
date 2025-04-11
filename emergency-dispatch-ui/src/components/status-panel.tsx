"use client"

import type { ControlStatus } from "@/types"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, AlertTriangle } from "lucide-react"

interface StatusPanelProps {
  status: ControlStatus | null
  isLoading: boolean
  error: string | null
}

export function StatusPanel({ status, isLoading, error }: StatusPanelProps) {
  if (isLoading) {
    return (
      <Card className="m-4">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span>Loading status...</span>
        </CardContent>
      </Card>
    )
  }

  // Only show error if there's an error AND status is not null AND status is "Running"
  if (error && status !== null && status.status === "Running") {
    return (
      <Card className="m-4 border-red-200 bg-red-50">
        <CardContent className="p-4 flex items-center text-red-600">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </CardContent>
      </Card>
    )
  }

  if (!status) {
    return (
      <Card className="m-4">
        <CardContent className="p-4 text-center text-gray-500">
          No simulation running. Start a simulation to see status.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="m-4">
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500">Status</div>
            <div className={`font-medium ${status.status === "Running" ? "text-green-600" : "text-blue-600"}`}>
              {status.status}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500">Running Time</div>
            <div className="font-medium">{status.runningTime}</div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500">Dispatches</div>
            <div className="font-medium">
              {status.totalDispatches} / {status.targetDispatches}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500">Active Calls</div>
            <div className="font-medium">
              {status.requestCount} / {status.maxActiveCalls}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500">Distance</div>
            <div className="font-medium">{status.distance.toFixed(2)}</div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500">Penalty</div>
            <div className="font-medium">{status.penalty}</div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500">HTTP Requests</div>
            <div className="font-medium">{status.httpRequests}</div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500">Errors</div>
            <div className="font-medium text-red-500">
              Missed: {status.errors.missed}, Over: {status.errors.overDispatched}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
