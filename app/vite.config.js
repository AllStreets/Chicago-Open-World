import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
  // a few workers: the jsdom HUD tests oversubscribe the machine at full parallelism and time out (P4)
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.js'], include: ['src/**/*.test.{js,jsx}'], maxWorkers: 4 },
})
