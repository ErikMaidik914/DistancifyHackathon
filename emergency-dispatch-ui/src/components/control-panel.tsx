"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Play, StopCircle, SkipForward } from "lucide-react"
import { resetControl, stopControl, fetchNextEmergency } from "@/services/api"
import { toast } from "sonner"

interface ControlPanelProps {
  onReset: (seed: string, targetDispatches: number, maxActiveCalls: number) => void
  onStop: () => void
  onFetchNext: () => void
  isRunning: boolean
}

export function ControlPanel({ onReset, onStop, onFetchNext, isRunning }: ControlPanelProps) {
  const [seed, setSeed] = useState("default")
  const [targetDispatches, setTargetDispatches] = useState(100)
  const [maxActiveCalls, setMaxActiveCalls] = useState(15)
  const [isLoading, setIsLoading] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

  const handleReset = async () => {
    try {
      setIsLoading(true)
      await resetControl(seed, targetDispatches, maxActiveCalls)
      toast.success("Simulation Started", {
        description: `Simulation started with seed: ${seed}`,
      })
      onReset(seed, targetDispatches, maxActiveCalls)
    } catch (error) {
      console.error(error)
      toast.error("Failed to Start", {
        description: "Failed to start simulation. Please check if the API server is running.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleStop = async () => {
    try {
      setIsStopping(true)
      await stopControl()
      toast.success("Simulation Stopped", {
        description: "The simulation has been stopped successfully.",
      })
      onStop()
    } catch (error) {
      console.error(error)
      toast.error("Failed to Stop", {
        description: "Failed to stop simulation. Please try again.",
      })
    } finally {
      setIsStopping(false)
    }
  }

  const handleFetchNext = async () => {
    try {
      setIsFetching(true)
      await fetchNextEmergency()
      toast.success("Fetched Next Emergency", {
        description: "Successfully fetched the next emergency.",
      })
      onFetchNext()
    } catch (error) {
      console.error(error)
      toast.error("Failed to Fetch", {
        description: "Failed to fetch the next emergency. Please try again.",
      })
    } finally {
      setIsFetching(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          <Play className="h-5 w-5 text-gray-500 mr-2" />
          Control Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="seed">Seed:</Label>
          <Input
            id="seed"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="default"
            disabled={isRunning}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetDispatches">Target Dispatches:</Label>
          <Input
            id="targetDispatches"
            type="number"
            min={1}
            value={targetDispatches}
            onChange={(e) => setTargetDispatches(Number.parseInt(e.target.value) || 100)}
            disabled={isRunning}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxActiveCalls">Max Active Calls:</Label>
          <Input
            id="maxActiveCalls"
            type="number"
            min={1}
            value={maxActiveCalls}
            onChange={(e) => setMaxActiveCalls(Number.parseInt(e.target.value) || 15)}
            disabled={isRunning}
          />
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleReset} disabled={isLoading || isRunning}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Simulation
              </>
            )}
          </Button>

          <Button variant="destructive" onClick={handleStop} disabled={!isRunning || isStopping} className="flex-1">
            {isStopping ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Stopping...
              </>
            ) : (
              <>
                <StopCircle className="mr-2 h-4 w-4" />
                Stop
              </>
            )}
          </Button>
        </div>

        <Button variant="outline" className="w-full" onClick={handleFetchNext} disabled={!isRunning || isFetching}>
          {isFetching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fetching...
            </>
          ) : (
            <>
              <SkipForward className="mr-2 h-4 w-4" />
              Fetch Next Emergency
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
