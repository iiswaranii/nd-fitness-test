import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import { SessionProvider } from './lib/session';
import { ToastProvider } from './components/Toast';
import { keepFocusedFieldVisible, watchKeyboard } from './lib/viewport';
import { captureInstallPrompt } from './lib/platform';
import { InstallGate } from './components/InstallGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/global.css';
import { HASH_ROUTER } from './lib/config';

captureInstallPrompt();
watchKeyboard();
keepFocusedFieldVisible();
if (!HASH_ROUTER) import('virtual:pwa-register').then((m) => m.registerSW({ immediate: true })).catch(() => {});
const Router = HASH_ROUTER ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    <Router {...(HASH_ROUTER ? {} : { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' })}>
      <SessionProvider>
        <ToastProvider>
          <InstallGate>
            <App />
          </InstallGate>
        </ToastProvider>
      </SessionProvider>
    </Router>
    </ErrorBoundary>
  </StrictMode>,
);
