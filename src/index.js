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
