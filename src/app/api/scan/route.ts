import { NextResponse } from 'next/server';
import { ScannerService } from '@/lib/scanner';

export async function POST() {
  try {
    const scanner = new ScannerService();
    
    await scanner.initializeDatabase();
    await scanner.scanAllItems();
    
    return NextResponse.json({ success: true, message: 'Scan completed successfully' });
  } catch (error) {
    console.error('Scan error:', error);
    return NextResponse.json({ success: false, error: 'Scan failed' }, { status: 500 });
  }
}