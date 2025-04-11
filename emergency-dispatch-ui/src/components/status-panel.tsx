"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import type { ControlStatus } from "@/types"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, AlertTriangle, RefreshCw, Clock, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchControlStatus } from "@/services/api"
import { logger } from "./logger"
import { Progress } from "@/components/ui/progress"

interface StatusPanelProps {
  status: ControlStatus | null
  isLoading: boolean
  error: string | null
}

export function StatusPanel({ status, isLoading, error }: StatusPanelProps) {
  const [localStatus, setLocalStatus] = useState<ControlStatus | null>(status)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [updateInterval, setUpdateInterval] = useState<number>(2000) // 2 seconds default
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [refreshCountdown, setRefreshCountdown] = useState<number>(0)
  const [showDetails, setShowDetails] = useState<boolean>(false)

  // Update local status when prop changes
  useEffect(() => {
    if (status) {
      setLocalStatus(status)
      setLastUpdated(new Date())
    }
  }, [status])

  // Function to refresh status
  const refreshStatus = useCallback(async () => {
    try {
      setIsRefreshing(true)
      const newStatus = await fetchControlStatus()
      if (newStatus) {
        setLocalStatus(newStatus)
        setLastUpdated(new Date())
        logger.debug("Status refreshed", {
          status: newStatus.status,
          dispatches: newStatus.totalDispatches,
          activeCalls: newStatus.requestCount,
        })
      }
    } catch (error) {
      logger.error("Failed to refresh status", { error })
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  // Set up auto-refresh for status
  useEffect(() => {
    // Clear any existing timer
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = null
    }

    // Only set up auto-refresh if enabled and we have a running simulation
    if (autoRefresh && localStatus?.status === "Running") {
      // Set initial countdown
      setRefreshCountdown(updateInterval / 1000)

      // Create countdown timer
      const countdownTimer = setInterval(() => {
        setRefreshCountdown((prev) => {
          if (prev <= 1) {
            return updateInterval / 1000
          }
          return prev - 1
        })
      }, 1000)

      // Create refresh timer
      refreshTimerRef.current = setInterval(() => {
        refreshStatus()
      }, updateInterval)

      return () => {
        clearInterval(refreshTimerRef.current as NodeJS.Timeout)
        clearInterval(countdownTimer)
      }
    }
  }, [autoRefresh, localStatus?.status, updateInterval, refreshStatus])

  // Manual refresh function
  const handleRefresh = async () => {
    await refreshStatus()
    // Reset countdown after manual refresh
    setRefreshCountdown(updateInterval / 1000)
  }

  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    setAutoRefresh((prev) => !prev)
  }

  // Change update interval
  const changeUpdateInterval = (interval: number) => {
    setUpdateInterval(interval)
    logger.info("Status update interval changed", { interval })
  }

  // Toggle details view
  const toggleDetails = () => {
    setShowDetails((prev) => !prev)
  }

  // Calculate progress percentage
  const calculateProgress = () => {
    if (!localStatus) return 0
    return (localStatus.totalDispatches / localStatus.targetDispatches) * 100
  }

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
  if (error && localStatus !== null && localStatus.status === "Running") {
    return (
      <Card className="m-4 border-red-200 bg-red-50">
        <CardContent className="p-4 flex items-center text-red-600">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </CardContent>
      </Card>
    )
  }

  if (!localStatus || localStatus.status !== "Running") {
    return (
      <Card className="m-4">
        <CardContent className="p-4 text-center text-gray-500">
          {!localStatus
            ? "No simulation running. Start a simulation to see status."
            : "Simulation stopped. Start a new simulation to see status."}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="m-4">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium flex items-center">
            <Activity className="h-5 w-5 mr-2 text-blue-500" />
            Simulation Status
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center text-xs text-gray-500">
              <Clock className="h-3 w-3 mr-1" />
              <span>{autoRefresh ? `Auto-refresh in ${refreshCountdown}s` : "Auto-refresh off"}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAutoRefresh}
              className={`h-8 ${autoRefresh ? "bg-blue-50" : ""}`}
            >
              {autoRefresh ? "Pause" : "Auto"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="h-8">
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={toggleDetails} className="h-8">
              {showDetails ? "Less" : "More"}
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between mb-1 text-sm">
            <span>
              Progress: {localStatus.totalDispatches} / {localStatus.targetDispatches}
            </span>
            <span>{Math.round(calculateProgress())}%</span>
          </div>
          <Progress value={calculateProgress()} className="h-2" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500">Status</div>
            <div className={`font-medium ${localStatus.status === "Running" ? "text-green-600" : "text-blue-600"}`}>
              {localStatus.status}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500">Running Time</div>
            <div className="font-medium">{localStatus.runningTime}</div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500">Dispatches</div>
            <div className="font-medium">
              {localStatus.totalDispatches} / {localStatus.targetDispatches}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500">Active Calls</div>
            <div className="font-medium">
              {localStatus.requestCount} / {localStatus.maxActiveCalls}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500">Distance</div>
            <div className="font-medium">{localStatus.distance.toFixed(2)}</div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500">Penalty</div>
            <div className="font-medium">{localStatus.penalty}</div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500">HTTP Requests</div>
            <div className="font-medium">{localStatus.httpRequests}</div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500">Errors</div>
            <div className="font-medium text-red-500">
              Missed: {localStatus.errors.missed}, Over: {localStatus.errors.overDispatched}
            </div>
          </div>
        </div>

        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium mb-2">Refresh Settings</h4>
            <div className="flex gap-2">
              {[1000, 2000, 5000, 10000].map((interval) => (
                <Button
                  key={interval}
                  variant={updateInterval === interval ? "default" : "outline"}
                  size="sm"
                  onClick={() => changeUpdateInterval(interval)}
                  className="text-xs"
                >
                  {interval / 1000}s
                </Button>
              ))}
            </div>

            <div className="mt-4 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
                <span>Seed: {localStatus.seed}</span>
              </div>
              <div className="mt-1">Checksum: {localStatus.checksum}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
