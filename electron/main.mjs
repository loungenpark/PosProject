// electron/main.mjs
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import isDev from 'electron-is-dev';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow = null;

// Enhanced error dialog with stack trace
function showErrorDialog(title, content, error = null) {
  const message = error ? 
    `${content}\n\n${error.message || 'No error details'}` + 
    (error.stack ? `\n\nStack Trace:\n${error.stack}` : '') : 
    content;
  
  console.error(`[ERROR] ${title}:`, message);
  dialog.showErrorBox(title, message);
}

// Log unhandled exceptions
process.on('uncaughtException', (error) => {
  console.error('[MAIN] Uncaught Exception:', error);
  showErrorDialog('Unhandled Error', 'An unexpected error occurred', error);
});

// Log unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[MAIN] Unhandled Rejection at:', promise, 'reason:', reason);
  showErrorDialog('Unhandled Promise Rejection', 'A promise was rejected but not handled', 
    reason instanceof Error ? reason : new Error(String(reason)));
});

// Enhanced print handler with better error handling and logging
async function handlePrint(html) {
  console.log('[PRINT] Creating print window...');
  
  // Create a hidden browser window for printing
  const printWindow = new BrowserWindow({ 
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: true
    },
    backgroundColor: '#FFFFFF' // White background for printing
  });

  try {
    console.log('[PRINT] Loading print content...');
    
    // Create a complete HTML document with proper encoding and styles
    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Receipt</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
              padding: 0;
            }
            body {
              margin: 0;
              padding: 5mm;
              font-family: 'Courier New', monospace;
              font-size: 10pt;
              line-height: 1.2;
              -webkit-print-color-adjust: exact;
              color: #000;
              background: #fff;
            }
            @media print {
              body {
                padding: 0;
                margin: 0;
              }
            }
          </style>
        </head>
        <body onload="window.print();window.close()">
          ${html}
        </body>
      </html>
    `;

    // Load the HTML content
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(printHtml)}`);
    
    console.log('[PRINT] Content loaded, waiting for rendering...');

    // Wait for content to be fully rendered
    await new Promise((resolve) => {
      printWindow.webContents.on('did-finish-load', () => {
        console.log('[PRINT] Content rendered, preparing to print...');
        resolve();
      });
    });

    // Small delay to ensure all resources are loaded
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('[PRINT] Starting print job...');
    
    // Print options
    const printOptions = {
      silent: true,                // Don't show print dialog
      printBackground: true,       // Print background colors and images
      color: true,                // Print in color
      margin: {
        marginType: 'printableArea' // Use the system's default margins
      },
      landscape: false,            // Portrait mode
      pagesPerSheet: 1,           // One page per sheet
      collate: false,             // Don't collate
      copies: 1,                  // Number of copies
      header: '',                 // No header
      footer: ''                  // No footer
    };

    // Get list of available printers
    const printers = printWindow.webContents.getPrinters();
    console.log('[PRINT] Available printers:', printers.map(p => p.name));
    
    // Try to find a suitable printer
    const defaultPrinter = printers.find(p => p.isDefault) || printers[0];
    if (defaultPrinter) {
      printOptions.deviceName = defaultPrinter.name;
      console.log(`[PRINT] Using printer: ${defaultPrinter.name}`);
    }

    // Print the window
    const success = await printWindow.webContents.print(printOptions);
    
    if (!success) {
      throw new Error('Print job failed or was cancelled');
    }
    
    console.log('[PRINT] Print job completed successfully');
    return { success: true };

  } catch (error) {
    console.error('[PRINT] Print error:', error);
    throw new Error(`Failed to print: ${error.message}`);
  } finally {
    // Clean up the print window
    if (!printWindow.isDestroyed()) {
      printWindow.destroy();
    }
  }
}

async function createWindow() {
  try {
    console.log('[MAIN] Creating main window...');
    
    // Enhanced web preferences
    const webPreferences = {
      nodeIntegration: false,      // Disable Node.js integration in renderer
      contextIsolation: true,     // Enable context isolation
      preload: path.join(__dirname, 'preload.mjs'),
      webSecurity: true,          // Enable web security
      sandbox: true,              // Enable sandbox for better security
      allowRunningInsecureContent: false, // Don't allow running insecure content
      webviewTag: false,          // Disable webview tag for security
      devTools: isDev,            // Only enable dev tools in development
      nodeIntegrationInWorker: false, // Disable Node.js in workers
      nodeIntegrationInSubFrames: false, // Disable Node.js in iframes
      enableRemoteModule: false,   // Disable remote module for security
      spellcheck: true,           // Enable spell checking
      disableBlinkFeatures: 'Auxclick' // Disable potentially risky features
    };

    console.log('[MAIN] Creating window with webPreferences:', JSON.stringify(webPreferences, null, 2));
    
    // Create the browser window
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      show: false, // Don't show until ready-to-show
      backgroundColor: '#ffffff', // White background to avoid flash of white
      title: 'POS System',
      titleBarStyle: 'hiddenInset', // Better looking title bar
      webPreferences,
      icon: path.join(__dirname, 'assets/icon.png') // Path to your app icon
    });

    const appUrl = isDev 
      ? 'http://localhost:3000' 
      : `file://${path.join(__dirname, '../build/index.html')}`;
    
    console.log(`[MAIN] Loading URL: ${appUrl}`);

    // Show window when page is ready
    mainWindow.once('ready-to-show', () => {
      console.log('[MAIN] Window ready to show');
      mainWindow.show();
      
      // Open DevTools in development mode
      if (isDev) {
        mainWindow.webContents.openDevTools({
          mode: 'detach',
          activate: true
        });
        console.log('[MAIN] DevTools opened');
      }
      
      // Check for updates in production
      if (!isDev) {
        checkForUpdates();
      }
    });

    // Handle navigation
    mainWindow.webContents.on('did-start-loading', () => {
      console.log('[MAIN] Page loading started');
    });

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[MAIN] Page loaded');
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      const errorMsg = `Failed to load: ${validatedURL}\n${errorCode} - ${errorDescription}`;
      console.error(`[MAIN] ${errorMsg}`);
      showErrorDialog('Failed to load the application', errorMsg);
    });

    // Handle renderer process events
    mainWindow.webContents.on('render-process-gone', (event, details) => {
      console.error('[MAIN] Renderer process gone:', details);
      showErrorDialog('Renderer Process Crashed', 'The application has crashed. Please restart the application.');
    });

    mainWindow.webContents.on('unresponsive', () => {
      console.warn('[MAIN] Window became unresponsive');
      const result = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        buttons: ['Reload', 'Close'],
        message: 'Application Not Responding',
        detail: 'The application has become unresponsive. Would you like to reload the page?'
      });
      
      if (result === 0) {
        mainWindow.reload();
      } else {
        mainWindow.close();
      }
    });

    // Handle window closed event
    mainWindow.on('closed', () => {
      console.log('[MAIN] Main window closed');
      mainWindow = null;
    });

    // Handle window resize
    let resizeTimeout;
    mainWindow.on('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const [width, height] = mainWindow.getSize();
        console.log(`[MAIN] Window resized to ${width}x${height}`);
      }, 200);
    });

    // Load the app
    console.log('[MAIN] Loading main window URL...');
    await mainWindow.loadURL(appUrl);
    console.log('[MAIN] Main window loaded successfully');

  } catch (error) {
    console.error('[MAIN] Failed to create window:', error);
    showErrorDialog('Fatal Error', 'Failed to create application window', error);
    
    // Try to recover by creating a new window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
    }
    
    // Try to create window again after a delay
    setTimeout(createWindow, 1000);
  }
}

// Set up IPC handler
ipcMain.handle('print-receipt', (event, html) => {
  console.log('[MAIN] Received print request');
  return handlePrint(html).catch(error => {
    console.error('[MAIN] Error handling print request:', error);
    throw error;
  });
});

// App event handlers
app.whenReady().then(() => {
  console.log('[MAIN] App is ready, creating window...');
  createWindow();
}).catch(error => {
  console.error('[MAIN] Failed to start application:', error);
  showErrorDialog('Fatal Error', 'Failed to start the application');
});

app.on('window-all-closed', () => {
  console.log('[MAIN] All windows closed, quitting...');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('[MAIN] App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    try {
      createWindow();
    } catch (error) {
      console.error('[MAIN] Failed to recreate window:', error);
      showErrorDialog('Window Error', 'Failed to create window');
    }
  }
});

app.on('quit', () => {
  console.log('[MAIN] Application is quitting...');
});

// Log app initialization
console.log('[MAIN] Electron main process started');