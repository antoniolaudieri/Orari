import React from 'react';
import ReactDOM from 'react-dom/client';
// FIX: Changed to a default import to resolve the "no exported member 'App'" error. The App component is likely a default export.
import App from './App.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);