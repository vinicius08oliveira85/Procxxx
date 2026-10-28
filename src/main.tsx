import {StrictMode} from 'react';import { createRoot } from 'react-dom/client';
import { UiPreferencesProvider } from './lib/uiPreferences.tsx';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento #root não encontrado no index.html');

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Movimento e densidade: o provider aplica os atributos no <html> e
          configura o `MotionConfig` a partir do mesmo estado. */}
      <UiPreferencesProvider>
        <App />
      </UiPreferencesProvider>
    </ErrorBoundary>
  </StrictMode>,
);
