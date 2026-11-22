import { defineConfig } from 'vite';
// base relativa: o build funciona em GitHub Pages (subpasta), Netlify e Vercel
export default defineConfig({ base: './', server: { host: true }, build: { chunkSizeWarningLimit: 800 } });
