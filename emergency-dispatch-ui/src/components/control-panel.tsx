"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sliders } from "lucide-react"

interface ControlPanelProps {
  onReset: (seed: string, targetDispatches: number, maxActiveCalls: number) => void
}

export function ControlPanel({ onReset }: ControlPanelProps) {
  const [seed, setSeed] = useState("default")
  const [targetDispatches, setTargetDispatches] = useState(100)
  const [maxActiveCalls, setMaxActiveCalls] = useState(15)

  const handleReset = () => {
    onReset(seed, targetDispatches, maxActiveCalls)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          <Sliders className="h-5 w-5 text-gray-500 mr-2" />
          Control Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="seed">Seed:</Label>
          <Input id="seed" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="default" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetDispatches">Target Dispatches:</Label>
          <Input
            id="targetDispatches"
            type="number"
            min={1}
            value={targetDispatches}
            onChange={(e) => setTargetDispatches(Number.parseInt(e.target.value) || 100)}
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
          />
        </div>

        <Button className="w-full" onClick={handleReset}>
          Reset & Start Simulation
        </Button>
      </CardContent>
    </Card>
  )
}
