import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        saltline: 'index.html',
        original: 'original.html'
      }
    }
  }
});
