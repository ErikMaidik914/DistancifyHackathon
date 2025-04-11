"use client"

import { useEffect, useState } from "react"
import { MapContainer } from "./ui/map-container"
import { EmergencyPanel } from "./ui/emergency-panel"
import { AmbulancePanel } from "./ambulance-panel"
import { ControlPanel } from "./control-panel"
import { StatusPanel } from "./ui/status-panel"
import type { AmbulanceLocation, ControlStatus, EmergencyCall, Location } from "@/types"
import {
  fetchAvailableAmbulances,
  fetchControlStatus,
  fetchEmergencyCalls,
  fetchLocations,
  resetControl,
} from "@/services/api"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AutoDispatchPanel } from "./auto-dispatch-panel"

export default function Dashboard() {
  const [locations, setLocations] = useState<Location[]>([])
  const [ambulances, setAmbulances] = useState<AmbulanceLocation[]>([])
  const [emergencies, setEmergencies] = useState<EmergencyCall[]>([])
  const [status, setStatus] = useState<ControlStatus | null>(null)
  const [selectedEmergency, setSelectedEmergency] = useState<EmergencyCall | null>(null)
  const [selectedAmbulance, setSelectedAmbulance] = useState<AmbulanceLocation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)

  const fetchData = async () => {
    try {
      const [locationsData, ambulancesData, emergenciesData, statusData] = await Promise.all([
        fetchLocations(),
        fetchAvailableAmbulances(),
        fetchEmergencyCalls(),
        fetchControlStatus(),
      ])

      setLocations(locationsData)
      setAmbulances(ambulancesData)
      setEmergencies(emergenciesData)
      setStatus(statusData)
      setIsLoading(false)
    } catch (err) {
      setError("Failed to fetch data. Please check if the API server is running.")
      setIsLoading(false)
      console.error(err)
    }
  }

  const startRefreshInterval = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
    }

    const interval = setInterval(fetchData, 2000)
    setRefreshInterval(interval)
  }

  const handleReset = async (seed: string, targetDispatches: number, maxActiveCalls: number) => {
    try {
      setIsLoading(true)
      await resetControl(seed, targetDispatches, maxActiveCalls)
      await fetchData()
      startRefreshInterval()
    } catch (err) {
      setError("Failed to reset control. Please check if the API server is running.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmergencySelect = (emergency: EmergencyCall) => {
    setSelectedEmergency(emergency)
  }

  const handleAmbulanceSelect = (ambulance: AmbulanceLocation) => {
    setSelectedAmbulance(ambulance)
  }

  const handleDispatchSuccess = () => {
    setSelectedEmergency(null)
    setSelectedAmbulance(null)
    fetchData()
  }

  useEffect(() => {
    fetchData()
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [])

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-blue-700 text-white p-4 shadow-md">
        <h1 className="text-2xl font-bold">Emercery - Emergency Dispatch System</h1>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-3/4 h-full flex flex-col">
          <MapContainer
            locations={locations}
            ambulances={ambulances}
            emergencies={emergencies}
            selectedEmergency={selectedEmergency}
            selectedAmbulance={selectedAmbulance}
          />

          <StatusPanel status={status} isLoading={isLoading} error={error} />
        </div>

        <div className="w-full md:w-1/4 h-full overflow-y-auto bg-gray-50 border-l">
          <Tabs defaultValue="manual" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="manual">Manual Dispatch</TabsTrigger>
              <TabsTrigger value="auto">Auto Dispatch</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-4 p-4">
              <ControlPanel onReset={handleReset} />

              <EmergencyPanel
                emergencies={emergencies}
                onSelect={handleEmergencySelect}
                selectedEmergency={selectedEmergency}
              />

              <AmbulancePanel
                ambulances={ambulances}
                onSelect={handleAmbulanceSelect}
                selectedAmbulance={selectedAmbulance}
                selectedEmergency={selectedEmergency}
                onDispatchSuccess={handleDispatchSuccess}
              />
            </TabsContent>

            <TabsContent value="auto" className="p-4">
              <AutoDispatchPanel onStatusUpdate={fetchData} status={status} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
