import { NextResponse } from 'next/server';
import { ScannerService } from '@/lib/scanner';
import { prisma } from '@/lib/database';

export async function POST() {
  // Tracked outside the try so a failure mid-scan can mark this run FAILED instead of
  // leaving it RUNNING (which blocks every scan for the next 10 minutes).
  let scanId: string | null = null;

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

    // Prune scan history older than 30 days to keep the table small
    const retentionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Create new scan record
    const [, scanRecord] = await Promise.all([
      prisma.scanHistory.deleteMany({
        where: { startedAt: { lt: retentionCutoff } }
      }),
      prisma.scanHistory.create({
        data: {
          status: 'RUNNING',
          startedAt: new Date()
        }
      }),
    ]);
    scanId = scanRecord.id;

    console.log(`[${new Date().toISOString()}] Starting sales scan ${scanRecord.id}`);

    const scanner = new ScannerService();
    await scanner.initializeDatabase();

    const result = await scanner.scanAllItems();
    // A scan where every item failed (e.g. Envato API down) is a failed scan, not a success.
    const allFailed = result.total > 0 && result.successful === 0;
    const errorSummary = result.errors.length > 0 ? result.errors.join('; ').slice(0, 1000) : null;

    await prisma.scanHistory.update({
      where: { id: scanRecord.id },
      data: {
        status: allFailed ? 'FAILED' : 'COMPLETED',
        completedAt: new Date(),
        itemsScanned: result.successful,
        error: errorSummary
      }
    });

    console.log(`[${new Date().toISOString()}] Sales scan ${scanRecord.id} finished: ${result.successful}/${result.total} items`);

    return NextResponse.json({
      success: !allFailed,
      message: allFailed
        ? 'Scan failed for every item'
        : result.failed > 0
          ? `Scan completed with ${result.failed} failed item(s)`
          : 'Scan completed successfully',
      scanId: scanRecord.id,
      itemsScanned: result.successful,
      itemsFailed: result.failed,
      ...(allFailed && { error: errorSummary }),
      timestamp: new Date().toISOString()
    }, { status: allFailed ? 502 : 200 });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Scan error:`, error);

    // If we have a scan record, mark it as failed
    if (scanId) {
      await prisma.scanHistory.update({
        where: { id: scanId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }).catch(updateError => console.error('Failed to mark scan as failed:', updateError));
    }

    return NextResponse.json({
      success: false,
      error: 'Scan failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
