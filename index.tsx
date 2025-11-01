import React from 'react';
import ReactDOM from 'react-dom/client';
// FIX: Changed to a named import to resolve the "no default export" error. The App component is likely a named export.
import { App } from './App.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);