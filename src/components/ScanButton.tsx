'use client';

import { useState } from 'react';

interface ScanButtonProps {
  onScanComplete: () => void;
}

export function ScanButton({ onScanComplete }: ScanButtonProps) {
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = async () => {
    setIsScanning(true);
    
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (result.success) {
        onScanComplete();
        alert('Scan completed successfully!');
      } else {
        alert('Scan failed: ' + result.error);
      }
    } catch (error) {
      alert('Scan failed: ' + error);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <button
      onClick={handleScan}
      disabled={isScanning}
      className={`px-6 py-2 rounded-lg font-medium transition-colors ${
        isScanning
          ? 'bg-gray-400 text-white cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-700 text-white'
      }`}
    >
      {isScanning ? 'Scanning...' : 'Run Scan'}
    </button>
  );
}