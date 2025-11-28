// server/instrument.js
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node"; // <--- ADD THIS IMPORT

Sentry.init({
    dsn: "https://3c4b815cdb084f3494c311b054ef4a1d@o4510437496913921.ingest.de.sentry.io/4510437517426768", // <--- PASTE YOUR DSN KEY HERE
  integrations: [
    nodeProfilingIntegration(), // <--- CHANGE THIS (Remove "Sentry.")
  ],
  
  // Performance Monitoring
  tracesSampleRate: 1.0, 
  
  // Set sampling rate for profiling
  profilesSampleRate: 1.0,
});