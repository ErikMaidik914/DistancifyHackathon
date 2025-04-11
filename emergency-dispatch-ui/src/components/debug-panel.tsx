"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bug, Download, Trash2 } from "lucide-react"
import { logger } from "./logger"

/**
 * Debug panel component for viewing and exporting logs
 * This can be added to the dashboard for development/debugging purposes
 */
export function DebugPanel() {
  const [logs, setLogs] = useState<unknown[]>([])
  const [isVisible, setIsVisible] = useState(false)

  const loadLogs = () => {
    setLogs(logger.getLogs())
  }

  const clearLogs = () => {
    logger.clearLogs()
    setLogs([])
  }

  const exportLogs = () => {
    const json = logger.exportLogs()
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = `emercery-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const toggleVisibility = () => {
    if (!isVisible) {
      loadLogs()
    }
    setIsVisible(!isVisible)
  }

  // Get log level color
  const getLevelColor = (level: string) => {
    switch (level) {
      case "debug":
        return "text-gray-500"
      case "info":
        return "text-blue-500"
      case "warn":
        return "text-yellow-500"
      case "error":
        return "text-red-500"
      default:
        return "text-gray-700"
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button variant="outline" size="sm" className="bg-white shadow-md" onClick={toggleVisibility}>
        <Bug className="h-4 w-4 mr-2" />
        {isVisible ? "Hide Logs" : "Show Logs"}
      </Button>

      {isVisible && (
        <Card className="absolute bottom-12 right-0 w-[600px] max-h-[500px] shadow-xl">
          <CardHeader className="pb-2 flex flex-row justify-between items-center">
            <CardTitle className="text-lg">Application Logs</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadLogs}>
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportLogs}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={clearLogs}>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              {logs.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No logs available</div>
              ) : (
                <div className="space-y-1 p-2 font-mono text-xs">
                  {logs.map((log, index) => (
                    <div key={index} className="border-b border-gray-100 pb-1 mb-1 last:border-0">
                      <div className="flex items-start">
                        <span className="text-gray-400 mr-2">{new Date((log as { timestamp: string }).timestamp).toLocaleTimeString()}</span>
                        <span className={`font-bold uppercase ${getLevelColor((log as { level: string }).level)}`}>{(log as { level: string }).level}</span>
                        <span className="ml-2 text-gray-800">{typeof log === "object" && log !== null && "message" in log ? (log as { message: string }).message : ""}</span>
                      </div>
                      {typeof log === "object" && log !== null && Object.keys(log).filter((key) => !["timestamp", "level", "message"].includes(key)).length >
                        0 && (
                        <div className="ml-12 mt-1 text-gray-600 bg-gray-50 p-1 rounded">
                          {Object.entries(log as Record<string, unknown>)
                            .filter(([key]) => !["timestamp", "level", "message"].includes(key))
                            .map(([key, value]) => (
                              <div key={key}>
                                <span className="text-gray-500">{key}:</span> <span>{JSON.stringify(value)}</span>
                              </div>
                            ))}
                        </div>
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
