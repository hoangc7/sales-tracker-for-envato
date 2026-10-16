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

const getValidCacheEntry = (cacheKey: string): CacheEntry<unknown> | undefined => {
  const entry = globalCache[cacheKey];
  return entry && isCacheValid(entry) ? entry : undefined;
};

// Shared by the hook and prefetchAPI so a prefetch in flight is reused, not duplicated.
const fetchIntoCache = (url: string, cacheKey: string): Promise<unknown> => {
  if (cacheKey in globalFetchPromises) return globalFetchPromises[cacheKey];

  const fetchPromise = (async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    globalCache[cacheKey] = {
      data: result,
      timestamp: Date.now(),
      expiresAt: getNextHourTimestamp()
    };
    return result;
  })().finally(() => {
    delete globalFetchPromises[cacheKey];
  });

  globalFetchPromises[cacheKey] = fetchPromise;
  return fetchPromise;
};

const buildCacheKey = (url: string, dependencies: unknown[]) =>
  `${url}:${JSON.stringify(dependencies)}`;

/**
 * Warm the cache for a request the user is likely to make next (e.g. the previous
 * period), so navigating to it renders instantly. Failures are ignored.
 */
export const prefetchAPI = (url: string, dependencies: unknown[] = []) => {
  const cacheKey = buildCacheKey(url, dependencies);
  if (getValidCacheEntry(cacheKey)) return;
  fetchIntoCache(url, cacheKey).catch(() => {});
};

export function useCachedAPI<T>(
  url: string,
  dependencies: unknown[] = [],
  enabled: boolean = true
) {
  // Create stable cache key
  const cacheKey = buildCacheKey(url, dependencies);

  // Seed from the cache so a revisited tab renders immediately instead of flashing a
  // loading state for one frame.
  const [data, setData] = useState<T | null>(
    () => (getValidCacheEntry(cacheKey)?.data as T | undefined) ?? null
  );
  const [loading, setLoading] = useState(() => !getValidCacheEntry(cacheKey));
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Set on cleanup: a response for a key the component has moved past (e.g. the user
    // clicked "Previous" twice quickly) must not overwrite the newer one.
    let cancelled = false;

    const cachedEntry = getValidCacheEntry(cacheKey);
    if (cachedEntry) {
      setData(cachedEntry.data as T);
      setLoading(false);
      setError(null);
      return;
    }

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    fetchIntoCache(url, cacheKey)
      .then(result => {
        if (cancelled) return;
        setData(result as T);
        setError(null);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Network error');
        setData(null);
      })
      .finally(() => {
        fetchingRef.current = false;
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
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
    if (enabled) {
      delete globalCache[cacheKey];
      delete globalFetchPromises[cacheKey];
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