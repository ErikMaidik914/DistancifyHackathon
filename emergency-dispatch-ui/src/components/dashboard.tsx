"use client"

import { useEffect, useState, useRef } from "react"
import { LeafletMap } from "./leaflet-map" // Import the new Leaflet map component
import { EmergencyPanel } from "./emergency-panel"
import { AmbulancePanel } from "./ambulance-panel"
import { ControlPanel } from "./control-panel"
import { StatusPanel } from "./status-panel"
import type { AmbulanceLocation, ControlStatus, EmergencyCall, Location } from "@/types"
import {
  fetchAvailableAmbulances,
  fetchControlStatus,
  fetchEmergencyCalls,
  fetchLocations,
  fetchNextEmergency,
} from "@/services/api"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AutoDispatchPanel } from "./auto-dispatch-panel"
import { toast } from 'sonner'

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
  const [isSimulationRunning, setIsSimulationRunning] = useState(false)
  
  // Local progress tracking
  const [totalDispatched, setTotalDispatched] = useState(0)
  const [totalDistance, setTotalDistance] = useState(0)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [elapsedTime, setElapsedTime] = useState("00:00:00")
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch all data including emergencies queue
  const fetchData = async () => {
    try {
      const [locationsData, ambulancesData, statusData] = await Promise.all([
        fetchLocations(),
        fetchAvailableAmbulances(),
        fetchControlStatus(),
      ])

      // Use type assertion to resolve type conflicts
      setLocations(locationsData as unknown as Location[])
      setAmbulances(ambulancesData)
      setStatus(statusData)
      
      // Check if simulation is running based on status
      const isRunning = statusData?.status === "Running"
      setIsSimulationRunning(isRunning)
      
      // Update local progress from status
      if (statusData) {
        setTotalDispatched(statusData.totalDispatches)
        setTotalDistance(statusData.distance)
      }
      
      setIsLoading(false)
    } catch (err) {
      setError("Failed to fetch data. Please check if the API server is running.")
      setIsLoading(false)
      console.error(err)
    }
  }

  // Separate function to fetch emergencies queue
  const fetchEmergenciesQueue = async () => {
    try {
      const emergenciesData = await fetchEmergencyCalls()
      setEmergencies(emergenciesData)
    } catch (err) {
      console.error("Failed to fetch emergencies queue:", err)
    }
  }

  // Start timer for tracking elapsed time
  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    
    setStartTime(new Date())
    
    timerRef.current = setInterval(() => {
      if (startTime) {
        const now = new Date()
        const diff = now.getTime() - startTime.getTime()
        
        // Format elapsed time as HH:MM:SS
        const hours = Math.floor(diff / 3600000).toString().padStart(2, '0')
        const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0')
        const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0')
        
        setElapsedTime(`${hours}:${minutes}:${seconds}`)
      }
    }, 1000)
  }

  // Stop timer
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const startRefreshInterval = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
    }

    // Fetch data every 2 seconds
    const interval = setInterval(() => {
      fetchData()
      fetchEmergenciesQueue() // Specifically fetch emergencies queue
    }, 2000)
    
    setRefreshInterval(interval)
  }

  const stopRefreshInterval = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      setRefreshInterval(null)
    }
  }

  const handleReset = async (_seed: string, _targetDispatches: number, _maxActiveCalls: number) => {
    try {
      setIsLoading(true)
      
      // Reset local progress tracking
      setTotalDispatched(0)
      setTotalDistance(0)
      startTimer()
      
      await fetchData()
      await fetchEmergenciesQueue() // Initial fetch of emergencies
      startRefreshInterval()
      setIsSimulationRunning(true)
    } catch (err) {
      setError("Failed to reset control. Please check if the API server is running.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStop = async () => {
    try {
      stopTimer()
      await fetchData()
      await fetchEmergenciesQueue()
      setIsSimulationRunning(false)
      stopRefreshInterval()
    } catch (err) {
      setError("Failed to stop control. Please check if the API server is running.")
      console.error(err)
    }
  }

  const handleFetchNext = async () => {
    try {
      await fetchNextEmergency()
      await fetchEmergenciesQueue() // Update emergencies after fetching next
      toast.success("Fetched next emergency")
    } catch (err) {
      toast.error("Failed to fetch next emergency")
      console.error(err)
    }
  }

  const handleEmergencySelect = (emergency: EmergencyCall) => {
    setSelectedEmergency(emergency)
  }

  const handleAmbulanceSelect = (ambulance: AmbulanceLocation) => {
    setSelectedAmbulance(ambulance)
  }

  const handleDispatchSuccess = async (_from: string, _to: string, quantity: number, distance: number) => {
    // Update local progress tracking
    setTotalDispatched(prev => prev + quantity)
    setTotalDistance(prev => prev + distance)
    
    setSelectedEmergency(null)
    setSelectedAmbulance(null)
    
    // Refresh data after dispatch
    await fetchData()
    await fetchEmergenciesQueue()
  }

  useEffect(() => {
    // Initial data fetch
    fetchData()
    fetchEmergenciesQueue()
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  // Create a local status object that includes our tracked metrics
  const localStatus = status ? {
    ...status,
    runningTime: elapsedTime,
    totalDispatches: totalDispatched,
    distance: totalDistance
  } : null

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-blue-700 text-white p-4 shadow-md">
        <h1 className="text-2xl font-bold">Emercery - Emergency Dispatch System</h1>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-3/4 h-full flex flex-col">
          <div className="flex-1 m-4 relative overflow-hidden">
            <LeafletMap
              locations={locations}
              ambulances={ambulances}
              emergencies={emergencies}
              selectedEmergency={selectedEmergency}
              selectedAmbulance={selectedAmbulance}
            />
          </div>

          <StatusPanel status={localStatus} isLoading={isLoading} error={error} />
        </div>

        <div className="w-full md:w-1/4 h-full overflow-y-auto bg-gray-50 border-l">
          <Tabs defaultValue="manual" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="manual">Manual Dispatch</TabsTrigger>
              <TabsTrigger value="auto">Auto Dispatch</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-4 p-4">
              <ControlPanel 
                onReset={handleReset} 
                onStop={handleStop}
                onFetchNext={handleFetchNext}
                isRunning={isSimulationRunning}
              />

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
              <AutoDispatchPanel 
                onStatusUpdate={fetchData} 
                onEmergenciesUpdate={fetchEmergenciesQueue}
                status={status} 
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}