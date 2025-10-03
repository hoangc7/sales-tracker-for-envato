-- Performance Optimization: Add Indexes to SalesRecord table
-- This migration adds indexes to improve query performance for analytics

-- Composite index for itemId + scannedAt queries
-- This index is used when filtering by itemId and sorting by scannedAt
CREATE INDEX IF NOT EXISTS "sales_records_itemId_scannedAt_idx" 
ON "sales_records" ("itemId", "scannedAt" DESC);

-- Index for scannedAt queries
-- This index is used for time-range queries across all items
CREATE INDEX IF NOT EXISTS "sales_records_scannedAt_idx" 
ON "sales_records" ("scannedAt" DESC);

-- Verify the indexes were created
-- You can run this to confirm:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'sales_records';

