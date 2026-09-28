import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.js'], include: ['src/**/*.test.{js,jsx}'] },
})
