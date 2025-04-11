export interface Location {
    name: string
    county: string
    lat: number
    long: number
  }
  
  export interface AmbulanceLocation {
    county: string
    city: string
    latitude: number
    longitude: number
    quantity: number
  }
  
  export interface EmergencyCall {
    city: string
    county: string
    latitude: number
    longitude: number
    requests: { Quantity: number }[]
    dispatched?: number // Track how many ambulances have been dispatched to this emergency
  }
  
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
    seed: string
    targetDispatches: number
    maxActiveCalls: number
    poll_interval: number
    status_interval: number
  }
  
  // Update the DispatchRequest interface to match the API expectations
  export interface DispatchRequest {
    from: string
    to: string
    quantity: number
  }
  
  // New interface for tracking emergency status
  export interface EmergencyStatus {
    total: number
    dispatched: number
    remaining: number
  }
  