"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { RefreshCw, AlertCircle, Clock, Check } from "lucide-react"
import { logger } from "./logger"

/**
 * API Performance Monitor Component
 *
 * Displays real-time API performance metrics and response time trends
 */
export function ApiPerformance() {
  // State for storing performance metrics
  const [metrics, setMetrics] = useState({
    averageResponseTime: 0,
    successRate: 100,
    totalRequests: 0,
    lastUpdated: new Date(),
    endpoints: {} as Record<
      string,
      {
        avg: number
        min: number
        max: number
        count: number
        failures: number
      }
    >,
  })
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Calculate performance metrics from logs
  const calculateMetrics = () => {
    setIsRefreshing(true)
    try {
      const logs = logger.getLogs()

      // Filter API response logs that have timing info
      const apiLogs = logs.filter((log) => log.message.includes("API Response") && log.responseTime !== undefined)

      if (apiLogs.length === 0) {
        setIsRefreshing(false)
        return
      }

      // Calculate total and average response times
      let totalTime = 0
      let totalRequests = 0
      let failedRequests = 0
      const endpoints: Record<
        string,
        {
          times: number[]
          failures: number
        }
      > = {}

      apiLogs.forEach((log) => {
        // Extract response time
        const time = Number.parseFloat(String(log.responseTime))
        if (!isNaN(time)) {
          totalTime += time
          totalRequests++

          // Extract endpoint
          const url = log.url || ""
          const matches = url.match(/\/([^/]+)\/([^/?]+)/)
          const endpoint = matches ? `/${matches[1]}/${matches[2]}` : url

          // Store response time by endpoint
          if (!endpoints[endpoint]) {
            endpoints[endpoint] = { times: [], failures: 0 }
          }
          endpoints[endpoint].times.push(time)

          // Count failures
          if (log.status >= 400 || log.message.includes("failed")) {
            failedRequests++
            endpoints[endpoint].failures++
          }
        }
      })

      // Calculate average response time
      const averageResponseTime = totalRequests > 0 ? totalTime / totalRequests : 0

      // Calculate success rate
      const successRate = totalRequests > 0 ? ((totalRequests - failedRequests) / totalRequests) * 100 : 100

      // Process endpoint statistics
      const endpointMetrics: Record<
        string,
        {
          avg: number
          min: number
          max: number
          count: number
          failures: number
        }
      > = {}

      Object.entries(endpoints).forEach(([endpoint, data]) => {
        if (data.times.length > 0) {
          const sum = data.times.reduce((a, b) => a + b, 0)
          const avg = sum / data.times.length
          const min = Math.min(...data.times)
          const max = Math.max(...data.times)

          endpointMetrics[endpoint] = {
            avg,
            min,
            max,
            count: data.times.length,
            failures: data.failures,
          }
        }
      })

      // Update state
      setMetrics({
        averageResponseTime,
        successRate,
        totalRequests,
        lastUpdated: new Date(),
        endpoints: endpointMetrics,
      })
    } catch (error) {
      console.error("Error calculating API metrics:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Initial calculation on component mount
  useEffect(() => {
    calculateMetrics()

    // Set up interval to refresh metrics
    const interval = setInterval(calculateMetrics, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [])

  // Get performance rating
  const getPerformanceRating = (time: number) => {
    if (time < 200) return { label: "Excellent", color: "text-green-500" }
    if (time < 500) return { label: "Good", color: "text-blue-500" }
    if (time < 1000) return { label: "Fair", color: "text-yellow-500" }
    return { label: "Poor", color: "text-red-500" }
  }

  // Get response time color based on speed
  const getResponseTimeColor = (time: number) => {
    if (time < 200) return "bg-green-500"
    if (time < 500) return "bg-blue-500"
    if (time < 1000) return "bg-yellow-500"
    return "bg-red-500"
  }

  // Format time in ms with appropriate unit
  const formatTime = (time: number) => {
    return time < 1000 ? `${time.toFixed(0)}ms` : `${(time / 1000).toFixed(1)}s`
  }

  const performanceRating = getPerformanceRating(metrics.averageResponseTime)

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row justify-between items-center">
        <CardTitle className="text-lg">API Performance</CardTitle>
        <Button variant="outline" size="sm" onClick={calculateMetrics} disabled={isRefreshing} className="h-8">
          {isRefreshing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Main metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-3 rounded-md text-center">
              <div className="text-xs text-gray-500">AVG RESPONSE TIME</div>
              <div className={`font-medium text-xl ${performanceRating.color}`}>
                {formatTime(metrics.averageResponseTime)}
              </div>
              <div className="text-xs mt-1">{performanceRating.label}</div>
            </div>

            <div className="bg-gray-50 p-3 rounded-md text-center">
              <div className="text-xs text-gray-500">SUCCESS RATE</div>
              <div className={`font-medium text-xl ${metrics.successRate > 90 ? "text-green-500" : "text-red-500"}`}>
                {metrics.successRate.toFixed(1)}%
              </div>
              <div className="text-xs mt-1">
                {metrics.successRate > 95 ? (
                  <span className="text-green-500 flex items-center justify-center">
                    <Check className="h-3 w-3 mr-1" /> Reliable
                  </span>
                ) : metrics.successRate > 90 ? (
                  <span className="text-yellow-500 flex items-center justify-center">
                    <AlertCircle className="h-3 w-3 mr-1" /> Occasional Errors
                  </span>
                ) : (
                  <span className="text-red-500 flex items-center justify-center">
                    <AlertCircle className="h-3 w-3 mr-1" /> Unreliable
                  </span>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-md text-center">
              <div className="text-xs text-gray-500">TOTAL REQUESTS</div>
              <div className="font-medium text-xl">{metrics.totalRequests}</div>
              <div className="text-xs mt-1 flex items-center justify-center">
                <Clock className="h-3 w-3 mr-1" />
                Last updated: {metrics.lastUpdated.toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* Endpoint performance */}
          {Object.keys(metrics.endpoints).length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Endpoint Response Times</h4>
              <div className="space-y-3">
                {Object.entries(metrics.endpoints)
                  .sort((a, b) => b[1].avg - a[1].avg) // Sort by slowest first
                  .map(([endpoint, data]) => (
                    <div key={endpoint} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <div className="text-xs font-mono truncate max-w-[250px]">{endpoint}</div>
                        <div className="text-xs text-gray-500 flex items-center">
                          {data.count} calls
                          {data.failures > 0 && <span className="ml-1 text-red-500">({data.failures} failed)</span>}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className="w-full">
                          <Progress value={100} className="h-2" indicatorClassName={getResponseTimeColor(data.avg)} />
                        </div>
                        <span className="ml-2 text-xs font-medium">{formatTime(data.avg)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Min: {formatTime(data.min)}</span>
                        <span>Max: {formatTime(data.max)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Tips for performance */}
          {metrics.averageResponseTime > 500 && (
            <div className="bg-yellow-50 p-3 rounded-md text-yellow-700 text-sm mt-4">
              <div className="font-medium mb-1">Performance Notes:</div>
              <ul className="list-disc list-inside text-xs space-y-1">
                <li>
                  API response times are {metrics.averageResponseTime > 1000 ? "significantly " : ""}slower than optimal
                </li>
                <li>Expect potential timeouts on complex operations</li>
                <li>For better reliability, reduce concurrent requests when possible</li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
