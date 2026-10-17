import { useEffect, type ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { setFileSource } from '../lib/sourceImage';
import { renderApp } from '../root';
import { fileUrl, installShim, type PreviewData } from './shim';
import { interceptFileLinks } from './viewer';

const ROUTE_KEY = 'eternal.preview.route';

function savedRoute(): string {
  try {
    return sessionStorage.getItem(ROUTE_KEY) || '/';
  } catch {
    return '/';
  }
}

// strona podglądu nie ma własnego paska adresu — miejsce w aplikacji pamiętamy do odświeżenia strony
function RouteMemory() {
  const loc = useLocation();
  useEffect(() => {
    try {
      sessionStorage.setItem(ROUTE_KEY, `${loc.pathname}${loc.search}`);
    } catch {
      /* tryb prywatny */
    }
  }, [loc.pathname, loc.search]);
  return null;
}

function PreviewRouter({ children }: { children?: ReactNode }) {
  return (
    <MemoryRouter initialEntries={[savedRoute()]}>
      <RouteMemory />
      {children}
    </MemoryRouter>
  );
}

async function start(): Promise<void> {
  const res = await fetch(new URL('preview-data.json', document.baseURI).href);
  const data = (await res.json()) as PreviewData;
  installShim(data);
  setFileSource(fileUrl);
  interceptFileLinks();
  renderApp(PreviewRouter);
}

start().catch((err: unknown) => {
  const root = document.getElementById('root');
  if (root) root.textContent = `Nie udało się wczytać podglądu: ${(err as Error).message}`;
});
