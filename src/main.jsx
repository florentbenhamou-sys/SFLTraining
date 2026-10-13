import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-condensed/latin-400.css';
import '@fontsource/barlow-condensed/latin-600.css';
import './industry.css';
import './app.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
