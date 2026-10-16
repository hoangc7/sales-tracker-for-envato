import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Independent queries — run them in parallel instead of six sequential round trips.
    const [recentScans, runningScan, lastSuccessfulScan, statusCounts] = await Promise.all([
      prisma.scanHistory.findMany({
        orderBy: { startedAt: 'desc' },
        take: 10
      }),
      prisma.scanHistory.findFirst({
        where: { status: 'RUNNING' },
        orderBy: { startedAt: 'desc' }
      }),
      prisma.scanHistory.findFirst({
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' }
      }),
      prisma.scanHistory.groupBy({
        by: ['status'],
        _count: { _all: true }
      }),
    ]);

    // Calculate statistics
    const countFor = (status: string) =>
      statusCounts.find(row => row.status === status)?._count._all ?? 0;
    const totalScans = statusCounts.reduce((sum, row) => sum + row._count._all, 0);
    const successfulScans = countFor('COMPLETED');
    const failedScans = countFor('FAILED');

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      currentStatus: {
        isRunning: !!runningScan,
        runningScan: runningScan ? {
          id: runningScan.id,
          startedAt: runningScan.startedAt.toISOString(),
          duration: runningScan.startedAt ?
            Math.floor((Date.now() - runningScan.startedAt.getTime()) / 1000) + ' seconds' :
            'unknown'
        } : null
      },
      lastSuccessfulScan: lastSuccessfulScan ? {
        id: lastSuccessfulScan.id,
        completedAt: lastSuccessfulScan.completedAt?.toISOString(),
        itemsScanned: lastSuccessfulScan.itemsScanned
      } : null,
      statistics: {
        totalScans,
        successfulScans,
        failedScans,
        successRate: totalScans > 0 ? Math.round((successfulScans / totalScans) * 100) : 0
      },
      recentScans: recentScans.map(scan => ({
        id: scan.id,
        status: scan.status,
        startedAt: scan.startedAt.toISOString(),
        completedAt: scan.completedAt?.toISOString(),
        itemsScanned: scan.itemsScanned,
        error: scan.error
      }))
    });
  } catch (error) {
    console.error('Status endpoint error:', error);
    return NextResponse.json({
      status: 'error',
      error: 'Failed to fetch scan status',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
