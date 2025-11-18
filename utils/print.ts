// C:\Users\loung\PosProject\utils\print.ts
// --- ENHANCED WITH DEBUG LOGGING ---

import React from 'react';
import { createRoot } from 'react-dom/client';

// Enhanced Electron detection with multiple fallbacks and debugging
const isElectron = (): boolean => {
  try {
    // Check for Electron in multiple ways
    const userAgent = navigator.userAgent.toLowerCase();
    const isElectronApp = Boolean(
      // Method 1: Check for Electron's process.versions
      (window as any).process?.versions?.electron || 
      // Method 2: Check for Electron's userAgent
      userAgent.includes(' electron/') ||
      // Method 3: Check for Electron's context
      (window as any).electron !== undefined ||
      // Method 4: Check for Electron's process type
      (window as any).process?.type === 'renderer' ||
      // Method 5: Check for Electron's require
      (window as any).require?.('electron')
    );

    // Debug information
    console.log('[PRINT] Electron environment check:', {
      isElectron: isElectronApp,
      hasElectronObject: !!(window as any).electron,
      userAgent: userAgent,
      processExists: !!(window as any).process,
      processType: (window as any).process?.type,
      processVersions: (window as any).process?.versions,
      canRequireElectron: !!(window as any).require?.('electron'),
      // Additional debug info
      electronKeys: (window as any).electron ? Object.keys((window as any).electron) : 'N/A',
      windowKeys: Object.keys(window).filter(k => k.toLowerCase().includes('electron') || k === 'process')
    });

    return isElectronApp;
  } catch (error) {
    console.error('[PRINT] Error checking Electron environment:', error);
    return false;
  }
};

/**
 * Prints a React component, with silent printing in Electron
 * Falls back to browser printing if not in Electron
 */
export const printComponent = async (component: React.ReactElement): Promise<void> => {
  console.log('[PRINT] Starting print process...');
  
  // Log window object for debugging
  console.log('[PRINT] Window object:', {
    electron: (window as any).electron,
    process: (window as any).process ? 'exists' : 'does not exist',
    require: !!(window as any).require
  });

  // Check for Electron environment
  const electronPrint = isElectron() && (window as any).electron;
  console.log('[PRINT] Using Electron for printing:', !!electronPrint);
  
  // Create a temporary container for the component
  const tempContainer = document.createElement('div');
  tempContainer.style.position = 'fixed';
  tempContainer.style.left = '-9999px';
  document.body.appendChild(tempContainer);
  
  // Render the component to the temporary container
  console.log('[PRINT] Rendering component...');
  const root = createRoot(tempContainer);
  root.render(component);
  
  try {
    // Wait for the component to render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get the HTML content
    const content = tempContainer.innerHTML;
    console.log(`[PRINT] Rendered content length: ${content.length} characters`);
    
    if (electronPrint) {
      console.log('[PRINT] Attempting Electron silent print...');
      try {
        console.log('[PRINT] Sending to Electron main process...');
        const result = await (window as any).electron.printReceipt(content);
        console.log('[PRINT] Electron print successful:', result);
        return;
      } catch (error) {
        console.error('[PRINT] Electron print failed, falling back to browser:', error);
      }
    }
    
    console.log('[PRINT] Using browser fallback printing...');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Please allow popups for printing');
    }

    console.log('[PRINT] Preparing print window...');
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print</title>
          <style>
            @page {
              size: 58mm auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 5px;
              font-family: 'Courier New', monospace;
              font-size: 10pt;
              -webkit-print-color-adjust: exact;
            }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    console.log('[PRINT] Print window ready');

    // Wait for content to load
    await new Promise<void>((resolve) => {
      printWindow.onload = () => {
        console.log('[PRINT] Print window loaded, showing print dialog...');
        printWindow.print();
        printWindow.close();
        resolve();
      };
    });
    
  } catch (error) {
    console.error('[PRINT] Print error:', error);
    throw error;
  } finally {
    // Always clean up
    console.log('[PRINT] Cleaning up...');
    root.unmount();
    document.body.removeChild(tempContainer);
    console.log('[PRINT] Cleanup complete');
  }
};

console.log('[PRINT] Print module initialized');