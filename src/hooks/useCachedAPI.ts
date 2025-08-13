import { useState, useEffect, useRef } from 'react';

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
  
  const fetchingRef = useRef(false);

  // Create stable cache key
  const cacheKey = `${url}:${JSON.stringify(dependencies)}`;

  useEffect(() => {
    if (!enabled) return;

    const fetchData = async (force = false) => {
      console.log(`fetchData called for ${url}, force: ${force}, fetching: ${fetchingRef.current}, enabled: ${enabled}`);
      
      // Check cache first
      const cachedEntry = globalCache[cacheKey];
      if (!force && cachedEntry && isCacheValid(cachedEntry)) {
        console.log(`Cache hit for ${url}`, cachedEntry.data);
        setData(cachedEntry.data as T);
        setLoading(false);
        setError(null);
        return;
      }

      // Check if there's already a pending request for this URL
      if (cacheKey in globalFetchPromises) {
        console.log(`Request already in progress for ${url}, waiting for result...`);
        try {
          const result = await globalFetchPromises[cacheKey];
          console.log(`Got result from shared request for ${url}:`, result);
          setData(result as T);
          setLoading(false);
          setError(null);
          return;
        } catch (err) {
          console.error(`Shared request failed for ${url}:`, err);
          setError(err instanceof Error ? err.message : 'Network error');
          setLoading(false);
          return;
        }
      }

      console.log(`Cache miss for ${url}, starting fetch...`);
      fetchingRef.current = true;
      setLoading(true);
      setError(null);

      // Create and store the fetch promise
      const fetchPromise = (async () => {
        console.log(`Making fetch request to ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        console.log(`Fetch successful for ${url}:`, result);
        return result;
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

        console.log(`Setting data and cached ${url} until ${new Date(getNextHourTimestamp()).toLocaleTimeString()}`);
        
        setData(result as T);
        setError(null);
        setLoading(false);
      } catch (err) {
        console.error(`Error fetching ${url}:`, err);
        
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

    console.log(`useEffect triggered for ${url}`);
    fetchData();
  }, [url, cacheKey, enabled]);

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
        console.log(`Cache expired for ${url}, refetching...`);
        // Trigger refetch by clearing loading state
        if (!fetchingRef.current) {
          setLoading(true);
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [url, cacheKey, enabled]);

  const refresh = () => {
    if (enabled && !fetchingRef.current) {
      setLoading(true);
    }
  };

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