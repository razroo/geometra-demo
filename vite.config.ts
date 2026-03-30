import { defineConfig } from 'vite';

export default defineConfig({
  base: '/geometra-demo/',
  build: {
    outDir: 'dist',
    target: 'esnext',
  },
});
