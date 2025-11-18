// electron/preload.mjs
import { contextBridge, ipcRenderer } from 'electron';

// Log that preload script is running
console.log('[PRELOAD] Preload script running');
console.log('[PRELOAD] Process versions:', process.versions);
console.log('[PRELOAD] Electron version:', process.versions.electron);
console.log('[PRELOAD] Node version:', process.versions.node);
console.log('[PRELOAD] Chrome version:', process.versions.chrome);

// Log all available IPC channels
console.log('[PRELOAD] Available IPC channels:', ipcRenderer.eventNames());

// Helper function to safely expose IPC methods
function createIpcHandler(channel) {
  return async (...args) => {
    console.log(`[PRELOAD] Sending IPC: ${channel}`, args);
    try {
      const result = await ipcRenderer.invoke(channel, ...args);
      console.log(`[PRELOAD] IPC ${channel} success`);
      return result;
    } catch (error) {
      console.error(`[PRELOAD] IPC ${channel} error:`, error);
      throw error;
    }
  };
}

// API object to expose to the renderer
const electronAPI = {
  // Test method to verify the bridge is working
  testConnection: () => {
    console.log('[PRELOAD] Test connection called from renderer');
    return 'Connection successful!';
  },
  
  // Print functionality
  printReceipt: createIpcHandler('print-receipt'),
  
  // Add more IPC methods here as needed
  // exampleMethod: createIpcHandler('example-method')
};

// Expose the API to the renderer process
console.log('[PRELOAD] Exposing electron API to renderer');
try {
  contextBridge.exposeInMainWorld('electron', electronAPI);
  console.log('[PRELOAD] Context bridge setup complete');
} catch (error) {
  console.error('[PRELOAD] Failed to expose electron API via contextBridge:', error);
  
  // Fallback for debugging
  if (process.env.NODE_ENV === 'development') {
    console.warn('[PRELOAD] Falling back to direct window.electron assignment');
    window.electron = electronAPI;
  }
}

// For debugging in development
if (process.env.NODE_ENV === 'development') {
  // Make sure window.electron is always available in development
  window.electron = window.electron || electronAPI;
  
  // Add a global function to test the bridge
  window.testElectronBridge = () => {
    console.log('[PRELOAD] Testing Electron bridge...');
    if (window.electron) {
      console.log('[PRELOAD] Electron API is available:', Object.keys(window.electron));
      if (window.electron.testConnection) {
        window.electron.testConnection()
          .then(result => console.log('[PRELOAD] Test connection successful:', result))
          .catch(err => console.error('[PRELOAD] Test connection failed:', err));
      }
    } else {
      console.error('[PRELOAD] Electron API is not available on window.electron');
    }
  };
  
  console.log('[PRELOAD] Development mode: Added testElectronBridge() to window');
}

// Add error listeners
process.on('uncaughtException', (error) => {
  console.error('[PRELOAD] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[PRELOAD] Unhandled rejection at:', promise, 'reason:', reason);
});

// Log when the preload script has finished initializing
console.log('[PRELOAD] Preload script initialized successfully');

// Send a message to the main process to confirm preload script loaded
ipcRenderer.send('preload-loaded');