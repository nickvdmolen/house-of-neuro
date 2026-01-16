import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Create the root element and render the App component.  StrictMode
// helps highlight potential problems in an application.
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Only register the service worker in production to avoid dev caching issues.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/service-worker.js')
        .catch((err) =>
          console.error('Service worker registration failed:', err)
        );
    } else {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((reg) => reg.unregister()))
        .catch((err) =>
          console.error('Service worker unregister failed:', err)
        );
    }
  });
}
