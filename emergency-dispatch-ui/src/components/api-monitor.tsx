"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertCircle, X, RefreshCw, Download, Trash2 } from "lucide-react"
import { logger } from "@/utils/logger"
import { Badge } from "@/components/ui/badge"

export function ApiErrorMonitor() {
  const [errors, setErrors] = useState<any[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [hasNewErrors, setHasNewErrors] = useState(false)

  // Load errors on mount and when visibility changes
  useEffect(() => {
    if (isVisible) {
      loadErrors()
      setHasNewErrors(false)
    }
  }, [isVisible])

  // Check for new errors periodically
  useEffect(() => {
    const checkForNewErrors = () => {
      const currentErrors = logger.getErrors()
      if (currentErrors.length > errors.length && !isVisible) {
        setHasNewErrors(true)
      }
    }

    const interval = setInterval(checkForNewErrors, 5000)
    return () => clearInterval(interval)
  }, [errors.length, isVisible])

  const loadErrors = () => {
    const loggedErrors = logger.getErrors()
    setErrors(loggedErrors)
  }

  const clearErrors = () => {
    logger.clearErrors()
    setErrors([])
    setHasNewErrors(false)
  }

  const exportErrors = () => {
    const json = logger.exportErrors()
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = `emercery-errors-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const toggleVisibility = () => {
    setIsVisible(!isVisible)
    if (!isVisible) {
      setIsCollapsed(false)
    }
  }

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed)
  }

  // Get error category color
  const getErrorColor = (error: any) => {
    if (error.message?.includes("timeout") || error.message?.includes("AbortError")) {
      return "bg-yellow-100 text-yellow-800 border-yellow-300"
    }
    if (error.message?.includes("fetch failed") || error.message?.includes("Network")) {
      return "bg-orange-100 text-orange-800 border-orange-300"
    }
    if (error.message?.includes("500") || error.message?.includes("503")) {
      return "bg-red-100 text-red-800 border-red-300"
    }
    if (error.message?.includes("400") || error.message?.includes("422")) {
      return "bg-purple-100 text-purple-800 border-purple-300"
    }
    return "bg-gray-100 text-gray-800 border-gray-300"
  }

  // Get error category name
  const getErrorCategory = (error: any) => {
    if (error.message?.includes("timeout") || error.message?.includes("AbortError")) {
      return "Timeout"
    }
    if (error.message?.includes("fetch failed") || error.message?.includes("Network")) {
      return "Network"
    }
    if (error.message?.includes("500") || error.message?.includes("503")) {
      return "Server Error"
    }
    if (error.message?.includes("400") || error.message?.includes("422")) {
      return "Bad Request"
    }
    return "Other"
  }

  // Group errors by endpoint
  const groupedErrors = errors.reduce(
    (groups, error) => {
      const url = error.url || "Unknown"
      const endpoint = url.split("?")[0] // Remove query params

      if (!groups[endpoint]) {
        groups[endpoint] = []
      }

      groups[endpoint].push(error)
      return groups
    },
    {} as Record<string, any[]>,
  )

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        variant={hasNewErrors ? "destructive" : "outline"}
        size="sm"
        className={`${hasNewErrors ? "" : "bg-white"} shadow-md`}
        onClick={toggleVisibility}
      >
        <AlertCircle className="h-4 w-4 mr-2" />
        {isVisible ? "Hide API Errors" : hasNewErrors ? "New API Errors!" : "API Errors"}
        {!isVisible && errors.length > 0 && (
          <Badge variant="outline" className="ml-2 bg-gray-100">
            {errors.length}
          </Badge>
        )}
      </Button>

      {isVisible && (
        <Card
          className={`absolute ${isCollapsed ? "w-[300px]" : "w-[600px]"} max-h-[500px] shadow-xl right-0 bottom-12`}
        >
          <CardHeader className="pb-2 flex flex-row justify-between items-center">
            <CardTitle className="text-lg flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              API Errors
              <Badge variant="outline" className="ml-2 bg-gray-100">
                {errors.length}
              </Badge>
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={toggleCollapsed} className="h-8 px-2">
                {isCollapsed ? "Expand" : "Collapse"}
              </Button>
              <Button variant="ghost" size="sm" onClick={toggleVisibility} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-2 flex justify-between items-center border-b">
              <div className="text-sm text-gray-500">
                {errors.length === 0 ? "No errors recorded" : `Showing ${errors.length} errors`}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadErrors} className="h-7 text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={exportErrors} className="h-7 text-xs">
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
                <Button variant="outline" size="sm" onClick={clearErrors} className="h-7 text-xs">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[350px]">
              {errors.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No API errors recorded</div>
              ) : isCollapsed ? (
                // Collapsed view - show summary by endpoint
                <div className="p-2 space-y-2">
                  {Object.entries(groupedErrors).map(([endpoint, endpointErrors], index) => (
                    <Card key={index} className="p-2 text-sm">
                      <div className="font-medium truncate">{endpoint}</div>
                      <div className="flex justify-between items-center mt-1">
                        <div className="text-gray-500 text-xs">
                          {endpointErrors.length} error{endpointErrors.length !== 1 ? "s" : ""}
                        </div>
                        <Badge variant="outline" className={getErrorColor(endpointErrors[endpointErrors.length - 1])}>
                          {getErrorCategory(endpointErrors[endpointErrors.length - 1])}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                // Expanded view - show all errors
                <div className="space-y-1 p-2">
                  {errors.map((error, index) => (
                    <div key={index} className="border-b border-gray-100 pb-2 mb-2 last:border-0">
                      <div className="flex justify-between items-start">
                        <div className="font-medium text-sm">{error.message}</div>
                        <Badge variant="outline" className={getErrorColor(error)}>
                          {getErrorCategory(error)}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{new Date(error.timestamp).toLocaleString()}</div>
                      <div className="text-xs text-gray-600 mt-1 truncate">
                        {error.url ? (
                          <span className="font-mono">
                            {error.method} {error.url}
                          </span>
                        ) : (
                          <span>No URL information</span>
                        )}
                      </div>
                      {error.retries && <div className="text-xs text-gray-600">Retries: {error.retries}</div>}
                      {error.stack && (
                        <details className="mt-1">
                          <summary className="text-xs text-gray-500 cursor-pointer">Stack trace</summary>
                          <pre className="text-xs bg-gray-50 p-1 mt-1 overflow-x-auto">{error.stack}</pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
