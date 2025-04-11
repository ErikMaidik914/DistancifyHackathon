"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Play, StopCircle, RefreshCw } from 'lucide-react'
import { resetControl, stopControl, fetchNextEmergency } from "@/services/api"
import { toast } from 'sonner'

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
  const [isStoppingSimulation, setIsStoppingSimulation] = useState(false)
  const [isFetchingNext, setIsFetchingNext] = useState(false)

  const handleReset = async () => {
    try {
      setIsLoading(true)
      await resetControl(seed, targetDispatches, maxActiveCalls)
      toast.success("Simulation started successfully")
      onReset(seed, targetDispatches, maxActiveCalls)
    } catch (error) {
      console.error(error)
      toast.error("Failed to start simulation")
    } finally {
      setIsLoading(false)
    }
  }

  const handleStop = async () => {
    try {
      setIsStoppingSimulation(true)
      const result = await stopControl()
      toast.success("Simulation stopped successfully", {
        description: `Total dispatches: ${result.totalDispatches}, Distance: ${result.distance.toFixed(2)}`
      })
      onStop()
    } catch (error) {
      console.error(error)
      toast.error("Failed to stop simulation")
    } finally {
      setIsStoppingSimulation(false)
    }
  }

  const handleFetchNext = async () => {
    try {
      setIsFetchingNext(true)
      await fetchNextEmergency()
      toast.success("Fetched next emergency")
      onFetchNext()
    } catch (error) {
      console.error(error)
      toast.error("Failed to fetch next emergency")
    } finally {
      setIsFetchingNext(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Control Panel</CardTitle>
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

        <div className="grid grid-cols-2 gap-2">
          <Button 
            className="w-full" 
            onClick={handleReset} 
            disabled={isLoading || isRunning}
          >
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
          
          <Button 
            className="w-full" 
            variant="destructive" 
            onClick={handleStop}
            disabled={!isRunning || isStoppingSimulation}
          >
            {isStoppingSimulation ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Stopping...
              </>
            ) : (
              <>
                <StopCircle className="mr-2 h-4 w-4" />
                Stop Simulation
              </>
            )}
          </Button>
        </div>

        <Button 
          className="w-full" 
          variant="outline" 
          onClick={handleFetchNext}
          disabled={!isRunning || isFetchingNext}
        >
          {isFetchingNext ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fetching...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Fetch Next Emergency
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}