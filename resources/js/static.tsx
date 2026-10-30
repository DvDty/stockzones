import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from '@/pages/dashboard';
import '../css/app.css';

// The static build (GitHub Pages): just the dashboard, no Inertia or Laravel.
createRoot(document.getElementById('app')!).render(
    <StrictMode>
        <Dashboard />
    </StrictMode>,
);
