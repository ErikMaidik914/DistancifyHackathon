/**
 * Resource Cache Utility
 *
 * Provides a client-side cache for emergency resources and calls
 * to maintain continuity when API calls fail
 */

import { logger } from "@/components/logger"
import type { EmergencyCall, EmergencyResource } from "@/types"

// Cache keys
const CACHE_KEYS = {
  RESOURCES: "emercery_cached_resources",
  EMERGENCIES: "emercery_cached_emergencies",
  TIMESTAMP: "emercery_cache_timestamp",
}

// Cache expiration time (10 minutes)
const CACHE_EXPIRATION = 10 * 60 * 1000

/**
 * ResourceCache utility for maintaining state through API failures
 */
export const ResourceCache = {
  /**
   * Save resources to cache
   */
  saveResources(resources: EmergencyResource[]): void {
    try {
      localStorage.setItem(CACHE_KEYS.RESOURCES, JSON.stringify(resources))
      localStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString())
      logger.debug("Resources cached", { count: resources.length })
    } catch (error) {
      logger.error("Failed to cache resources", { error })
    }
  },

  /**
   * Get resources from cache
   * Returns null if cache is expired or empty
   */
  getResources(): EmergencyResource[] | null {
    try {
      // Check if cache exists and is not expired
      const timestamp = localStorage.getItem(CACHE_KEYS.TIMESTAMP)
      if (!timestamp) return null

      const cacheAge = Date.now() - Number.parseInt(timestamp)
      if (cacheAge > CACHE_EXPIRATION) {
        logger.debug("Resources cache expired", { cacheAge })
        return null
      }

      const cachedData = localStorage.getItem(CACHE_KEYS.RESOURCES)
      if (!cachedData) return null

      const resources = JSON.parse(cachedData) as EmergencyResource[]
      logger.debug("Resources loaded from cache", { count: resources.length, cacheAge })

      return resources
    } catch (error) {
      logger.error("Failed to get resources from cache", { error })
      return null
    }
  },

  /**
   * Save emergencies to cache
   */
  saveEmergencies(emergencies: EmergencyCall[]): void {
    try {
      localStorage.setItem(CACHE_KEYS.EMERGENCIES, JSON.stringify(emergencies))
      localStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString())
      logger.debug("Emergencies cached", { count: emergencies.length })
    } catch (error) {
      logger.error("Failed to cache emergencies", { error })
    }
  },

  /**
   * Get emergencies from cache
   * Returns null if cache is expired or empty
   */
  getEmergencies(): EmergencyCall[] | null {
    try {
      // Check if cache exists and is not expired
      const timestamp = localStorage.getItem(CACHE_KEYS.TIMESTAMP)
      if (!timestamp) return null

      const cacheAge = Date.now() - Number.parseInt(timestamp)
      if (cacheAge > CACHE_EXPIRATION) {
        logger.debug("Emergencies cache expired", { cacheAge })
        return null
      }

      const cachedData = localStorage.getItem(CACHE_KEYS.EMERGENCIES)
      if (!cachedData) return null

      const emergencies = JSON.parse(cachedData) as EmergencyCall[]
      logger.debug("Emergencies loaded from cache", { count: emergencies.length, cacheAge })

      return emergencies
    } catch (error) {
      logger.error("Failed to get emergencies from cache", { error })
      return null
    }
  },

  /**
   * Clear all cached data
   */
  clearCache(): void {
    try {
      localStorage.removeItem(CACHE_KEYS.RESOURCES)
      localStorage.removeItem(CACHE_KEYS.EMERGENCIES)
      localStorage.removeItem(CACHE_KEYS.TIMESTAMP)
      logger.debug("Cache cleared")
    } catch (error) {
      logger.error("Failed to clear cache", { error })
    }
  },

  /**
   * Update a specific resource in the cache
   * Useful after a dispatch to maintain consistency
   */
  updateResourceInCache(updatedResource: EmergencyResource): void {
    try {
      const resources = this.getResources()
      if (!resources) return

      // Find and update the resource
      const index = resources.findIndex(
        (r) =>
          r.city === updatedResource.city && r.county === updatedResource.county && r.type === updatedResource.type,
      )

      if (index !== -1) {
        resources[index] = updatedResource
        this.saveResources(resources)
        logger.debug("Resource updated in cache", {
          resource: `${updatedResource.city}, ${updatedResource.county}`,
          type: updatedResource.type,
        })
      }
    } catch (error) {
      logger.error("Failed to update resource in cache", { error })
    }
  },

  /**
   * Update a specific emergency in the cache
   * Useful after a dispatch to maintain consistency
   */
  updateEmergencyInCache(updatedEmergency: EmergencyCall): void {
    try {
      const emergencies = this.getEmergencies()
      if (!emergencies) return

      // Find and update the emergency
      const index = emergencies.findIndex(
        (e) => e.city === updatedEmergency.city && e.county === updatedEmergency.county,
      )

      if (index !== -1) {
        emergencies[index] = updatedEmergency
        this.saveEmergencies(emergencies)
        logger.debug("Emergency updated in cache", {
          emergency: `${updatedEmergency.city}, ${updatedEmergency.county}`,
        })
      }
    } catch (error) {
      logger.error("Failed to update emergency in cache", { error })
    }
  },
}
