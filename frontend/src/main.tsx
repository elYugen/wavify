import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { initPlayer, usePlayer } from './store/player';
import { initSync } from './lib/sync';
import './index.css';

initPlayer();
initSync();
if (import.meta.env.DEV) (window as any).__player = usePlayer;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
