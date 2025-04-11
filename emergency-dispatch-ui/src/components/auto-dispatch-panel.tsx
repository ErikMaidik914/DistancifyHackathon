"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Play, StopCircle, RefreshCw } from "lucide-react"
import type { ControlStatus, SimulationConfig } from "@/types"
import { startSimulation, stopSimulation, getSimulationStatus } from "@/services/api"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { logger } from "./logger"


interface AutoDispatchPanelProps {
  onStatusUpdate: () => Promise<boolean>
  onEmergenciesUpdate: () => Promise<void>
  status: ControlStatus | null
  isManualRunning: boolean
  onAutoStart: () => Promise<void>
  onAutoStop: () => Promise<void>
}

export function AutoDispatchPanel({
  onStatusUpdate,
  onEmergenciesUpdate,
  status,
  isManualRunning,
  onAutoStart,
  onAutoStop,
}: AutoDispatchPanelProps) {
  const [config, setConfig] = useState<SimulationConfig>({
    api_url: "http://localhost:5000", // Default to the main API URL
    seed: "default",
    targetDispatches: 10000,
    maxActiveCalls: 100,
    poll_interval: 0.3,
    status_interval: 5,
  })

  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [autoStatus, setAutoStatus] = useState<any>(null)
  const [lastAutoStatus, setLastAutoStatus] = useState<any>(null) // Store the last known status
  const [, setStatusInterval] = useState<NodeJS.Timeout | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch auto dispatch status periodically
  useEffect(() => {
    const fetchAutoStatus = async () => {
      try {
        const status = await getSimulationStatus()
        setAutoStatus(status)

        // If we have a valid status, store it as the last known status
        if (status && Object.keys(status).length > 0) {
          setLastAutoStatus(status)
        }
      } catch (error) {
        // Don't log errors if we're not expecting the auto dispatch to be running
        if (isStarting || autoStatus?.status === "Running") {
          logger.error("Failed to fetch auto dispatch status", { error })
        }
      }
    }

    // Initial fetch
    fetchAutoStatus()

    // Set up interval for periodic fetching
    const interval = setInterval(fetchAutoStatus, 2000)
    setStatusInterval(interval)

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [isStarting, autoStatus])

  const handleStart = async () => {
    // Check if manual dispatch is running
    if (isManualRunning) {
      toast.error("Cannot Start Auto Dispatch", {
        description: "Please stop the manual dispatch simulation first before starting auto dispatch.",
      })
      return
    }

    try {
      setIsStarting(true)

      // Ensure the config matches the backend's expected structure
      const simulationConfig = {
        api_url: config.api_url,
        seed: config.seed,
        targetDispatches: config.targetDispatches,
        maxActiveCalls: config.maxActiveCalls,
        poll_interval: config.poll_interval,
        status_interval: config.status_interval,
      }

      await startSimulation(simulationConfig)

      toast.success("Automatic Dispatch Started", {
        description: "The automatic dispatch simulation has been started successfully.",
      })
      await onStatusUpdate()
      await onEmergenciesUpdate()

      // Notify parent component that auto dispatch has started
      await onAutoStart()

      logger.info("Auto dispatch started", { config: simulationConfig })
    } catch (error) {
      console.error(error)
      logger.error("Failed to start auto dispatch", { error })
      toast.error("Failed to Start", {
        description: "Failed to start automatic dispatch. Please try again.",
      })
    } finally {
      setIsStarting(false)
    }
  }

  const handleStop = async () => {
    try {
      setIsStopping(true)
      await stopSimulation()
      toast.success("Automatic Dispatch Stopped", {
        description: "The automatic dispatch simulation has been stopped successfully.",
      })
      await onStatusUpdate()
      await onEmergenciesUpdate()

      // Notify parent component that auto dispatch has stopped
      await onAutoStop()

      logger.info("Auto dispatch stopped")
    } catch (error) {
      console.error(error)
      logger.error("Failed to stop auto dispatch", { error })
      toast.error("Failed to Stop", {
        description: "Failed to stop automatic dispatch. Please try again.",
      })
    } finally {
      setIsStopping(false)
    }
  }

  const handleRefreshStatus = async () => {
    setIsRefreshing(true)
    try {
      const status = await getSimulationStatus()
      setAutoStatus(status)

      // If we have a valid status, store it as the last known status
      if (status && Object.keys(status).length > 0) {
        setLastAutoStatus(status)
      }

      toast.success("Status Refreshed", {
        description: "Auto dispatch status has been refreshed.",
      })
    } catch (error) {
      logger.error("Failed to refresh auto dispatch status", { error })
      toast.error("Refresh Failed", {
        description: "Failed to refresh auto dispatch status.",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const updateConfig = (key: keyof SimulationConfig, value: string | number) => {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  // Check if auto dispatch is running based on the auto status
  const isRunning = autoStatus?.status === "Running" || status?.status === "Running"

  // Determine which status to display (current or last known)
  const displayStatus = autoStatus || lastAutoStatus

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Automatic Dispatch Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auto-api_url">API URL:</Label>
            <Input
              id="auto-api_url"
              value={config.api_url}
              onChange={(e) => updateConfig("api_url", e.target.value)}
              placeholder="http://localhost:5000"
              disabled={isRunning || isManualRunning}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auto-seed">Seed:</Label>
            <Input
              id="auto-seed"
              value={config.seed}
              onChange={(e) => updateConfig("seed", e.target.value)}
              placeholder="default"
              disabled={isRunning || isManualRunning}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auto-targetDispatches">Target Dispatches:</Label>
            <Input
              id="auto-targetDispatches"
              type="number"
              min={1}
              value={config.targetDispatches}
              onChange={(e) => updateConfig("targetDispatches", Number.parseInt(e.target.value) || 10000)}
              disabled={isRunning || isManualRunning}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auto-maxActiveCalls">Max Active Calls:</Label>
            <Input
              id="auto-maxActiveCalls"
              type="number"
              min={1}
              value={config.maxActiveCalls}
              onChange={(e) => updateConfig("maxActiveCalls", Number.parseInt(e.target.value) || 100)}
              disabled={isRunning || isManualRunning}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auto-poll_interval">Poll Interval (seconds):</Label>
            <Input
              id="auto-poll_interval"
              type="number"
              min={0.1}
              step={0.1}
              value={config.poll_interval}
              onChange={(e) => updateConfig("poll_interval", Number.parseFloat(e.target.value) || 0.3)}
              disabled={isRunning || isManualRunning}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auto-status_interval">Status Interval (seconds):</Label>
            <Input
              id="auto-status_interval"
              type="number"
              min={1}
              value={config.status_interval}
              onChange={(e) => updateConfig("status_interval", Number.parseInt(e.target.value) || 5)}
              disabled={isRunning || isManualRunning}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button className="flex-1" onClick={handleStart} disabled={isRunning || isStarting || isManualRunning}>
          {isStarting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Start Auto Dispatch
            </>
          )}
        </Button>

        <Button className="flex-1" variant="destructive" onClick={handleStop} disabled={!isRunning || isStopping}>
          {isStopping ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Stopping...
            </>
          ) : (
            <>
              <StopCircle className="mr-2 h-4 w-4" />
              Stop Auto Dispatch
            </>
          )}
        </Button>
      </div>

      {isManualRunning && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4 text-yellow-700">
            <p className="text-center font-medium">
              Manual dispatch is currently running. Stop it before starting auto dispatch.
            </p>
          </CardContent>
        </Card>
      )}

      {isRunning && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 text-green-700">
            <p className="text-center font-medium">
              Automatic dispatch is running. Check the status panel for details.
            </p>
          </CardContent>
        </Card>
      )}

      {displayStatus && (
        <Card>
          <CardHeader className="pb-2 flex flex-row justify-between items-center">
            <CardTitle className="text-lg">Auto Dispatch Status</CardTitle>
            <Button variant="outline" size="sm" onClick={handleRefreshStatus} disabled={isRefreshing} className="h-8">
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="font-medium">Status:</div>
              <div className="flex items-center">
                {displayStatus.status || "Unknown"}
                {!isRunning && displayStatus && (
                  <Badge variant="outline" className="ml-2 bg-gray-100 text-gray-700">
                    Historical
                  </Badge>
                )}
              </div>

              {displayStatus.params && (
                <>
                  <div className="font-medium">API URL:</div>
                  <div className="truncate">{displayStatus.params.api_url || "N/A"}</div>

                  <div className="font-medium">Seed:</div>
                  <div>{displayStatus.params.seed || "default"}</div>

                  <div className="font-medium">Target Dispatches:</div>
                  <div>{displayStatus.params.targetDispatches || 0}</div>

                  <div className="font-medium">Max Active Calls:</div>
                  <div>{displayStatus.params.maxActiveCalls || 0}</div>
                </>
              )}

              {displayStatus.stats && (
                <>
                  <div className="font-medium">Total Dispatches:</div>
                  <div>{displayStatus.stats.totalDispatches || 0}</div>

                  <div className="font-medium">Distance:</div>
                  <div>{(displayStatus.stats.distance || 0).toFixed(2)}</div>

                  <div className="font-medium">Running Time:</div>
                  <div>{displayStatus.stats.runningTime || "00:00:00"}</div>

                  <div className="font-medium">Active Calls:</div>
                  <div>
                    {displayStatus.stats.requestCount || 0} / {displayStatus.params?.maxActiveCalls || 0}
                  </div>
                </>
              )}

              <div className="font-medium">Last Updated:</div>
              <div>{new Date().toLocaleTimeString()}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
