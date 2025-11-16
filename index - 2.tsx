import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PosProvider } from './context/PosContext';
import './index.css'; // This line loads all your styles, including the print fixes.

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