/**
 * API Service Module
 *
 * Provides functions for interacting with both the main API and auto-dispatch backend.
 * Supports multiple emergency types with type-specific endpoints.
 */
import { logger } from "@/components/logger"
import type {
    ControlStatus,
    DispatchRequest,
    EmergencyCall,
    EmergencyResource,
    EmergencyType,
    Location,
    SimulationConfig,
    ApiError,
    ApiResponse,
    HealthStatus,
    ResourceAvailability,
  } from "@/types"
  
  // API configuration
  const API_CONFIG = {
    MAIN_API_URL: "http://localhost:5000",
    AUTO_DISPATCH_API_URL: "http://localhost:8000",
    DEFAULT_TIMEOUT: 10000, // 10 seconds
    MAX_RETRIES: 3,
    RETRY_DELAY_BASE: 500, // 500ms base delay with exponential backoff
  }
  
  /**
   * Generic API request handler with comprehensive error handling and retry logic
   *
   * @param url - The API endpoint URL
   * @param method - HTTP method (GET, POST, etc.)
   * @param body - Optional request body
   * @param options - Additional request options
   * @param retries - Number of retry attempts
   * @returns Promise resolving to the API response
   * @throws ApiError with detailed information about the failure
   */
  async function apiRequest<T>(
    url: string,
    method = "GET",
    body?: unknown,
    options: RequestInit = {},
    retries = API_CONFIG.MAX_RETRIES,
  ): Promise<ApiResponse<T>> {
    let lastError: Error | null = null
    const startTime = performance.now()
  
    // Create a controller for timeout handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, API_CONFIG.DEFAULT_TIMEOUT)
  
    // Merge options with defaults
    const requestOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    }
  
    if (body) {
      requestOptions.body = JSON.stringify(body)
    }
  
    // Log the request
    logger.debug(`API Request: ${method} ${url}`, {
      method,
      url,
      body: body ? JSON.stringify(body) : undefined,
    })
  
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Clear previous timeout if this is a retry
        if (attempt > 1) {
          clearTimeout(timeoutId)
        }
  
        const response = await fetch(url, requestOptions)
        const responseTime = performance.now() - startTime
  
        // Log the response
        logger.debug(`API Response: ${response.status} ${method} ${url}`, {
          status: response.status,
          statusText: response.statusText,
          attempt,
          responseTime: `${responseTime.toFixed(2)}ms`,
        })
  
        // Handle different response status codes
        if (!response.ok) {
          let errorData: unknown = {}
          let errorMessage = `API error (${response.status}): ${response.statusText}`
  
          try {
            // Try to parse error response as JSON
            errorData = await response.json()
            if (typeof errorData === "object" && errorData !== null && "detail" in errorData) {
              errorMessage = (errorData as { detail?: string; message?: string }).detail || (errorData as { detail?: string; message?: string }).message || errorMessage
            }
          } catch {
            // If not JSON, try to get text
            try {
              errorMessage = (await response.text()) || errorMessage
            } catch {
              // If text fails, use default message
            }
          }
  
          throw new Error(errorMessage)
        }
  
        // Check if the response is empty
        const contentType = response.headers.get("content-type")
        let data: T
  
        if (contentType && contentType.includes("application/json")) {
          data = await response.json()
        } else {
          // Return an empty object for empty responses
          data = {} as T
        }
  
        // Clear the timeout
        clearTimeout(timeoutId)
  
        return {
          data,
          status: response.status,
          headers: response.headers,
          responseTime,
        }
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error))
  
        // Check if this was a timeout
        if (error instanceof Error && error.name === "AbortError") {
          logger.warn(`API Request timeout: ${method} ${url}`, {
            timeout: API_CONFIG.DEFAULT_TIMEOUT,
            attempt,
          })
          lastError = new Error(`Request timeout after ${API_CONFIG.DEFAULT_TIMEOUT}ms`)
        } else {
          logger.error(`API Request failed: ${method} ${url}`, {
            error: lastError.message,
            attempt,
            willRetry: attempt < retries,
          })
        }
  
        // Clear the timeout if it exists
        clearTimeout(timeoutId)
  
        // Only retry on network errors, timeouts, or 5xx server errors
        const shouldRetry =
          (error instanceof Error && error.name === "AbortError") ||
          lastError.message.includes("fetch failed") ||
          lastError.message.includes("API error (5")
  
        if (shouldRetry && attempt < retries) {
          // Exponential backoff: 500ms, 1000ms, 2000ms, etc.
          const delay = Math.min(API_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt - 1), 5000)
          logger.debug(`Retrying request in ${delay}ms: ${method} ${url}`, { attempt, delay })
          await new Promise((resolve) => setTimeout(resolve, delay))
        } else {
          // Don't retry for client errors or other issues
          break
        }
      }
    }
  
    // If we get here, all retries failed
    const apiError: ApiError = {
        message: lastError?.message || "Unknown API error",
        url,
        method,
        retries,
        originalError: lastError || undefined,
        name: ""
    }
  
    throw apiError
  }
  
  /**
   * Checks the health of an API endpoint
   *
   * @param apiUrl - The base URL of the API to check
   * @returns Promise resolving to the health status
   */
  export async function checkApiHealth(apiUrl: string): Promise<HealthStatus> {
    try {
      const startTime = performance.now()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // Short timeout for health checks

      const response = await fetch(`${apiUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId))
      const responseTime = performance.now() - startTime
  
      return {
        status: response.ok ? "healthy" : "degraded",
        responseTime,
        message: response.ok ? "API is healthy" : `API returned status ${response.status}`,
        lastChecked: new Date().toISOString(),
      }
    } catch (error) {
      logger.error(`Health check failed for ${apiUrl}`, { error })
      return {
        status: "unhealthy",
        responseTime: 0,
        message: error instanceof Error ? error.message : "Unknown error",
        lastChecked: new Date().toISOString(),
      }
    }
  }
  
  /**
   * Fetches a list of locations from the main API
   *
   * @returns Promise resolving to an array of locations
   * @throws ApiError if the request fails
   */
  export async function fetchLocations(): Promise<Location[]> {
    try {
      const response = await apiRequest<Location[]>(`${API_CONFIG.MAIN_API_URL}/locations`)
      return response.data
    } catch (error) {
      logger.error("Failed to fetch locations", { error })
      // Return empty array as fallback
      return []
    }
  }
  
  /**
   * Fetches available resources for a specific emergency type
   *
   * @param type - The type of emergency resource to fetch
   * @returns Promise resolving to an array of emergency resources
   */
  export async function fetchAvailableResources(type: EmergencyType): Promise<EmergencyResource[]> {
    try {
      const endpoint = type.toLowerCase()
      const response = await apiRequest<EmergencyResource[]>(`${API_CONFIG.MAIN_API_URL}/${endpoint}/search`)
  
      // Add the type to each resource
      return response.data.map((resource: EmergencyResource) => {
        if (typeof resource === "object" && resource !== null) {
          return {
            ...resource,
            type,
            county: resource.county || "",
            city: resource.city || "",
            latitude: resource.latitude || 0,
            longitude: resource.longitude || 0,
            quantity: resource.quantity || 0,
          }
        }
        throw new Error("Invalid resource type: Expected an object")
      })
    } catch (error) {
      logger.error(`Failed to fetch available ${type} resources`, { error, type })
      // Return empty array as fallback
      return []
    }
  }
  
  /**
   * Fetches available resources for all emergency types
   *
   * @returns Promise resolving to an array of all emergency resources
   */
  export async function fetchAllAvailableResources(): Promise<EmergencyResource[]> {
    try {
      const types: EmergencyType[] = ["Medical", "Police", "Fire", "Rescue", "Utility"]
      const resourcePromises = types.map((type) => fetchAvailableResources(type))
      const resourceArrays = await Promise.all(resourcePromises)
  
      // Flatten the arrays
      return resourceArrays.flat()
    } catch (error) {
      logger.error("Failed to fetch all available resources", { error })
      // Return empty array as fallback
      return []
    }
  }
  
  /**
   * Fetches resource availability statistics for all emergency types
   *
   * @returns Promise resolving to an array of resource availability statistics
   */
  export async function fetchResourceAvailability(): Promise<ResourceAvailability[]> {
    try {
      const resources = await fetchAllAvailableResources()
      const types: EmergencyType[] = ["Medical", "Police", "Fire", "Rescue", "Utility"]
  
      return types.map((type) => {
        const typeResources = resources.filter((r) => r.type === type)
        const totalAvailable = typeResources.reduce((sum, r) => sum + r.quantity, 0)
        const totalLocations = typeResources.length
  
        return {
          type,
          available: totalAvailable,
          total: totalAvailable, // We don't know the total capacity, so we use available as a proxy
          locations: totalLocations,
        }
      })
    } catch (error) {
      logger.error("Failed to fetch resource availability", { error })
      return []
    }
  }
  
  /**
   * Fetches emergency calls from the queue
   *
   * @returns Promise resolving to an array of emergency calls
   * @throws ApiError if the request fails
   */
  export async function fetchEmergencyCalls(): Promise<EmergencyCall[]> {
    try {
      const response = await apiRequest<EmergencyCall[]>(`${API_CONFIG.MAIN_API_URL}/calls/queue`)
  
      // Initialize dispatched counts for each emergency type
    return response.data.map((call: EmergencyCall) => ({
      ...call,
      dispatched:
        call.dispatched ||
        (Object.fromEntries(
          call.requests.map((req) => [req.Type as EmergencyType, 0])
        ) as Record<EmergencyType, number>),
    }))
    } catch (error) {
      logger.error("Failed to fetch emergency calls", { error })
      // Return empty array as fallback
      return []
    }
  }
  
  /**
   * Fetches the next emergency from the queue
   *
   * @returns Promise resolving to the next emergency call
   * @throws ApiError if the request fails
   */
  export async function fetchNextEmergency(): Promise<EmergencyCall | null> {
    try {
      const response = await apiRequest<EmergencyCall>(`${API_CONFIG.MAIN_API_URL}/calls/next`)
  
      // Initialize dispatched counts for each emergency type
      const call = response.data
      return {
        ...call,
        dispatched:
          call.dispatched ||
          (Object.fromEntries(call.requests.map((req: { Type: unknown }) => [req.Type, 0])) as Record<EmergencyType, number>),
      }
    } catch (error) {
      logger.error("Failed to fetch next emergency", { error })
      throw error
    }
  }
  
  /**
   * Fetches the current control status from the main API
   *
   * @returns Promise resolving to the control status
   * @throws ApiError if the request fails
   */
  export async function fetchControlStatus(): Promise<ControlStatus | null> {
    try {
      const response = await apiRequest<ControlStatus>(`${API_CONFIG.MAIN_API_URL}/control/status`)
      return response.data
    } catch (error) {
      logger.error("Failed to fetch control status", { error })
      return null
    }
  }
  
  /**
   * Resets the control system with the specified parameters
   *
   * @param seed - Random seed for the simulation
   * @param targetDispatches - Target number of dispatches
   * @param maxActiveCalls - Maximum number of active calls
   * @returns Promise resolving to the control status
   * @throws ApiError if the request fails
   */
  export async function resetControl(
    seed = "default",
    targetDispatches = 10000,
    maxActiveCalls = 100,
  ): Promise<ControlStatus> {
    try {
      const response = await apiRequest<ControlStatus>(
        `${API_CONFIG.MAIN_API_URL}/control/reset?seed=${seed}&targetDispatches=${targetDispatches}&maxActiveCalls=${maxActiveCalls}`,
        "POST"
    )
      return response.data
    } catch (error) {
      logger.error("Failed to reset control", { error, seed, targetDispatches, maxActiveCalls })
      throw error
    }
  }
  
  /**
   * Stops the control system
   *
   * @returns Promise resolving to the control status
   * @throws ApiError if the request fails
   */
  export async function stopControl(): Promise<ControlStatus> {
    try {
      const response = await apiRequest<ControlStatus>(`${API_CONFIG.MAIN_API_URL}/control/stop`, "POST")
      return response.data
    } catch (error) {
      logger.error("Failed to stop control", { error })
      throw error
    }
  }
  
  /**
   * Dispatches an emergency resource to an emergency
   *
   * @param type - The type of emergency resource to dispatch
   * @param params - Dispatch parameters including source and target locations
   * @returns Promise resolving to the dispatch result
   * @throws ApiError if the request fails
   */
  export async function dispatchResource(
    type: EmergencyType,
    params: {
      sourceCounty: string
      sourceCity: string
      targetCounty: string
      targetCity: string
      quantity: number
    },
  ): Promise<unknown> {
    // Validate input parameters
    if (
      !params.sourceCounty ||
      !params.sourceCity ||
      !params.targetCounty ||
      !params.targetCity ||
      params.quantity <= 0
    ) {
      throw new Error("Invalid dispatch parameters: All fields are required and quantity must be positive")
    }
  
    // Create the properly formatted request body
    const requestBody: DispatchRequest = {
      sourceCounty: params.sourceCounty,
      sourceCity: params.sourceCity,
      targetCounty: params.targetCounty,
      targetCity: params.targetCity,
      quantity: params.quantity,
    }
  
    logger.debug(`${type} dispatch request`, { type, request: requestBody })
  
    try {
      const endpoint = type.toLowerCase()
      const response = await apiRequest<unknown>(`${API_CONFIG.MAIN_API_URL}/${endpoint}/dispatch`, "POST", requestBody)
      return response.data
    } catch (error) {
      // Log the detailed error for debugging
      logger.error(`${type} dispatch API error`, { error, type, request: requestBody })
  
      // Rethrow the error to be handled by the caller
      throw error
    }
  }
  
  /**
   * Starts an automatic simulation with the specified configuration
   *
   * @param config - Simulation configuration parameters
   * @returns Promise resolving to the simulation result
   * @throws ApiError if the request fails
   */
  export async function startSimulation(config: SimulationConfig): Promise<unknown> {
    // Validate the configuration
    if (!config.api_url) {
      throw new Error("API URL is required for simulation")
    }
  
    // Format the request to match the backend's expected structure
    const requestBody = {
      api_url: config.api_url,
      seed: config.seed,
      targetDispatches: config.targetDispatches,
      maxActiveCalls: config.maxActiveCalls,
      poll_interval: config.poll_interval,
      status_interval: config.status_interval,
    }
  
    logger.debug("Starting simulation with config", { config: requestBody })
  
    try {
      // First check if the auto dispatch API is available
      const healthStatus = await checkApiHealth(API_CONFIG.AUTO_DISPATCH_API_URL)
  
      if (healthStatus.status === "unhealthy") {
        throw new Error(`Auto dispatch API is unavailable: ${healthStatus.message}`)
      }
  
      // Use the auto dispatch API URL
      const response = await apiRequest<unknown>(`${API_CONFIG.AUTO_DISPATCH_API_URL}/simulate`, "POST", requestBody)
      return response.data
    } catch (error) {
      logger.error("Failed to start simulation", { error, config: requestBody })
      throw error
    }
  }
  
  /**
   * Gets the current status of the automatic simulation
   *
   * @returns Promise resolving to the simulation status
   * @throws ApiError if the request fails
   */
  export async function getSimulationStatus(): Promise<unknown> {
    try {
      // Use the auto dispatch API URL
      const response = await apiRequest<unknown>(`${API_CONFIG.AUTO_DISPATCH_API_URL}/simulate/status`)
      return response.data
    } catch (error) {
      logger.error("Failed to get simulation status", { error })
      // Return null instead of throwing to allow UI to handle gracefully
      return null
    }
  }
  
  /**
   * Stops the automatic simulation
   *
   * @returns Promise resolving to the stop result
   * @throws ApiError if the request fails
   */
  export async function stopSimulation(): Promise<unknown> {
    try {
      // Use the auto dispatch API URL
      const response = await apiRequest<unknown>(`${API_CONFIG.AUTO_DISPATCH_API_URL}/simulate/stop`, "POST")
      return response.data
    } catch (error) {
      logger.error("Failed to stop simulation", { error })
      throw error
    }
  }
  
  /**
   * Gets the health status of both the main API and auto dispatch backend
   *
   * @returns Promise resolving to the health status of both APIs
   */
  export async function getSystemHealth(): Promise<{
    mainApi: HealthStatus
    autoDispatchApi: HealthStatus
  }> {
    const [mainApiHealth, autoDispatchApiHealth] = await Promise.all([
      checkApiHealth(API_CONFIG.MAIN_API_URL),
      checkApiHealth(API_CONFIG.AUTO_DISPATCH_API_URL),
    ])
  
    return {
      mainApi: mainApiHealth,
      autoDispatchApi: autoDispatchApiHealth,
    }
  }
  