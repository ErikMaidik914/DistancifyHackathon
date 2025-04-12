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
  DEFAULT_TIMEOUT: 15000, // Increased from 10 seconds to 15 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 750, // Increased base delay to 750ms
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
  body?: any,
  options: RequestInit = {},
  retries = API_CONFIG.MAX_RETRIES,
): Promise<ApiResponse<T>> {
  let lastError: Error | null = null
  const startTime = performance.now()

  // Create a controller for timeout handling
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort("Request timeout")
  }, options.timeout || API_CONFIG.DEFAULT_TIMEOUT)

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

      // Add a more detailed logging for retry attempts
      if (attempt > 1) {
        logger.info(`Retry attempt ${attempt}/${retries} for ${method} ${url}`, {
          lastError: lastError?.message,
        })
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

      logger.trackApiPerformance(url, method, responseTime, response.status)

      // Handle different response status codes
      if (!response.ok) {
        let errorData: any = {}
        let errorMessage = `API error (${response.status}): ${response.statusText}`

        try {
          // Try to parse error response as JSON
          errorData = await response.json()
          errorMessage = errorData.detail || errorData.message || errorMessage
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

        // Validate the data here (handle -1 or null values)
        data = validateApiResponse(data, url)
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
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if this was a timeout
      if (error.name === "AbortError") {
        logger.warn(`API Request timeout: ${method} ${url}`, {
          timeout: options.timeout || API_CONFIG.DEFAULT_TIMEOUT,
          attempt,
        })
        lastError = new Error(`Request timeout after ${options.timeout || API_CONFIG.DEFAULT_TIMEOUT}ms`)
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
        error.name === "AbortError" ||
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
    originalError: lastError,
  }

  throw apiError
}

/**
 * Validates API response data to handle bad values
 * @param data - The data to validate
 * @param url - The URL that was requested (for context in logging)
 * @returns The validated/sanitized data
 */
function validateApiResponse<T>(data: T, url: string): T {
  // Skip validation for null/undefined data or non-object data
  if (!data || typeof data !== "object") {
    return data
  }

  // For array responses
  if (Array.isArray(data)) {
    // For resource lists, validate each resource
    if (url.includes("/search")) {
      return data.map((item) => validateResource(item, url)) as unknown as T
    }
    return data
  }

  // Handle specific endpoints
  if (url.includes("/calls/queue") || url.includes("/calls/next")) {
    // Validate emergency calls
    return validateEmergencyCall(data as any, url) as unknown as T
  }

  return data
}

/**
 * Validates and fixes a resource item (ambulance, police, etc.)
 * @param resource - The resource to validate
 * @param url - The URL for context
 * @returns The validated resource
 */
function validateResource(resource: any, url: string): any {
  if (!resource) return null

  // Copy the resource to avoid mutating the original
  const validatedResource = { ...resource }

  // Ensure quantity is valid (replace negative or null with 0)
  if (
    validatedResource.quantity === undefined ||
    validatedResource.quantity === null ||
    validatedResource.quantity < 0
  ) {
    logger.warn(`Invalid quantity found in resource from ${url}`, {
      resource: JSON.stringify(resource),
      originalQuantity: validatedResource.quantity,
    })
    validatedResource.quantity = 0
  }

  // Ensure latitude/longitude are valid
  if (
    !validatedResource.latitude ||
    !validatedResource.longitude ||
    isNaN(validatedResource.latitude) ||
    isNaN(validatedResource.longitude)
  ) {
    logger.warn(`Invalid coordinates found in resource from ${url}`, {
      resource: JSON.stringify(resource),
    })

    // Default to Romania's center if coordinates are invalid
    validatedResource.latitude = validatedResource.latitude || 45.9443
    validatedResource.longitude = validatedResource.longitude || 25.0094
  }

  return validatedResource
}

/**
 * Validates and fixes an emergency call
 * @param call - The emergency call to validate
 * @param url - The URL for context
 * @returns The validated emergency call
 */
function validateEmergencyCall(call: any, url: string): any {
  if (!call) return null

  // Copy the call to avoid mutating the original
  const validatedCall = { ...call }

  // Ensure requests array exists
  if (!Array.isArray(validatedCall.requests)) {
    logger.warn(`Invalid requests array in emergency call from ${url}`, {
      call: JSON.stringify(call),
    })
    validatedCall.requests = []
  } else {
    // Ensure each request has valid quantity
    validatedCall.requests = validatedCall.requests.map((req) => {
      if (req.Quantity === undefined || req.Quantity === null || req.Quantity < 0) {
        logger.warn(`Invalid quantity in emergency request from ${url}`, {
          request: JSON.stringify(req),
          originalQuantity: req.Quantity,
        })
        return { ...req, Quantity: 0 }
      }
      return req
    })
  }

  // Ensure latitude/longitude are valid
  if (
    !validatedCall.latitude ||
    !validatedCall.longitude ||
    isNaN(validatedCall.latitude) ||
    isNaN(validatedCall.longitude)
  ) {
    logger.warn(`Invalid coordinates found in emergency call from ${url}`, {
      call: JSON.stringify(call),
    })

    // Default to Romania's center if coordinates are invalid
    validatedCall.latitude = validatedCall.latitude || 45.9443
    validatedCall.longitude = validatedCall.longitude || 25.0094
  }

  return validatedCall
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
    const response = await fetch(`${apiUrl}/health`, {
      method: "GET",
      timeout: 5000, // Short timeout for health checks
    })
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
    const response = await apiRequest<EmergencyResource[]>(
      `${API_CONFIG.MAIN_API_URL}/${endpoint}/search`,
      "GET",
      undefined,
      { timeout: 15000 }, // Increased timeout for potentially slow search endpoints
    )

    // Add the type to each resource
    return response.data.map((resource) => ({
      ...resource,
      type,
    }))
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
    return response.data.map((call) => ({
      ...call,
      dispatched:
        call.dispatched ||
        (Object.fromEntries(call.requests.map((req) => [req.Type, 0])) as Record<EmergencyType, number>),
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
        (Object.fromEntries(call.requests.map((req) => [req.Type, 0])) as Record<EmergencyType, number>),
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
): Promise<any> {
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
    // Use a shorter timeout for dispatch to fail fast if the server is unresponsive
    const response = await apiRequest<any>(`${API_CONFIG.MAIN_API_URL}/${endpoint}/dispatch`, "POST", requestBody, {
      timeout: 8000,
    })

    // Verify the response indicates successful dispatch
    if (!response.data || response.data.error) {
      throw new Error(response.data?.error || "Dispatch returned an invalid response")
    }

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
export async function startSimulation(config: SimulationConfig): Promise<any> {
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
    const response = await apiRequest<any>(`${API_CONFIG.AUTO_DISPATCH_API_URL}/simulate`, "POST", requestBody)
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
export async function getSimulationStatus(): Promise<any> {
  try {
    // Use the auto dispatch API URL
    const response = await apiRequest<any>(`${API_CONFIG.AUTO_DISPATCH_API_URL}/simulate/status`)
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
export async function stopSimulation(): Promise<any> {
  try {
    // Use the auto dispatch API URL
    const response = await apiRequest<any>(`${API_CONFIG.AUTO_DISPATCH_API_URL}/simulate/stop`, "POST")
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

/**
 * Dispatches an ambulance to an emergency
 *
 * @param params - Dispatch parameters including source and target locations
 * @returns Promise resolving to the dispatch result
 * @throws ApiError if the request fails
 */
export async function dispatchAmbulance(params: {
  sourceCounty: string
  sourceCity: string
  targetCounty: string
  targetCity: string
  quantity: number
}): Promise<any> {
  return dispatchResource("Medical", params)
}
