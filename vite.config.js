import { defineConfig } from 'vite';

// GitHub Pages serves the site from /<repo-name>/
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/optimus-3d-interactive/' : '/',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
}));
