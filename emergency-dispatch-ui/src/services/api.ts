import type {
    AmbulanceLocation,
    ControlStatus,
    EmergencyCall,
    Location,
    SimulationConfig,
  } from "@/types"
  
  const API_BASE_URL = "http://localhost:5000"
  const AUTO_API_BASE_URL = "http://localhost:8000" // Assuming the FastAPI server is on port 8000
  
  export async function fetchLocations(): Promise<Location[]> {
    const response = await fetch(`${API_BASE_URL}/locations`)
    return response.json()
  }
  
  export async function fetchAvailableAmbulances(): Promise<AmbulanceLocation[]> {
    const response = await fetch(`${API_BASE_URL}/medical/search`)
    return response.json()
  }
  
  export async function fetchAmbulancesByCity(county: string, city: string): Promise<number> {
    const response = await fetch(`${API_BASE_URL}/medical/searchbycity?county=${encodeURIComponent(county)}&city=${encodeURIComponent(city)}`)
    return response.json()
  }
  
  export async function fetchEmergencyCalls(): Promise<EmergencyCall[]> {
    const response = await fetch(`${API_BASE_URL}/calls/queue`)
    return response.json()
  }
  
  export async function fetchNextEmergency(): Promise<EmergencyCall> {
    const response = await fetch(`${API_BASE_URL}/calls/next`)
    return response.json()
  }
  
  export async function fetchControlStatus(): Promise<ControlStatus> {
    const response = await fetch(`${API_BASE_URL}/control/status`)
    return response.json()
  }
  
  export async function resetControl(
    seed = "default",
    targetDispatches = 10000,
    maxActiveCalls = 100,
  ): Promise<ControlStatus> {
    const response = await fetch(
      `${API_BASE_URL}/control/reset?seed=${seed}&targetDispatches=${targetDispatches}&maxActiveCalls=${maxActiveCalls}`,
    )
    return response.json()
  }
  
  export async function stopControl(): Promise<ControlStatus> {
    const response = await fetch(`${API_BASE_URL}/control/stop`)
    return response.json()
  }
  
  export async function dispatchAmbulance(request: {
    sourceCounty: string;
    sourceCity: string;
    targetCounty: string;
    targetCity: string;
    quantity: number;
  }): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/medical/dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    })
    return response.text()
  }
  
  // Auto-dispatch API endpoints
  export async function startSimulation(config: SimulationConfig): Promise<unknown> {
    const response = await fetch(`${AUTO_API_BASE_URL}/simulate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    })
    return response.json()
  }
  
  export async function stopSimulation(): Promise<unknown> {
    const response = await fetch(`${AUTO_API_BASE_URL}/simulate/stop`, {
      method: "POST",
    })
    return response.json()
  }
  
  export async function getSimulationStatus(): Promise<unknown> {
    const response = await fetch(`${AUTO_API_BASE_URL}/simulate/status`)
    return response.json()
  }
  
  export async function checkHealth(): Promise<unknown> {
    const response = await fetch(`${AUTO_API_BASE_URL}/health`)
    return response.json()
  }