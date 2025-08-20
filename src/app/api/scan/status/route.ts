import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET() {
  try {
    // Get recent scan history
    const recentScans = await prisma.scanHistory.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10
    });

    // Get current status
    const runningScan = await prisma.scanHistory.findFirst({
      where: { status: 'RUNNING' },
      orderBy: { startedAt: 'desc' }
    });

    const lastSuccessfulScan = await prisma.scanHistory.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' }
    });

    // Calculate statistics
    const totalScans = await prisma.scanHistory.count();
    const successfulScans = await prisma.scanHistory.count({
      where: { status: 'COMPLETED' }
    });
    const failedScans = await prisma.scanHistory.count({
      where: { status: 'FAILED' }
    });

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
