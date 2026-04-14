import { useState, useEffect, useRef, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheStore {
  [key: string]: CacheEntry<unknown>;
}

// Global cache store
const globalCache: CacheStore = {};

// Global fetch promises to prevent duplicate requests
const globalFetchPromises: { [key: string]: Promise<unknown> } = {};

// Get next hour timestamp (next :00 minute)
const getNextHourTimestamp = (): number => {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  return nextHour.getTime();
};

// Check if cache entry is still valid
const isCacheValid = (entry: CacheEntry<unknown>): boolean => {
  return Date.now() < entry.expiresAt;
};

export function useCachedAPI<T>(
  url: string,
  dependencies: unknown[] = [],
  enabled: boolean = true
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const fetchingRef = useRef(false);

  // Create stable cache key
  const cacheKey = `${url}:${JSON.stringify(dependencies)}`;

  useEffect(() => {
    if (!enabled) return;

    const fetchData = async () => {
      // Check cache first
      const cachedEntry = globalCache[cacheKey];
      if (cachedEntry && isCacheValid(cachedEntry)) {
        setData(cachedEntry.data as T);
        setLoading(false);
        setError(null);
        return;
      }

      // Check if there's already a pending request for this URL
      if (cacheKey in globalFetchPromises) {
        try {
          const result = await globalFetchPromises[cacheKey];
          setData(result as T);
          setLoading(false);
          setError(null);
          return;
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Network error');
          setLoading(false);
          return;
        }
      }

      fetchingRef.current = true;
      setLoading(true);
      setError(null);

      // Create and store the fetch promise
      const fetchPromise = (async () => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      })();

      globalFetchPromises[cacheKey] = fetchPromise;

      try {
        const result = await fetchPromise;

        // Cache the result immediately
        globalCache[cacheKey] = {
          data: result,
          timestamp: Date.now(),
          expiresAt: getNextHourTimestamp()
        };

        setData(result as T);
        setError(null);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');

        // Keep showing cached data if available
        if (!cachedEntry) {
          setData(null);
        }
        setLoading(false);
      } finally {
        // Clean up the promise and reset fetch state
        delete globalFetchPromises[cacheKey];
        fetchingRef.current = false;
      }
    };

    fetchData();
  }, [url, cacheKey, enabled, fetchTrigger]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      fetchingRef.current = false;
    };
  }, []);

  // Check for cache expiration every minute
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const cachedEntry = globalCache[cacheKey];
      if (cachedEntry && !isCacheValid(cachedEntry)) {
        // Delete expired cache entry and trigger a refetch
        delete globalCache[cacheKey];
        if (!fetchingRef.current) {
          setFetchTrigger(prev => prev + 1);
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [url, cacheKey, enabled]);

  const refresh = useCallback(() => {
    if (enabled && !fetchingRef.current) {
      // Delete cache entry to force a fresh fetch
      delete globalCache[cacheKey];
      setFetchTrigger(prev => prev + 1);
    }
  }, [enabled, cacheKey]);

  return {
    data,
    loading,
    error,
    refresh,
    isCached: () => {
      const cachedEntry = globalCache[cacheKey];
      return cachedEntry && isCacheValid(cachedEntry);
    }
  };
}

// Utility functions
export const clearAPICache = () => {
  Object.keys(globalCache).forEach(key => {
    delete globalCache[key];
  });
  Object.keys(globalFetchPromises).forEach(key => {
    delete globalFetchPromises[key];
  });
  console.log('API cache and pending requests cleared');
};

export const clearCacheForURL = (urlPattern: string) => {
  Object.keys(globalCache).forEach(key => {
    if (key.includes(urlPattern)) {
      delete globalCache[key];
    }
  });
  Object.keys(globalFetchPromises).forEach(key => {
    if (key.includes(urlPattern)) {
      delete globalFetchPromises[key];
    }
  });
  console.log(`Cache and pending requests cleared for pattern: ${urlPattern}`);
};