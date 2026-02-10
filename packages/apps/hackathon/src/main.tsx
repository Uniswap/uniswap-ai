import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

// Userback visual feedback widget
if (import.meta.env.VITE_USERBACK_TOKEN) {
  import('@userback/widget')
    .then(({ default: Userback }) => Userback(import.meta.env.VITE_USERBACK_TOKEN))
    .then(() => console.log('[Userback] widget loaded'))
    .catch((err) => console.error('[Userback] failed to load:', err));
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
