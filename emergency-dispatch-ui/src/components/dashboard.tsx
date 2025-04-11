"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { LeafletMap } from "./leaflet-map"
import { EmergencyPanel } from "./emergency-panel"
import { ControlPanel } from "./control-panel"
import { StatusPanel } from "./status-panel"
import type {
  EmergencyResource,
  ControlStatus,
  EmergencyCall,
  Location,
  SystemStatus,
  EmergencyType,
  ResourceAvailability,
  EmergencyStats,
} from "@/types"
import {
  fetchAllAvailableResources,
  fetchResourceAvailability,
  fetchControlStatus,
  fetchEmergencyCalls,
  fetchLocations,
  resetControl,
  stopControl,
  fetchNextEmergency,
  stopSimulation,
  getSimulationStatus,
  getSystemHealth,
} from "@/services/api"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AutoDispatchPanel } from "./auto-dispatch-panel"
import { toast } from "sonner"
import { logger } from "./logger"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Clock, AlertCircle, BarChart3 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ResourceStats } from "./resource-stats"
import { ResourcePanel } from "./resource-panel"

export default function Dashboard() {
  const [locations, setLocations] = useState<Location[]>([])
  const [resources, setResources] = useState<EmergencyResource[]>([])
  const [resourceStats, setResourceStats] = useState<ResourceAvailability[]>([])
  const [emergencies, setEmergencies] = useState<EmergencyCall[]>([])
  const [emergencyStats, setEmergencyStats] = useState<EmergencyStats>({
    totalCalls: 0,
    totalRequests: {
      Medical: 0,
      Police: 0,
      Fire: 0,
      Rescue: 0,
      Utility: 0,
    },
    pendingRequests: {
      Medical: 0,
      Police: 0,
      Fire: 0,
      Rescue: 0,
      Utility: 0,
    },
    dispatchedRequests: {
      Medical: 0,
      Police: 0,
      Fire: 0,
      Rescue: 0,
      Utility: 0,
    },
  })
  const [status, setStatus] = useState<ControlStatus | null>(null)
  const [selectedEmergency, setSelectedEmergency] = useState<EmergencyCall | null>(null)
  const [selectedResource, setSelectedResource] = useState<EmergencyResource | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  const [isSimulationRunning, setIsSimulationRunning] = useState(false)
  const [isAutoDispatch, setIsAutoDispatch] = useState(false)
  const [activeTab, setActiveTab] = useState("manual")
  const [isStoppingSimulation, setIsStoppingSimulation] = useState(false)
  const [autoFetchEnabled, setAutoFetchEnabled] = useState(false)
  const [autoFetchInterval, setAutoFetchInterval] = useState<NodeJS.Timeout | null>(null)
  const [autoFetchSeconds, setAutoFetchSeconds] = useState(5)
  const [statusRefreshInterval, setStatusRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [showHealthCheck, setShowHealthCheck] = useState(false)
  const [showStats, setShowStats] = useState(false)

  // Local progress tracking
  const [totalDispatched, setTotalDispatched] = useState(0)
  const [totalDistance, setTotalDistance] = useState(0)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [elapsedTime, setElapsedTime] = useState("00:00:00")
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Recovery state
  const [recoveryState, setRecoveryState] = useState<{
    isRecovering: boolean
    lastState?: {
      seed: string
      targetDispatches: number
      maxActiveCalls: number
      totalDispatched: number
      totalDistance: number
      startTime: string
      isAutoDispatch: boolean
    }
  }>({ isRecovering: false })

  // Check system health on component mount
  useEffect(() => {
    const checkSystemHealth = async () => {
      try {
        const health = await getSystemHealth()
        setSystemStatus({
          ...health,
          lastUpdated: new Date().toISOString(),
        })

        // Show warning if either API is unhealthy
        if (health.mainApi.status === "unhealthy" || health.autoDispatchApi.status === "unhealthy") {
          const unhealthyApis = []
          if (health.mainApi.status === "unhealthy") unhealthyApis.push("Main API")
          if (health.autoDispatchApi.status === "unhealthy") unhealthyApis.push("Auto Dispatch API")

          toast.error("System Health Issue", {
            description: `${unhealthyApis.join(" and ")} ${unhealthyApis.length > 1 ? "are" : "is"} currently unavailable.`,
            duration: 10000,
          })
        }
      } catch (err) {
        logger.error("Failed to check system health", { error: err })
      }
    }

    checkSystemHealth()

    // Set up interval for periodic health checks (every minute)
    const healthInterval = setInterval(checkSystemHealth, 60000)

    return () => clearInterval(healthInterval)
  }, [])

  // Calculate emergency statistics
  const calculateEmergencyStats = useCallback((emergencies: EmergencyCall[]) => {
    const stats: EmergencyStats = {
      totalCalls: emergencies.length,
      totalRequests: {
        Medical: 0,
        Police: 0,
        Fire: 0,
        Rescue: 0,
        Utility: 0,
      },
      pendingRequests: {
        Medical: 0,
        Police: 0,
        Fire: 0,
        Rescue: 0,
        Utility: 0,
      },
      dispatchedRequests: {
        Medical: 0,
        Police: 0,
        Fire: 0,
        Rescue: 0,
        Utility: 0,
      },
    }

    // Calculate totals for each emergency type
    emergencies.forEach((emergency) => {
      emergency.requests.forEach((request) => {
        // Add to total requests
        stats.totalRequests[request.Type] += request.Quantity

        // Get dispatched count for this type
        const dispatched = (emergency.dispatched as Record<EmergencyType, number>)?.[request.Type] || 0

        // Add to dispatched requests
        stats.dispatchedRequests[request.Type] += dispatched

        // Calculate pending (total - dispatched)
        stats.pendingRequests[request.Type] += Math.max(0, request.Quantity - dispatched)
      })
    })

    return stats
  }, [])

  // Fetch all data including emergencies queue
  const fetchData = useCallback(async () => {
    try {
      const [locationsData, resourcesData, resourceStatsData, statusData] = await Promise.all([
        fetchLocations(),
        fetchAllAvailableResources(),
        fetchResourceAvailability(),
        fetchControlStatus(),
      ])

      // Use type assertion to resolve type conflicts
      setLocations(locationsData as any)
      setResources(resourcesData)
      setResourceStats(resourceStatsData)
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
      // Clear any previous errors when we successfully fetch data
      setError(null)

      // Log successful data fetch
      logger.info("Data fetched successfully", {
        resourcesCount: resourcesData.length,
        locationsCount: locationsData.length,
        simulationStatus: statusData?.status,
      })

      return true
    } catch (err) {
      // Only set error if we're in a running simulation
      if (isSimulationRunning) {
        const errorMessage = "Failed to fetch data. Please check if the API server is running."
        setError(errorMessage)

        // Log the error
        logger.error("Error fetching data", { error: err })

        // Show toast notification for the error
        toast.error("Connection Error", {
          description: errorMessage,
          duration: 5000,
        })
      }

      setIsLoading(false)
      return false
    }
  }, [isSimulationRunning])

  // Separate function to fetch emergencies queue with better error handling
  const fetchEmergenciesQueue = useCallback(async () => {
    try {
      const emergenciesData = await fetchEmergencyCalls()

      // Update the emergencies state, preserving dispatched counts
      setEmergencies((prevEmergencies) => {
        const updatedEmergencies = emergenciesData.map((newEmergency) => {
          // Try to find this emergency in the previous list
          const prevEmergency = prevEmergencies.find(
            (e) => e.city === newEmergency.city && e.county === newEmergency.county,
          )

          // If found, preserve the dispatched count
          if (prevEmergency && prevEmergency.dispatched) {
            return {
              ...newEmergency,
              dispatched: prevEmergency.dispatched,
            }
          }

          // Otherwise, initialize dispatched to 0 for each type
          const dispatchedByType: Record<EmergencyType, number> = {} as Record<EmergencyType, number>
          newEmergency.requests.forEach((req) => {
            dispatchedByType[req.Type] = 0
          })

          return {
            ...newEmergency,
            dispatched: dispatchedByType,
          }
        })

        // Calculate emergency statistics
        setEmergencyStats(calculateEmergencyStats(updatedEmergencies))

        return updatedEmergencies
      })

      // If we have a selected emergency, check if it needs to be updated
      if (selectedEmergency) {
        const updatedEmergency = emergenciesData.find(
          (e) => e.city === selectedEmergency.city && e.county === selectedEmergency.county,
        )

        if (updatedEmergency) {
          // Update the selected emergency with the latest data
          // but preserve the dispatched count
          setSelectedEmergency({
            ...updatedEmergency,
            dispatched: selectedEmergency.dispatched,
          })
        } else {
          // If the emergency is no longer in the queue, deselect it
          setSelectedEmergency(null)
        }
      }

      logger.info("Emergencies queue fetched", { count: emergenciesData.length })
    } catch (err) {
      logger.error("Failed to fetch emergencies queue", { error: err })

      // Only show toast if we're in a running simulation
      if (isSimulationRunning) {
        toast.error("Error", {
          description: "Failed to fetch emergencies queue. The server may be unavailable.",
          duration: 3000,
        })
      }
    }
  }, [selectedEmergency, isSimulationRunning, calculateEmergencyStats])

  // Start timer for tracking elapsed time
  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    const now = new Date()
    setStartTime(now)

    // Save start time to localStorage for recovery
    localStorage.setItem("simulationStartTime", now.toISOString())

    timerRef.current = setInterval(() => {
      if (startTime) {
        const now = new Date()
        const diff = now.getTime() - startTime.getTime()

        // Format elapsed time as HH:MM:SS
        const hours = Math.floor(diff / 3600000)
          .toString()
          .padStart(2, "0")
        const minutes = Math.floor((diff % 3600000) / 60000)
          .toString()
          .padStart(2, "0")
        const seconds = Math.floor((diff % 60000) / 1000)
          .toString()
          .padStart(2, "0")

        setElapsedTime(`${hours}:${minutes}:${seconds}`)
      }
    }, 1000)
  }, [startTime])

  // Stop timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Clear the saved start time
    localStorage.removeItem("simulationStartTime")
  }, [])

  const startRefreshInterval = useCallback(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
    }

    // Fetch data every 2 seconds
    const interval = setInterval(() => {
      fetchData()
      fetchEmergenciesQueue() // Specifically fetch emergencies queue
    }, 2000)

    setRefreshInterval(interval)
  }, [fetchData, fetchEmergenciesQueue, refreshInterval])

  const stopRefreshInterval = useCallback(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      setRefreshInterval(null)
    }
  }, [refreshInterval])

  // Start status refresh interval
  const startStatusRefreshInterval = useCallback(() => {
    if (statusRefreshInterval) {
      clearInterval(statusRefreshInterval)
    }

    // Fetch status every second (changed from 1000ms to 500ms for more frequent updates)
    const interval = setInterval(async () => {
      try {
        const statusData = await fetchControlStatus()

        // Check if simulation is still running
        if (statusData && statusData.status !== "Running") {
          // If simulation is stopped, clear the status and intervals
          setStatus(null)
          setIsSimulationRunning(false)
          stopStatusRefreshInterval()
          stopRefreshInterval()
          return
        }

        setStatus(statusData)

        // Update local progress from status
        if (statusData) {
          setTotalDispatched(statusData.totalDispatches)
          setTotalDistance(statusData.distance)
        }
      } catch (error) {
        logger.error("Status refresh error", { error })
      }
    }, 500) // Changed from 1000ms to 500ms

    setStatusRefreshInterval(interval)
  }, [statusRefreshInterval, stopRefreshInterval])

  // Stop status refresh interval
  const stopStatusRefreshInterval = useCallback(() => {
    if (statusRefreshInterval) {
      clearInterval(statusRefreshInterval)
      setStatusRefreshInterval(null)
    }
  }, [statusRefreshInterval])

  // Auto-fetch emergencies when enabled
  useEffect(() => {
    let autoFetchIntervalId: NodeJS.Timeout | null = null

    if (autoFetchEnabled && isSimulationRunning && !isAutoDispatch) {
      // Clear any existing interval
      if (autoFetchInterval) {
        clearInterval(autoFetchInterval)
      }

      // Set up new interval to check and fetch emergencies
      const interval = setInterval(async () => {
        try {
          // Check current status
          const statusData = await fetchControlStatus()

          // Stop auto-fetch if simulation is no longer running
          if (!statusData || statusData.status !== "Running") {
            clearInterval(interval)
            setAutoFetchInterval(null)
            setAutoFetchEnabled(false)
            return
          }

          // Only fetch next emergency if we're below the threshold
          if (statusData && statusData.status === "Running" && statusData.requestCount < statusData.maxActiveCalls) {
            logger.info("Auto-fetching next emergency", {
              currentCount: statusData.requestCount,
              maxCount: statusData.maxActiveCalls,
              intervalSeconds: autoFetchSeconds,
            })

            await fetchNextEmergency()
            await fetchEmergenciesQueue()

            toast.success("Auto-fetched Emergency", {
              description: "Automatically fetched next emergency",
              duration: 2000,
            })
          }
        } catch (error) {
          logger.error("Auto-fetch error", { error })
          toast.error("Auto-fetch Failed", {
            description: "Failed to fetch next emergency automatically. The server may be unavailable.",
            duration: 3000,
          })
        }
      }, autoFetchSeconds * 1000) // Use the user-configured interval

      setAutoFetchInterval(interval)
      autoFetchIntervalId = interval

      return () => {
        if (autoFetchIntervalId) {
          clearInterval(autoFetchIntervalId)
        }
      }
    } else if (autoFetchInterval) {
      // Clean up interval if auto-fetch is disabled
      clearInterval(autoFetchInterval)
      setAutoFetchInterval(null)
    }
  }, [
    autoFetchEnabled,
    isSimulationRunning,
    isAutoDispatch,
    fetchEmergenciesQueue,
    autoFetchSeconds,
    autoFetchInterval,
  ])

  // Save simulation state to localStorage
  const saveSimulationState = useCallback(
    (seed: string, targetDispatches: number, maxActiveCalls: number, isAuto = false) => {
      const state = {
        seed,
        targetDispatches,
        maxActiveCalls,
        totalDispatched,
        totalDistance,
        startTime: startTime ? startTime.toISOString() : new Date().toISOString(),
        isRunning: true,
        isAutoDispatch: isAuto,
        lastUpdated: new Date().toISOString(),
      }

      localStorage.setItem("simulationState", JSON.stringify(state))
      logger.info("Simulation state saved", { state })
    },
    [totalDispatched, totalDistance, startTime],
  )

  // Clear saved simulation state
  const clearSimulationState = useCallback(() => {
    localStorage.removeItem("simulationState")
    localStorage.removeItem("recoveryNotificationShown")
    logger.info("Simulation state cleared")
  }, [])

  const handleReset = useCallback(
    async (seed: string, targetDispatches: number, maxActiveCalls: number) => {
      try {
        // Check system health before starting
        const health = await getSystemHealth()

        if (health.mainApi.status === "unhealthy") {
          toast.error("Cannot Start Simulation", {
            description: "The main API is currently unavailable. Please try again later.",
            duration: 5000,
          })
          return
        }

        // If auto dispatch is running, stop it first
        if (isAutoDispatch) {
          await stopSimulation()
          setIsAutoDispatch(false)
        }

        setIsLoading(true)

        // Reset local progress tracking
        setTotalDispatched(0)
        setTotalDistance(0)

        // Call the reset API
        const result = await resetControl(seed, targetDispatches, maxActiveCalls)

        if (result) {
          // Start the timer
          startTimer()

          // Save the simulation state
          saveSimulationState(seed, targetDispatches, maxActiveCalls, false)

          // Fetch initial data
          await fetchData()
          await fetchEmergenciesQueue() // Initial fetch of emergencies

          // Start the refresh interval
          startRefreshInterval()

          // Start the status refresh interval
          startStatusRefreshInterval()

          setIsSimulationRunning(true)

          logger.info("Manual simulation reset and started", {
            seed,
            targetDispatches,
            maxActiveCalls,
          })

          toast.success("Simulation Started", {
            description: `Simulation started with seed: ${seed}`,
          })
        }
      } catch (err) {
        const errorMessage = "Failed to reset control. Please check if the API server is running."
        setError(errorMessage)
        logger.error("Error resetting simulation", { error: err })
        toast.error("Error", {
          description: errorMessage,
          duration: 5000,
        })
      } finally {
        setIsLoading(false)
      }
    },
    [
      fetchData,
      fetchEmergenciesQueue,
      isAutoDispatch,
      saveSimulationState,
      startRefreshInterval,
      startTimer,
      startStatusRefreshInterval,
    ],
  )

  const handleStop = useCallback(async () => {
    try {
      // Set stopping state to prevent multiple stop attempts
      setIsStoppingSimulation(true)

      // Call the stop API with POST method
      await stopControl()

      // If auto dispatch is running, stop it too
      if (isAutoDispatch) {
        try {
          await stopSimulation()
        } catch (error) {
          logger.error("Failed to stop auto dispatch", { error })
          // Continue with cleanup even if auto dispatch stop fails
        }
        setIsAutoDispatch(false)
      }

      // Stop the timer
      stopTimer()

      // Stop the refresh intervals
      stopRefreshInterval()
      stopStatusRefreshInterval()

      // Clear the saved simulation state
      clearSimulationState()

      // Clear the recovery notification flag
      localStorage.removeItem("recoveryNotificationShown")

      // Clear all data and selections
      setEmergencies([])
      setResources([])
      setSelectedEmergency(null)
      setSelectedResource(null)
      setStatus(null)
      setTotalDispatched(0)
      setTotalDistance(0)

      // Update UI state
      setIsSimulationRunning(false)

      // Disable auto-fetch
      setAutoFetchEnabled(false)

      logger.info("Simulation stopped and all data cleared")

      toast.success("Simulation Stopped", {
        description: "The simulation has been stopped successfully.",
      })
    } catch (err) {
      const errorMessage = "Failed to stop control. Please check if the API server is running."
      setError(errorMessage)
      logger.error("Error stopping simulation", { error: err })

      toast.error("Error", {
        description: errorMessage,
        duration: 5000,
      })
    } finally {
      setIsStoppingSimulation(false)
    }
  }, [clearSimulationState, isAutoDispatch, stopRefreshInterval, stopStatusRefreshInterval, stopTimer])

  const handleFetchNext = useCallback(async () => {
    try {
      // Call the API to fetch the next emergency
      await fetchNextEmergency()

      // Update the emergencies queue
      await fetchEmergenciesQueue()

      logger.info("Fetched next emergency")
      toast.success("New Emergency", {
        description: "Fetched next emergency successfully",
      })
    } catch (err) {
      logger.error("Failed to fetch next emergency", { error: err })
      toast.error("Error", {
        description: "Failed to fetch next emergency. Please try again.",
      })
    }
  }, [fetchEmergenciesQueue])

  const handleEmergencySelect = (emergency: EmergencyCall) => {
    setSelectedEmergency(emergency)
    logger.debug("Emergency selected", {
      city: emergency.city,
      county: emergency.county,
      requests: emergency.requests,
      dispatched: emergency.dispatched,
    })
  }

  const handleResourceSelect = (resource: EmergencyResource) => {
    setSelectedResource(resource)
    logger.debug("Resource selected", {
      city: resource.city,
      county: resource.county,
      type: resource.type,
      available: resource.quantity,
    })
  }

  const handleDispatchSuccess = async (
    from: string,
    to: string,
    quantity: number,
    distance: number,
    type: EmergencyType,
  ) => {
    // Update local progress tracking
    setTotalDispatched((prev) => prev + quantity)
    setTotalDistance((prev) => prev + distance)

    // Update the dispatched count for the selected emergency
    if (selectedEmergency) {
      setSelectedEmergency((prev) => {
        if (!prev) return null

        // Create a new dispatched object with updated count for this type
        const updatedDispatched = { ...(prev.dispatched as Record<EmergencyType, number>) }
        updatedDispatched[type] = (updatedDispatched[type] || 0) + quantity

        return {
          ...prev,
          dispatched: updatedDispatched,
        }
      })
    }

    // Update the resource quantity in the resources list
    if (selectedResource) {
      setResources((prevResources) => {
        return prevResources.map((resource) => {
          if (
            resource.city === selectedResource.city &&
            resource.county === selectedResource.county &&
            resource.type === selectedResource.type
          ) {
            return {
              ...resource,
              quantity: resource.quantity - quantity,
            }
          }
          return resource
        })
      })
    }

    // Update the emergencies list to reflect the dispatch
    setEmergencies((prevEmergencies) => {
      const updatedEmergencies = prevEmergencies.map((emergency) => {
        if (emergency.city === selectedEmergency?.city && emergency.county === selectedEmergency?.county) {
          // Create a new dispatched object with updated count for this type
          const updatedDispatched = { ...(emergency.dispatched as Record<EmergencyType, number>) }
          updatedDispatched[type] = (updatedDispatched[type] || 0) + quantity

          return {
            ...emergency,
            dispatched: updatedDispatched,
          }
        }
        return emergency
      })

      // Update emergency statistics
      setEmergencyStats(calculateEmergencyStats(updatedEmergencies))

      return updatedEmergencies
    })

    // Save updated state to localStorage
    const state = JSON.parse(localStorage.getItem("simulationState") || "{}")
    if (state.isRunning) {
      state.totalDispatched = totalDispatched + quantity
      state.totalDistance = totalDistance + distance
      state.lastUpdated = new Date().toISOString()
      localStorage.setItem("simulationState", JSON.stringify(state))
    }

    // Log the dispatch
    logger.info(`${type} resource dispatched successfully`, {
      type,
      from,
      to,
      quantity,
      distance,
      totalDispatched: totalDispatched + quantity,
      totalDistance: totalDistance + distance,
    })

    // Clear selections after successful dispatch
    setSelectedEmergency(null)
    setSelectedResource(null)

    // Fetch updated data from the server
    await fetchEmergenciesQueue()
    await fetchData()
  }

  // Handle auto dispatch start
  const handleAutoDispatchStart = useCallback(async () => {
    // Check system health before starting
    const health = await getSystemHealth()

    if (health.autoDispatchApi.status === "unhealthy") {
      toast.error("Cannot Start Auto Dispatch", {
        description: "The auto dispatch API is currently unavailable. Please try again later.",
        duration: 5000,
      })
      return
    }

    // Update state to indicate auto dispatch is running
    setIsAutoDispatch(true)

    // Start the timer if it's not already running
    if (!startTime) {
      startTimer()
    }

    // Start the refresh interval for regular data
    startRefreshInterval()

    // Start the status refresh interval
    startStatusRefreshInterval()

    // Try to get the auto dispatch status
    try {
      const autoStatus = await getSimulationStatus()
      logger.info("Auto dispatch status", { autoStatus })
    } catch (error) {
      logger.error("Failed to get auto dispatch status", { error })
    }

    // Save simulation state with auto flag
    const status = await fetchControlStatus()
    if (status) {
      saveSimulationState(status.seed || "default", status.targetDispatches, status.maxActiveCalls, true)
    }

    // Disable auto-fetch when auto-dispatch is running
    setAutoFetchEnabled(false)

    logger.info("Auto dispatch started")
  }, [fetchControlStatus, saveSimulationState, startRefreshInterval, startStatusRefreshInterval, startTime, startTimer])

  // Handle auto dispatch stop
  const handleAutoDispatchStop = useCallback(async () => {
    // Update state to indicate auto dispatch is stopped
    setIsAutoDispatch(false)

    // Try to get the updated auto dispatch status
    try {
      const autoStatus = await getSimulationStatus()
      logger.info("Auto dispatch status after stop", { autoStatus })
    } catch (error) {
      logger.error("Failed to get auto dispatch status after stop", { error })
    }

    // Don't stop the timer or refresh interval here,
    // as they might be needed for manual dispatch

    logger.info("Auto dispatch stopped")
  }, [])

  // Check for saved simulation state on component mount
  useEffect(() => {
    const checkForSavedState = async () => {
      // Add a flag to localStorage to prevent showing the recovery toast multiple times
      const recoveryShown = localStorage.getItem("recoveryNotificationShown")

      const savedStateJson = localStorage.getItem("simulationState")
      const savedStartTimeJson = localStorage.getItem("simulationStartTime")

      if (savedStateJson && !recoveryShown) {
        try {
          const savedState = JSON.parse(savedStateJson)

          // Check if the saved state is recent (within the last hour)
          const lastUpdated = new Date(savedState.lastUpdated)
          const now = new Date()
          const timeDiff = now.getTime() - lastUpdated.getTime()
          const isRecent = timeDiff < 3600000 // 1 hour

          if (savedState.isRunning && isRecent) {
            // Set flag to prevent showing the toast again
            localStorage.setItem("recoveryNotificationShown", "true")

            setRecoveryState({
              isRecovering: true,
              lastState: savedState,
            })

            // Show recovery toast
            toast.info("Simulation Recovery", {
              description: "A previous simulation was detected. Would you like to resume?",
              action: {
                label: "Resume",
                onClick: () => {
                  // Resume the simulation
                  setTotalDispatched(savedState.totalDispatched || 0)
                  setTotalDistance(savedState.totalDistance || 0)
                  setIsAutoDispatch(savedState.isAutoDispatch || false)

                  if (savedStartTimeJson) {
                    setStartTime(new Date(savedStartTimeJson))
                  }

                  // Set the active tab based on the simulation type
                  setActiveTab(savedState.isAutoDispatch ? "auto" : "manual")

                  handleReset(
                    savedState.seed || "default",
                    savedState.targetDispatches || 10000,
                    savedState.maxActiveCalls || 100,
                  )

                  setRecoveryState({ isRecovering: false })

                  logger.info("Simulation resumed from saved state", { savedState })
                },
              },
              onDismiss: () => {
                // Clear the saved state
                clearSimulationState()
                setRecoveryState({ isRecovering: false })
              },
              duration: 10000,
            })
          } else {
            // Clear outdated state
            clearSimulationState()
          }
        } catch (error) {
          logger.error("Error parsing saved simulation state", { error })
          clearSimulationState()
        }
      }
    }

    // Initial data fetch - don't automatically start a simulation
    const initialFetch = async () => {
      try {
        const [locationsData] = await Promise.all([fetchLocations()])
        setLocations(locationsData as any)
        setIsLoading(false)
      } catch (err) {
        // Don't set error on initial load
        setIsLoading(false)
      }
    }

    initialFetch()
    checkForSavedState()

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (autoFetchInterval) {
        clearInterval(autoFetchInterval)
      }
      if (statusRefreshInterval) {
        clearInterval(statusRefreshInterval)
      }
    }
  }, [clearSimulationState, handleReset, refreshInterval, autoFetchInterval, statusRefreshInterval])

  // Create a local status object that includes our tracked metrics
  const localStatus = status
    ? {
        ...status,
        runningTime: elapsedTime,
        totalDispatches: totalDispatched,
        distance: totalDistance,
      }
    : null

  // Toggle health check panel
  const toggleHealthCheck = () => {
    setShowHealthCheck(!showHealthCheck)
  }

  // Toggle stats panel
  const toggleStats = () => {
    setShowStats(!showStats)
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-blue-700 text-white p-4 shadow-md flex justify-between items-center">
        <h1 className="text-2xl font-bold">Emercery - Emergency Dispatch System</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleStats}
            className="bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            Statistics
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleHealthCheck}
            className="bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
          >
            System Health
          </Button>
        </div>
      </header>

      {/* System health panel */}
      {showHealthCheck && (
        <div className="p-4">
          <HealthCheck />
        </div>
      )}

      {/* Statistics panel */}
      {showStats && (
        <div className="p-4">
          <ResourceStats resourceStats={resourceStats} emergencyStats={emergencyStats} />
        </div>
      )}

      {/* System status alerts */}
      {systemStatus && (
        <>
          {systemStatus.mainApi.status === "unhealthy" && (
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Main API Unavailable</AlertTitle>
              <AlertDescription>
                The main API is currently unavailable. Manual dispatch operations will not work.
              </AlertDescription>
            </Alert>
          )}

          {systemStatus.autoDispatchApi.status === "unhealthy" && (
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Auto Dispatch API Unavailable</AlertTitle>
              <AlertDescription>
                The auto dispatch API is currently unavailable. Automatic dispatch operations will not work.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-3/4 h-full flex flex-col">
          <div className="flex-1 m-4 relative overflow-hidden">
            <LeafletMap
              locations={locations}
              resources={resources}
              emergencies={emergencies}
              selectedEmergency={selectedEmergency}
              selectedResource={selectedResource}
            />
          </div>

          <StatusPanel status={localStatus} isLoading={isLoading} error={error} />
        </div>

        <div className="w-full md:w-1/4 h-full overflow-y-auto bg-gray-50 border-l">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="manual">Manual Dispatch</TabsTrigger>
              <TabsTrigger value="auto">Auto Dispatch</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-4 p-4">
              <ControlPanel
                onReset={handleReset}
                onStop={handleStop}
                onFetchNext={handleFetchNext}
                isRunning={isSimulationRunning && !isAutoDispatch}
                isStopping={isStoppingSimulation}
              />

              {isSimulationRunning && !isAutoDispatch && (
                <Card className={`${autoFetchEnabled ? "bg-blue-50 border-blue-200" : "bg-gray-50"} mb-4`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant={autoFetchEnabled ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAutoFetchEnabled(!autoFetchEnabled)}
                          className="h-8"
                        >
                          {autoFetchEnabled ? "Disable" : "Enable"} Auto-fetch
                        </Button>
                        <span className={`text-sm ${autoFetchEnabled ? "text-blue-700 font-medium" : "text-gray-600"}`}>
                          Keep queue at max active calls
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="auto-fetch-interval" className="text-sm">
                          <Clock className="h-4 w-4 inline mr-1" />
                          Auto-fetch interval: <span className="font-medium">{autoFetchSeconds} seconds</span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs">1s</span>
                        <Slider
                          id="auto-fetch-interval"
                          value={[autoFetchSeconds]}
                          min={1}
                          max={30}
                          step={1}
                          onValueChange={(value) => setAutoFetchSeconds(value[0])}
                          disabled={!autoFetchEnabled}
                          className="flex-1"
                        />
                        <span className="text-xs">30s</span>
                      </div>

                      {autoFetchEnabled && (
                        <div className="text-xs text-blue-600 mt-1">
                          Auto-fetching emergencies when count &lt; {status?.maxActiveCalls || "max"}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {isAutoDispatch && isSimulationRunning && (
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="p-4 text-yellow-700">
                    <p className="text-center font-medium">
                      Auto dispatch is currently running. Stop it before using manual dispatch.
                    </p>
                  </CardContent>
                </Card>
              )}

              <EmergencyPanel
                emergencies={emergencies}
                onSelect={handleEmergencySelect}
                selectedEmergency={selectedEmergency}
              />

              <ResourcePanel
                resources={resources}
                onSelect={handleResourceSelect}
                selectedResource={selectedResource}
                selectedEmergency={selectedEmergency}
                onDispatchSuccess={handleDispatchSuccess}
              />
            </TabsContent>

            <TabsContent value="auto" className="p-4">
              <AutoDispatchPanel
                onStatusUpdate={fetchData}
                onEmergenciesUpdate={fetchEmergenciesQueue}
                status={status}
                isManualRunning={isSimulationRunning && !isAutoDispatch}
                onAutoStart={handleAutoDispatchStart}
                onAutoStop={handleAutoDispatchStop}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
