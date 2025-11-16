// C:\Users\loung\PosProject\utils\print.ts
// --- FINAL VERSION: UPDATED FOR REACT 18 ---

import React from 'react';
import { createRoot } from 'react-dom/client'; // ✅ 1. Import createRoot from the new package

export const printComponent = (component: React.ReactElement): void => {
  const printWindow = window.open('', '', 'height=600,width=800');

  if (printWindow) {
    printWindow.document.write('<html><head><title>Print</title>');

    // Copy all stylesheets from the main app to the new window
    // This is crucial for Tailwind CSS to apply styles during printing
    const styles = document.querySelectorAll('link[rel="stylesheet"], style');
    styles.forEach(style => {
      printWindow.document.write(style.outerHTML);
    });

    printWindow.document.write('</head><body></body></html>');
    printWindow.document.close();

    // Create a div to mount our React component
    const printRootDiv = printWindow.document.createElement('div');
    printWindow.document.body.appendChild(printRootDiv);

    // ✅ 2. Use the modern createRoot API
    const root = createRoot(printRootDiv);

    // ✅ 3. Render the component using the new root.render method
    root.render(component);

    // Use a timeout to ensure the component is fully rendered before printing
    setTimeout(() => {
      printWindow.focus(); // Focus the new window
      printWindow.print(); // Trigger the print dialog
      printWindow.close(); // Close the window after printing
    }, 250); // A shorter delay is often sufficient with the new API

  } else {
    alert('Ju lutemi aktivizoni "pop-ups" për printim.');
  }
};