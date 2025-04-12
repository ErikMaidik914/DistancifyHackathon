/**
 * Enhanced Logger utility for the application
 * Provides consistent logging with severity levels, structured data, and error tracking
 */

type LogLevel = "debug" | "info" | "warn" | "error"

interface LoggerOptions {
  enableConsole: boolean
  minLevel: LogLevel
  enableLocalStorage: boolean
  maxLocalStorageLogs: number
  enableErrorTracking: boolean
  errorSampleRate: number
}

// Default options
const defaultOptions: LoggerOptions = {
  enableConsole: true,
  minLevel: "info",
  enableLocalStorage: true,
  maxLocalStorageLogs: 1000,
  enableErrorTracking: true,
  errorSampleRate: 1.0, // Sample 100% of errors by default
}

// Log level priorities (higher number = higher priority)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

class Logger {
  private options: LoggerOptions
  private localStorageKey = "emercery_logs"
  private errorStorageKey = "emercery_errors"
  private sessionId: string

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = { ...defaultOptions, ...options }
    // Generate a unique session ID for this browser session
    this.sessionId = this.generateSessionId()
  }

  /**
   * Generates a unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * Log a message with metadata at the specified level
   */
  private log(level: LogLevel, message: string, meta: Record<string, any> = {}) {
    // Check if this log level should be processed
    if (LOG_LEVELS[level] < LOG_LEVELS[this.options.minLevel]) {
      return
    }

    const timestamp = new Date().toISOString()
    const logData = {
      timestamp,
      level,
      message,
      sessionId: this.sessionId,
      ...meta,
    }

    // Log to console if enabled
    if (this.options.enableConsole) {
      const consoleMethod = this.getConsoleMethod(level)
      consoleMethod(`[${timestamp}] [${level.toUpperCase()}] ${message}`, meta)
    }

    // Log to localStorage if enabled (browser only)
    if (this.options.enableLocalStorage && typeof window !== "undefined") {
      this.logToLocalStorage(logData)
    }

    // Track errors separately if enabled
    if (level === "error" && this.options.enableErrorTracking && typeof window !== "undefined") {
      this.trackError(message, meta)
    }
  }

  /**
   * Get the appropriate console method for the log level
   */
  private getConsoleMethod(level: LogLevel): (message: string, ...args: any[]) => void {
    switch (level) {
      case "debug":
        return console.debug
      case "info":
        return console.info
      case "warn":
        return console.warn
      case "error":
        return console.error
      default:
        return console.log
    }
  }

  /**
   * Store logs in localStorage with a maximum number of entries
   */
  private logToLocalStorage(logData: any) {
    try {
      // Get existing logs
      const logsJson = localStorage.getItem(this.localStorageKey) || "[]"
      const logs = JSON.parse(logsJson)

      // Add new log
      logs.push(logData)

      // Trim logs if they exceed the maximum
      if (logs.length > this.options.maxLocalStorageLogs) {
        logs.splice(0, logs.length - this.options.maxLocalStorageLogs)
      }

      // Save back to localStorage
      localStorage.setItem(this.localStorageKey, JSON.stringify(logs))
    } catch (error) {
      // If localStorage fails, log to console as fallback
      console.error("Failed to write logs to localStorage:", error)
    }
  }

  /**
   * Track errors separately for error reporting
   */
  private trackError(message: string, meta: Record<string, any> = {}) {
    // Apply sampling if configured
    if (Math.random() > this.options.errorSampleRate) {
      return
    }

    try {
      // Get existing errors
      const errorsJson = localStorage.getItem(this.errorStorageKey) || "[]"
      const errors = JSON.parse(errorsJson)

      // Add new error with additional context
      errors.push({
        timestamp: new Date().toISOString(),
        message,
        sessionId: this.sessionId,
        userAgent: navigator.userAgent,
        url: window.location.href,
        ...meta,
      })

      // Keep only the last 100 errors
      if (errors.length > 100) {
        errors.splice(0, errors.length - 100)
      }

      // Save back to localStorage
      localStorage.setItem(this.errorStorageKey, JSON.stringify(errors))
    } catch (error) {
      console.error("Failed to track error:", error)
    }
  }

  /**
   * Get all logs from localStorage
   */
  getLogs(): any[] {
    if (typeof window === "undefined") return []

    try {
      const logsJson = localStorage.getItem(this.localStorageKey) || "[]"
      return JSON.parse(logsJson)
    } catch (error) {
      console.error("Failed to read logs from localStorage:", error)
      return []
    }
  }

  /**
   * Get all tracked errors from localStorage
   */
  getErrors(): any[] {
    if (typeof window === "undefined") return []

    try {
      const errorsJson = localStorage.getItem(this.errorStorageKey) || "[]"
      return JSON.parse(errorsJson)
    } catch (error) {
      console.error("Failed to read errors from localStorage:", error)
      return []
    }
  }

  /**
   * Clear all logs from localStorage
   */
  clearLogs(): void {
    if (typeof window === "undefined") return

    try {
      localStorage.removeItem(this.localStorageKey)
    } catch (error) {
      console.error("Failed to clear logs from localStorage:", error)
    }
  }

  /**
   * Clear all tracked errors from localStorage
   */
  clearErrors(): void {
    if (typeof window === "undefined") return

    try {
      localStorage.removeItem(this.errorStorageKey)
    } catch (error) {
      console.error("Failed to clear errors from localStorage:", error)
    }
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    const logs = this.getLogs()
    return JSON.stringify(logs, null, 2)
  }

  /**
   * Export errors as JSON
   */
  exportErrors(): string {
    const errors = this.getErrors()
    return JSON.stringify(errors, null, 2)
  }

  /**
   * Set the minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.options.minLevel = level
  }

  /**
   * Debug level logging
   */
  debug(message: string, meta: Record<string, any> = {}): void {
    this.log("debug", message, meta)
  }

  /**
   * Info level logging
   */
  info(message: string, meta: Record<string, any> = {}): void {
    this.log("info", message, meta)
  }

  /**
   * Warning level logging
   */
  warn(message: string, meta: Record<string, any> = {}): void {
    this.log("warn", message, meta)
  }

  /**
   * Error level logging
   */
  error(message: string, meta: Record<string, any> = {}): void {
    this.log("error", message, meta)
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string {
    return this.sessionId
  }

  /**
   * Track API response time
   */
  trackApiPerformance(url: string, method: string, responseTime: number, status: number): void {
    try {
      const timestamp = new Date().toISOString()
      const performanceData = {
        timestamp,
        url,
        method,
        responseTime,
        status,
        success: status < 400,
      }

      // Store in localStorage with a separate key
      const perfDataKey = "emercery_api_performance"
      const perfDataJson = localStorage.getItem(perfDataKey) || "[]"
      const perfData = JSON.parse(perfDataJson)

      // Add new entry
      perfData.push(performanceData)

      // Keep only the last 100 entries
      if (perfData.length > 100) {
        perfData.splice(0, perfData.length - 100)
      }

      localStorage.setItem(perfDataKey, JSON.stringify(perfData))
    } catch (error) {
      console.error("Failed to track API performance:", error)
    }
  }

  /**
   * Get API performance metrics
   */
  getApiPerformanceMetrics(): any[] {
    if (typeof window === "undefined") return []

    try {
      const perfDataKey = "emercery_api_performance"
      const perfDataJson = localStorage.getItem(perfDataKey) || "[]"
      return JSON.parse(perfDataJson)
    } catch (error) {
      console.error("Failed to read API performance metrics:", error)
      return []
    }
  }

  /**
   * Clear API performance metrics
   */
  clearApiPerformanceMetrics(): void {
    if (typeof window === "undefined") return

    try {
      localStorage.removeItem("emercery_api_performance")
    } catch (error) {
      console.error("Failed to clear API performance metrics:", error)
    }
  }
}

// Create and export a singleton logger instance
export const logger = new Logger({
  // In development, show all logs
  minLevel: process.env.NODE_ENV === "production" ? "info" : "debug",
})

// For testing or specific components, you can create a new logger with different options
export const createLogger = (options: Partial<LoggerOptions> = {}): Logger => {
  return new Logger(options)
}
