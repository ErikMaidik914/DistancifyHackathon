import { logger } from "@/components/logger"
import { toast } from "sonner"

// Global error categories for easy referencing
export enum ErrorCategory {
  NETWORK = "network",
  SERVER = "server",
  TIMEOUT = "timeout",
  AUTH = "auth",
  VALIDATION = "validation",
  UNKNOWN = "unknown",
}

/**
 * Central error handling utility for API and other errors
 */
export const ErrorHandler = {
  /**
   * Handle API errors with consistent logging and UI feedback
   */
  handleApiError: (error: Error, context: string, showToast = true): ErrorCategory => {
    const errorMessage = error.message || "Unknown error occurred"
    let category: ErrorCategory = ErrorCategory.UNKNOWN
    let userFriendlyMessage = "An unexpected error occurred. Please try again."

    // Categorize the error
    if (
      errorMessage.includes("fetch failed") ||
      errorMessage.includes("Network") ||
      errorMessage.includes("ECONNREFUSED")
    ) {
      category = ErrorCategory.NETWORK
      userFriendlyMessage = "Network connection error. Please check your internet connection."
    } else if (errorMessage.includes("timeout") || errorMessage.includes("AbortError")) {
      category = ErrorCategory.TIMEOUT
      userFriendlyMessage = "Request timed out. The server is taking too long to respond."
    } else if (errorMessage.includes("401") || errorMessage.includes("403")) {
      category = ErrorCategory.AUTH
      userFriendlyMessage = "Authentication error. Please refresh the page and try again."
    } else if (errorMessage.includes("400") || errorMessage.includes("422") || errorMessage.includes("validation")) {
      category = ErrorCategory.VALIDATION
      userFriendlyMessage = "Invalid data submitted. Please check your inputs and try again."
    } else if (errorMessage.includes("500") || errorMessage.includes("502") || errorMessage.includes("503")) {
      category = ErrorCategory.SERVER
      userFriendlyMessage = "Server error occurred. Please try again later."
    }

    // Extended error message with more details

    // Log the error with context
    logger.error(`API Error [${category}]: ${context}`, {
      category,
      error: errorMessage,
      stack: error.stack,
    })

    // Show toast notification if enabled
    if (showToast) {
      toast.error("Operation Failed", {
        description: userFriendlyMessage,
        duration: 5000,
      })
    }

    return category
  },

  /**
   * Handle validation errors (usually from form inputs)
   */
  handleValidationError: (message: string, field?: string): void => {
    logger.warn(`Validation error${field ? ` in ${field}` : ""}`, { message })

    toast.error("Validation Error", {
      description: message,
      duration: 3000,
    })
  },
}
