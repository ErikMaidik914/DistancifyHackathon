"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, CheckCircle, AlertTriangle, XCircle } from "lucide-react"
import { getSystemHealth } from "@/services/api"
import type { SystemStatus, HealthStatus } from "@/types"
import { logger } from "./logger"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/**
 * Health Check Component
 *
 * Displays the health status of the main API and auto dispatch backend.
 * Allows manual refresh of health status.
 */
export function HealthCheck() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Function to fetch health status
  const fetchHealthStatus = async (showLoading = true) => {
    if (showLoading) {
      setIsRefreshing(true)
    }

    try {
      const health = await getSystemHealth()
      setSystemStatus({
        ...health,
        lastUpdated: new Date().toISOString(),
      })
      setError(null)
      logger.info("Health check completed", { health })
    } catch (err) {
      const errorMessage = "Failed to check system health"
      setError(errorMessage)
      logger.error("Health check failed", { error: err })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  // Initial health check
  useEffect(() => {
    fetchHealthStatus()

    // Set up interval for periodic health checks (every 30 seconds)
    const interval = setInterval(() => {
      fetchHealthStatus(false)
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  // Function to get status badge
  const getStatusBadge = (status: HealthStatus) => {
    switch (status.status) {
      case "healthy":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Healthy
          </Badge>
        )
      case "degraded":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Degraded {status.responseTime > 1000 ? "(Slow)" : ""}
          </Badge>
        )
      case "unhealthy":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300">
            <XCircle className="h-3 w-3 mr-1" />
            Unhealthy
          </Badge>
        )
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">Unknown</Badge>
    }
  }

  // Function to handle manual refresh
  const handleRefresh = () => {
    fetchHealthStatus()
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span>Checking system health...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row justify-between items-center">
        <CardTitle className="text-lg">System Health</CardTitle>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="h-8">
          {isRefreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700">{error}</div>
        ) : systemStatus ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-medium">Main API</div>
                  {getStatusBadge(systemStatus.mainApi)}
                </div>
                <div className="text-sm text-gray-600">
                  <div>
                    Response Time:{" "}
                    <span className={systemStatus.mainApi.responseTime > 1000 ? "text-orange-500 font-medium" : ""}>
                      {systemStatus.mainApi.responseTime.toFixed(2)}ms
                    </span>
                  </div>
                  <div className="truncate">{systemStatus.mainApi.message}</div>
                </div>

                {/* Additional reliability indicators */}
                {systemStatus.mainApi.status !== "healthy" && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="text-xs font-medium text-gray-500 mb-1">What this means:</div>
                    {systemStatus.mainApi.status === "degraded" ? (
                      <div className="text-xs text-yellow-600">
                        Service is responding but might be slow or unreliable. Expect some retries or timeouts.
                      </div>
                    ) : (
                      <div className="text-xs text-red-600">
                        Service is unavailable. Dispatch operations will fail until the API recovers.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-gray-50 p-3 rounded-md">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-medium">Auto Dispatch API</div>
                  {getStatusBadge(systemStatus.autoDispatchApi)}
                </div>
                <div className="text-sm text-gray-600">
                  <div>
                    Response Time:{" "}
                    <span
                      className={systemStatus.autoDispatchApi.responseTime > 1000 ? "text-orange-500 font-medium" : ""}
                    >
                      {systemStatus.autoDispatchApi.responseTime.toFixed(2)}ms
                    </span>
                  </div>
                  <div className="truncate">{systemStatus.autoDispatchApi.message}</div>
                </div>

                {/* Additional reliability indicators */}
                {systemStatus.autoDispatchApi.status !== "healthy" && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="text-xs font-medium text-gray-500 mb-1">What this means:</div>
                    {systemStatus.autoDispatchApi.status === "degraded" ? (
                      <div className="text-xs text-yellow-600">
                        Auto-dispatch is responding but might be slow. Manual dispatch is recommended.
                      </div>
                    ) : (
                      <div className="text-xs text-red-600">
                        Auto-dispatch is unavailable. Use manual dispatch until the service recovers.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Add new reliability warnings section */}
            {(systemStatus.mainApi.status !== "healthy" || systemStatus.autoDispatchApi.status !== "healthy") && (
              <Alert variant={systemStatus.mainApi.status === "unhealthy" ? "destructive" : "warning"} className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>API Reliability Issues Detected</AlertTitle>
                <AlertDescription>
                  {systemStatus.mainApi.status === "unhealthy" ? (
                    <span>
                      The main API is currently unavailable. Dispatch operations will fail until the API recovers.
                    </span>
                  ) : systemStatus.mainApi.status === "degraded" ? (
                    <span>
                      The main API is experiencing degraded performance. You may encounter slow responses or occasional
                      errors.
                    </span>
                  ) : (
                    <span>The auto-dispatch API is experiencing issues. Manual dispatch is recommended.</span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="text-xs text-gray-500 text-right">
              Last updated: {new Date(systemStatus.lastUpdated).toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500">No health data available</div>
        )}
      </CardContent>
    </Card>
  )
}
