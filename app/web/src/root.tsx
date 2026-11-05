import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, type ComponentType, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiError } from './api';
import { App } from './App';
import { I18nProvider } from './i18n';
import { SessionProvider } from './session';
import { ToastProvider } from './ui';
import './styles.css';

/** Drzewo aplikacji z wybranym routerem — przeglądarka: BrowserRouter, podgląd bez serwera: router w pamięci. */
export function renderApp(Router: ComponentType<{ children?: ReactNode }>): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      },
      mutations: { retry: false },
    },
  });

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <Router>
          <I18nProvider>
            <ToastProvider>
              <SessionProvider>
                <App />
              </SessionProvider>
            </ToastProvider>
          </I18nProvider>
        </Router>
      </QueryClientProvider>
    </StrictMode>,
  );
}
