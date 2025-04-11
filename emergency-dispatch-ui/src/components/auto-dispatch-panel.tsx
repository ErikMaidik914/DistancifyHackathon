"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Play, StopCircle } from "lucide-react"
import type { ControlStatus, SimulationConfig } from "@/types"
import { startSimulation, stopSimulation } from "@/services/api"
import { toast } from "sonner"
import { logger } from "./logger"

interface AutoDispatchPanelProps {
  onStatusUpdate: () => Promise<boolean>
  onEmergenciesUpdate: () => Promise<void> // Changed return type to void
  status: ControlStatus | null
  isManualRunning: boolean // New prop to check if manual dispatch is running
  onAutoStart: () => Promise<void> // New prop to notify parent when auto dispatch starts
  onAutoStop: () => Promise<void> // New prop to notify parent when auto dispatch stops
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
    seed: "default",
    targetDispatches: 10000,
    maxActiveCalls: 100,
    poll_interval: 0.3,
    status_interval: 5,
  })

  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)

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
      await startSimulation(config)
      toast.success("Automatic Dispatch Started", {
        description: "The automatic dispatch simulation has been started successfully.",
      })
      await onStatusUpdate()
      await onEmergenciesUpdate()

      // Notify parent component that auto dispatch has started
      await onAutoStart()

      logger.info("Auto dispatch started", { config })
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

  const updateConfig = (key: keyof SimulationConfig, value: string | number) => {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const isRunning = status?.status === "Running"

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Automatic Dispatch Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
    </div>
  )
}
