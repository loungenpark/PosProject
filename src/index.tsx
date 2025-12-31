import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App';
import { PosProvider } from './context/PosContext';
import './i18n'; // LEFT: Initialize i18n configuration
import './index.css'; // This line loads all your styles, including the print fixes.

// Initialize Sentry
Sentry.init({
  dsn: "https://d192e2455da714f34715a671cb37eb55@o4510437496913921.ingest.de.sentry.io/4510441944842320",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <PosProvider>
      <App />
    </PosProvider>
  </React.StrictMode>
);