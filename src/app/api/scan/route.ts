import { NextResponse } from 'next/server';
import { ScannerService } from '@/lib/scanner';
import { prisma } from '@/lib/database';

export async function POST() {
  try {
    // Check if there's already a running scan
    const runningScan = await prisma.scanHistory.findFirst({
      where: { status: 'RUNNING' },
      orderBy: { startedAt: 'desc' }
    });

    if (runningScan) {
      const timeSinceStart = Date.now() - runningScan.startedAt.getTime();
      const maxScanTime = 10 * 60 * 1000; // 10 minutes max

      // If scan has been running too long, mark it as failed
      if (timeSinceStart > maxScanTime) {
        await prisma.scanHistory.update({
          where: { id: runningScan.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            error: 'Scan timed out'
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          message: 'Scan already in progress',
          scanId: runningScan.id,
          startedAt: runningScan.startedAt.toISOString(),
          timestamp: new Date().toISOString()
        }, { status: 409 });
      }
    }

    // Check if last successful scan was too recent (within 45 minutes)
    const lastSuccessfulScan = await prisma.scanHistory.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' }
    });

    if (lastSuccessfulScan && lastSuccessfulScan.completedAt) {
      const timeSinceLastScan = Date.now() - lastSuccessfulScan.completedAt.getTime();
      const minInterval = 45 * 60 * 1000; // 45 minutes

      if (timeSinceLastScan < minInterval) {
        return NextResponse.json({
          success: false,
          message: 'Last scan was too recent',
          lastScan: lastSuccessfulScan.completedAt.toISOString(),
          timeSinceLastScan: Math.floor(timeSinceLastScan / 1000 / 60) + ' minutes',
          timestamp: new Date().toISOString()
        }, { status: 429 });
      }
    }

    // Create new scan record
    const scanRecord = await prisma.scanHistory.create({
      data: {
        status: 'RUNNING',
        startedAt: new Date()
      }
    });

    console.log(`[${new Date().toISOString()}] Starting sales scan ${scanRecord.id}`);

    const scanner = new ScannerService();
    await scanner.initializeDatabase();

    // Get count of items to scan
    const items = await prisma.item.findMany({ select: { id: true } });
    const itemsCount = items.length;

    await scanner.scanAllItems();

    // Update scan record as completed
    await prisma.scanHistory.update({
      where: { id: scanRecord.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        itemsScanned: itemsCount
      }
    });

    console.log(`[${new Date().toISOString()}] Sales scan ${scanRecord.id} completed successfully`);

    return NextResponse.json({
      success: true,
      message: 'Scan completed successfully',
      scanId: scanRecord.id,
      itemsScanned: itemsCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Scan error:`, error);

    // If we have a scan record, mark it as failed
    if (typeof error === 'object' && error !== null && 'scanId' in error) {
      const errorWithScanId = error as { scanId: string };
      await prisma.scanHistory.update({
        where: { id: errorWithScanId.scanId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Scan failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
