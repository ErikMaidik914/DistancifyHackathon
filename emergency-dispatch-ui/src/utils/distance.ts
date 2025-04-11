export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Simple linear distance calculation
    const dx = lat2 - lat1
    const dy = lon2 - lon1
    return Math.sqrt(dx * dx + dy * dy)
  }
  