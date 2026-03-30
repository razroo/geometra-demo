import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/geometra-demo/',
  build: {
    outDir: 'dist',
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'agent-demo': resolve(__dirname, 'agent-demo.html'),
      },
    },
  },
});
