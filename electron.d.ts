// Type definitions for Electron API
interface Window {
  electron: {
    printReceipt: (html: string) => Promise<void>;
  };
}

declare global {
  interface Window {
    electron: {
      printReceipt: (html: string) => Promise<void>;
    };
  }
}

export {}; // This makes the file a module
