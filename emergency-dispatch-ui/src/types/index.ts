/**
 * Core type definitions for the Emergency Dispatch System
 */

// Emergency types supported by the system
export type EmergencyType = "Medical" | "Police" | "Fire" | "Rescue" | "Utility"

// Color mapping for emergency types (for visualization)
export const EMERGENCY_TYPE_COLORS: Record<EmergencyType, string> = {
  Medical: "#ef4444", // Red
  Police: "#3b82f6", // Blue
  Fire: "#f97316", // Orange
  Rescue: "#eab308", // Yellow
  Utility: "#10b981", // Green
}

// Icon mapping for emergency types
export const EMERGENCY_TYPE_ICONS: Record<EmergencyType, string> = {
  Medical: "ambulance",
  Police: "shield",
  Fire: "flame",
  Rescue: "life-buoy",
  Utility: "tool",
}

export interface Location {
  name: string
  county: string
  lat: number
  long: number
}

export interface EmergencyRequest {
  Type: EmergencyType
  Quantity: number
}

export interface EmergencyCall {
  city: string
  county: string
  latitude: number
  longitude: number
  requests: EmergencyRequest[]
  dispatched?: Record<EmergencyType, number> // Track dispatched by type
}

export interface EmergencyResource {
  county: string
  city: string
  latitude: number
  longitude: number
  quantity: number
  type: EmergencyType // Added type field
}

// Alias for backward compatibility
export type AmbulanceLocation = EmergencyResource

export interface ControlStatus {
  status: string
  runningTime: string
  seed: string
  requestCount: number
  maxActiveCalls: number
  totalDispatches: number
  targetDispatches: number
  distance: number
  penalty: number
  httpRequests: number
  emulatorVersion: number
  signature: string
  checksum: string
  errors: {
    missed: number
    overDispatched: number
  }
}

export interface SimulationConfig {
  api_url: string
  seed: string
  targetDispatches: number
  maxActiveCalls: number
  poll_interval: number
  status_interval: number
}

// Updated DispatchRequest interface to match the API expectations
export interface DispatchRequest {
  sourceCounty: string
  sourceCity: string
  targetCounty: string
  targetCity: string
  quantity: number
}

// New interface for tracking emergency status
export interface EmergencyStatus {
  total: number
  dispatched: number
  remaining: number
}

/**
 * Enhanced API error interface for better error handling
 */
export interface ApiError extends Error {
  url: string
  method: string
  retries: number
  originalError?: Error
}

/**
 * Generic API response interface
 */
export interface ApiResponse<T> {
  data: T
  status: number
  headers: Headers
  responseTime: number
}

/**
 * Health status interface for API health checks
 */
export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy"
  responseTime: number
  message: string
  lastChecked: string
}

/**
 * System status interface for overall system health
 */
export interface SystemStatus {
  mainApi: HealthStatus
  autoDispatchApi: HealthStatus
  lastUpdated: string
}

/**
 * Emergency resource availability by type
 */
export interface ResourceAvailability {
  type: EmergencyType
  available: number
  total: number
  locations: number
}

/**
 * Emergency statistics
 */
export interface EmergencyStats {
  totalCalls: number
  totalRequests: Record<EmergencyType, number>
  pendingRequests: Record<EmergencyType, number>
  dispatchedRequests: Record<EmergencyType, number>
}
