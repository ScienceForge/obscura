import { defineConfig } from 'vite';

// Relative base so the build works from any path, such as a GitHub Pages
// project site served at /obscura/. Routing uses the URL hash, so no server
// rewrites are needed.
export default defineConfig({
  base: './',
  build: { target: 'es2022', sourcemap: false },
});
