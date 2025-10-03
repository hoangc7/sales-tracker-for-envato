import { unstable_cache } from 'next/cache';

// Cache configuration
export const CACHE_TAGS = {
  DAILY_ANALYTICS: 'daily-analytics',
  WEEKLY_ANALYTICS: 'weekly-analytics',
  MONTHLY_ANALYTICS: 'monthly-analytics',
  DATA_RANGE: 'data-range',
} as const;

// Cache revalidation times (in seconds)
export const CACHE_REVALIDATION = {
  // Analytics data changes hourly, so cache for 1 hour
  ANALYTICS: 60 * 60, // 1 hour
  // Data range changes less frequently
  DATA_RANGE: 60 * 60 * 24, // 24 hours
} as const;

/**
 * Create a cached version of a function with Next.js unstable_cache
 * @param fn Function to cache
 * @param keyParts Parts to build the cache key
 * @param tags Cache tags for invalidation
 * @param revalidate Revalidation time in seconds
 */
export function createCachedFunction<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  keyParts: string[],
  tags: string[],
  revalidate: number
): T {
  return unstable_cache(fn, keyParts, {
    tags,
    revalidate,
  }) as T;
}

