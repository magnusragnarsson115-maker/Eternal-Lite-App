import { BrowserRouter } from 'react-router-dom';
import { registerServiceWorker } from './lib/push';
import { renderApp } from './root';

void registerServiceWorker();
renderApp(BrowserRouter);
