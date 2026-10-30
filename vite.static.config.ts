import { fileURLToPath } from 'node:url';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * The static site published to GitHub Pages: the dashboard on its own,
 * reading JSON written by `php artisan stockzones:export dist/data`.
 */
export default defineConfig({
    root: path('./resources/static'),
    base: './',
    publicDir: false,
    plugins: [
        react(),
        babel({
            presets: [reactCompilerPreset()],
        }),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@inertiajs/react': path('./resources/js/static-inertia.tsx'),
            '@': path('./resources/js'),
        },
    },
    define: {
        'import.meta.env.VITE_STATIC': JSON.stringify('true'),
    },
    build: {
        outDir: path('./dist'),
        emptyOutDir: true,
    },
});
