import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev only: serve GET /api/schedule with the same handler Vercel runs (app/api/schedule.js), behind a small
// in-memory cache that honours its s-maxage — the stand-in for Vercel's CDN, so a dev session or an e2e run asks
// ESPN about as rarely as production does. Any failure answers 503, and the app keeps its build-time schedule.
function scheduleApiDev() {
  let cached = null // { until, status, headers, body }
  return {
    name: 'chi-api-schedule-dev',
    configureServer(server) {
      server.middlewares.use('/api/schedule', async (req, res) => {
        try {
          if (!cached || Date.now() > cached.until) {
            const { buildSchedule } = await server.ssrLoadModule('/api/schedule.js')
            const r = await buildSchedule()
            const maxAge = Number(/s-maxage=(\d+)/.exec(r.headers['Cache-Control'] ?? '')?.[1] ?? 0)
            cached = { until: Date.now() + maxAge * 1000, status: r.status, headers: r.headers, body: JSON.stringify(r.body) }
          }
          res.statusCode = cached.status
          for (const [k, v] of Object.entries(cached.headers)) res.setHeader(k, v)
          res.end(cached.body)
        } catch {
          res.statusCode = 503
          res.setHeader('Cache-Control', 'no-store')
          res.end('{"error":"schedule proxy failed"}')
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), scheduleApiDev()],
  server: { fs: { allow: ['..'] } },
  // 2026-10-19: the libraries ship as their own long-cached chunks, so a deploy that only changes app code
  // re-downloads the app chunk (~0.7 MB) instead of the whole 2.5 MB bundle. Measured with e2e/loadtime.mjs.
  build: {
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'vendor-react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'vendor-three', test: /[\\/]node_modules[\\/](three|three-stdlib|three-mesh-bvh|camera-controls)[\\/]/ },
            { name: 'vendor-r3f', test: /[\\/]node_modules[\\/](@react-three|its-fine|zustand|suspend-react|react-use-measure)[\\/]/ },
            { name: 'vendor-fx', test: /[\\/]node_modules[\\/](postprocessing|n8ao)[\\/]/ },
          ],
        },
      },
    },
  },
  // a few workers: the jsdom HUD tests oversubscribe the machine at full parallelism and time out (P4)
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.js'], include: ['src/**/*.test.{js,jsx}'], maxWorkers: 4 },
})
