import { putyPlugin } from 'puty/vitest'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [putyPlugin()],
  test: {
    environment: 'jsdom',
    setupFiles: './setupCanvas.js',
    forceRerunTriggers: [
      '**/*.js',
      '**/*.{test,spec}.yaml',
      '**/*.{test,spec}.yml'
    ],
  },
});
