/**
 * Logger utility for the application
 * Provides consistent logging with severity levels and structured data
 */

type LogLevel = "debug" | "info" | "warn" | "error"

interface LoggerOptions {
  enableConsole: boolean
  minLevel: LogLevel
  enableLocalStorage: boolean
  maxLocalStorageLogs: number
}

// Default options
const defaultOptions: LoggerOptions = {
  enableConsole: true,
  minLevel: "info",
  enableLocalStorage: true,
  maxLocalStorageLogs: 1000,
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

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = { ...defaultOptions, ...options }
  }

  /**
   * Log a message with metadata at the specified level
   */
  private log(level: LogLevel, message: string, meta: Record<string, unknown> = {}) {
    // Check if this log level should be processed
    if (LOG_LEVELS[level] < LOG_LEVELS[this.options.minLevel]) {
      return
    }

    const timestamp = new Date().toISOString()
    const logData = {
      timestamp,
      level,
      message,
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
  }

  /**
   * Get the appropriate console method for the log level
   */
  private getConsoleMethod(level: LogLevel): (message: string, ...args: unknown[]) => void {
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
  private logToLocalStorage(logData: unknown) {
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
   * Get all logs from localStorage
   */
  getLogs(): unknown[] {
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
   * Export logs as JSON
   */
  exportLogs(): string {
    const logs = this.getLogs()
    return JSON.stringify(logs, null, 2)
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
  debug(message: string, meta: Record<string, unknown> = {}): void {
    this.log("debug", message, meta)
  }

  /**
   * Info level logging
   */
  info(message: string, meta: Record<string, unknown> = {}): void {
    this.log("info", message, meta)
  }

  /**
   * Warning level logging
   */
  warn(message: string, meta: Record<string, unknown> = {}): void {
    this.log("warn", message, meta)
  }

  /**
   * Error level logging
   */
  error(message: string, meta: Record<string, unknown> = {}): void {
    this.log("error", message, meta)
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
