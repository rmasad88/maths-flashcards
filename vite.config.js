import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Globals let Testing Library clean up the DOM after each test by itself.
    globals: true,
  },
});
