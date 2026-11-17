import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles.css';

const Demo = lazy(() => import('./Demo.tsx'));
const isDemo = new URLSearchParams(window.location.search).get('demo') === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isDemo ? <Suspense fallback={<p className="p-8" role="status">Đang mở bản demo…</p>}><Demo /></Suspense> : <App />}</StrictMode>,
);
