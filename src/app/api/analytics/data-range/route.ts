import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';

// Cache for data range - since this rarely changes, we can cache it for 24 hours
let cachedDataRange: { oldestDate: Date; newestDate: Date } | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'oldest'; // 'oldest' or 'newest'

    const now = Date.now();

    // Check if we have a valid cached result
    if (cachedDataRange && (now - cacheTimestamp) < CACHE_DURATION) {
      const response = buildResponse(cachedDataRange, type, true);
      return NextResponse.json(response);
    }

    const db = new DatabaseService();

    // Get the oldest and newest sale records
    const [oldestRecord, newestRecord] = await Promise.all([
      db.getOldestSaleRecord(),
      db.getNewestSaleRecord()
    ]);

    if (!oldestRecord || !newestRecord) {
      return NextResponse.json({
        type,
        data: null,
        cached: false
      });
    }

    // Update cache
    cachedDataRange = {
      oldestDate: oldestRecord.scannedAt,
      newestDate: newestRecord.scannedAt
    };
    cacheTimestamp = now;

    const response = buildResponse(cachedDataRange, type, false);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Data range API error:', error);
    return NextResponse.json({ error: 'Failed to fetch data range' }, { status: 500 });
  }
}

function buildResponse(dataRange: { oldestDate: Date; newestDate: Date }, type: string, cached: boolean) {
  switch (type) {
    case 'newest':
      return {
        type: 'newest',
        newestDate: dataRange.newestDate.toISOString(),
        cached
      };
    case 'oldest':
    default:
      return {
        type: 'oldest',
        oldestDate: dataRange.oldestDate.toISOString(),
        cached
      };
  }
}
