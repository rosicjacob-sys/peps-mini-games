import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Single self-contained IIFE: <script src=".../widget.js" data-store="KEY" defer>
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  esbuild: { charset: 'ascii' }, // survives hosts that serve JS without a utf-8 charset
  build: {
    lib: { entry: 'src/main.jsx', name: 'PepsGames', formats: ['iife'], fileName: () => 'widget.js' },
    cssCodeSplit: false,
    minify: true,
  },
});
