/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // === 1. FOUNDATION & LAYOUT ===
        // Used for the main backgrounds, panels, and dividers.
        'primary': '#1a202c',      // ~slate-900: The main, darkest background for the page.
        'secondary': '#2d3748',    // ~slate-800: For cards, panels, headers, and modal backgrounds.
        'border': '#4a5568',       // ~slate-600: NOTE: Renamed from 'accent'. Used for subtle borders and dividers.

        // === 2. TYPOGRAPHY ===
        // A consistent hierarchy for all text elements.
        'tmain': '#e2e8f0',      // ~slate-200: For high-emphasis text (titles, primary data).
        'tsecondary': '#a0aec0', // ~slate-400: For secondary text (descriptions, less important labels).
        'muted': '#6b7280',          // ~gray-500: For disabled text and inactive icons.
        'tsubtle': '#94a3b8',   // ~slate-500: NEW: For very low-emphasis text like timestamps or placeholders.

        // === 3. SEMANTIC & FUNCTIONAL COLORS ===
        // These colors have specific meanings and are used for interactive elements.

        // --- Primary Action (Blue) ---
        'highlight': '#4299e1',       // ~blue-400: The main color for primary buttons (e.g., "Pay", "Login").
        'highlight-hover': '#2563eb', // ~blue-600: A darker shade for hover states.

        // --- Success (Green) ---
        'success': '#16a34a',         // ~green-600: For success states, financial totals, "Paid" status.
        'success-hover': '#15803d',   // ~green-700: Darker green for hover.
        'success-bg': 'rgba(22, 163, 74, 0.1)', // NEW: Low-opacity background for highlighting rows/badges.

        // --- Danger (Red) ---
        'danger': '#f87171',          // ~red-400: For errors, voiding items, and critical alerts.
        'danger-hover': '#ef4444',    // CORRECTED: Was '#fca5a5' (a lighter red). Now a darker red (~red-500) for better UI feedback.
        'danger-bg': 'rgba(239, 68, 68, 0.1)',  // NEW: Low-opacity background.

        // --- Warning (Yellow) ---
        'warning': '#eab308',         // ~yellow-500: For warnings or states that need attention (e.g., "Bill Printed").
        'warning-hover': '#ca8a04',   // ~yellow-600: Darker yellow for hover.
        'warning-bg': 'rgba(234, 179, 8, 0.1)', // NEW: Low-opacity background.

        // --- Accent / Special Actions (Purple) ---
        'accent': '#a855f7',          // NEW: A distinct purple (~purple-500) for special UI elements like 'Upload Menu'.
        'accent-hover': '#9333ea',    // NEW: Darker purple for hover.
      },
    },
  },
  plugins: [],
}