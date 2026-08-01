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

// Older versions cached index.html indefinitely. That can leave the HTML
// pointing at bundles removed by a later deployment and results in a blank
// page. The application does not require offline support, so remove any old
// registration and its app-specific caches instead of risking stale releases.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      )
      .catch((err) => console.error('Service worker cleanup failed:', err));

    if ('caches' in window) {
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter((name) => name.startsWith('house-of-neuro-cache-'))
              .map((name) => caches.delete(name))
          )
        )
        .catch((err) => console.error('App cache cleanup failed:', err));
    }
  });
}
