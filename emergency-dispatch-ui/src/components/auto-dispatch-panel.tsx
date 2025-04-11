"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Play, StopCircle } from "lucide-react"
import type { ControlStatus, SimulationConfig } from "@/types"
import { startSimulation, stopSimulation } from "@/services/api"
import { useToast } from "@/components/ui/use-toast"
interface AutoDispatchPanelProps {
  onStatusUpdate: () => void
  onEmergenciesUpdate: () => Promise<void> // Add this line
  status: ControlStatus | null
}

export function AutoDispatchPanel({ onStatusUpdate, onEmergenciesUpdate, status }: AutoDispatchPanelProps) {
  const [config, setConfig] = useState<SimulationConfig>({
    seed: "default",
    targetDispatches: 10000,
    maxActiveCalls: 100,
    poll_interval: 0.3,
    status_interval: 5,
  })

  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const { toast } = useToast()

  const handleStart = async () => {
    try {
      setIsStarting(true)
      await startSimulation(config)
      toast({
        title: "Automatic Dispatch Started",
        description: "The automatic dispatch simulation has been started successfully.",
      })
      onStatusUpdate()
      await onEmergenciesUpdate() // Add this line
    } catch (error) {
      console.error(error)
      toast({
        title: "Failed to Start",
        description: "Failed to start automatic dispatch. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsStarting(false)
    }
  }

  const handleStop = async () => {
    try {
      setIsStopping(true)
      await stopSimulation()
      toast({
        title: "Automatic Dispatch Stopped",
        description: "The automatic dispatch simulation has been stopped successfully.",
      })
      onStatusUpdate()
      await onEmergenciesUpdate() // Add this line
    } catch (error) {
      console.error(error)
      toast({
        title: "Failed to Stop",
        description: "Failed to stop automatic dispatch. Please try again.",
        variant: "destructive",
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
              disabled={isRunning}
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
              disabled={isRunning}
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
              disabled={isRunning}
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
              disabled={isRunning}
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
              disabled={isRunning}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button className="flex-1" onClick={handleStart} disabled={isRunning || isStarting}>
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
