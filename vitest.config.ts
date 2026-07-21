import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'happy-dom',
  },
  resolve: {
    alias: {
      '~': resolve(__dirname),
      '@': resolve(__dirname),
    },
  },
})
