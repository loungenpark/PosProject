/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // === 1. FOUNDATION (Slate) ===
        'primary': '#020617',      // Slate-950: "The Void" - Main background.
        'secondary': '#0f172a',    // Slate-900: "The Surface" - Cards, Headers, Panels.
        'border': '#1e293b',       // Slate-800: "The Structure" - Borders and Dividers.
        'input-bg': '#1e293b',     // Slate-800: Inputs fields background.

        // === 2. TYPOGRAPHY (Slate) ===
        'tmain': '#f1f5f9',      // Slate-100: High emphasis (Titles, Values).
        'tsecondary': '#e2e8f0', // Slate-200: Secondary text (Table rows, Subtitles).
        'muted': '#94a3b8',          // Slate-400: Labels, Inactive Icons.
        'tsubtle': '#64748b',    // Slate-500: Timestamps, Placeholders.

        // === 3. SEMANTIC COLORS ===

        // --- Primary Action (Blue) ---
        'highlight': '#2563eb',       // Blue-600: Main Buttons, Active Tabs.
        'highlight-hover': '#1d4ed8', // Blue-700: Hover state.

        // --- Money / Finance (Emerald) ---
        // NEW: Distinct from Success. Use for Prices, Cash, Totals.
        'money': '#34d399',           // Emerald-400: Text color for money.
        'money-icon': '#10b981',      // Emerald-500: Icon color for money.

        // --- Success / Good Status (Green) ---
        'success': '#22c55e',         // Green-500: Good status (e.g. "Saved").
        'success-hover': '#16a34a',   // Green-600.
        'success-bg': 'rgba(34, 197, 94, 0.1)', // Low opacity Green.

        // --- Danger / Critical (Red) ---
        'danger': '#ef4444',          // Red-500: Errors, Void, Delete.
        'danger-hover': '#dc2626',    // Red-600.
        'danger-bg': 'rgba(239, 68, 68, 0.1)',

        // --- Warning / Attention (Amber) ---
        'warning': '#f59e0b',         // Amber-500: Warnings (e.g. "Low Stock", "Bill Printed").
        'warning-hover': '#d97706',   // Amber-600.
        'warning-bg': 'rgba(245, 158, 11, 0.1)',

        // --- Accent / Special Actions (Purple) ---
        'accent': '#c084fc',          // Purple-400: Special actions (e.g. Upload, Transfer).
        'accent-hover': '#a855f7',    // Purple-500.
      },
    },
  },
  plugins: [],
}