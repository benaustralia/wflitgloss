import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Dev middleware: receive GET /api/shakespeare?q=word,
// convert to POST for shakespeareswords.com (which only accepts POST).
// In production this is handled by the Netlify function.
function shakespeareDevPlugin() {
  return {
    name: 'shakespeare-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/shakespeare', async (req, res) => {
        const word = new URL(req.url, 'http://localhost').searchParams.get('q') ?? ''
        try {
          const upstream = await fetch('https://www.shakespeareswords.com/ajax/AjaxResponder.aspx', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commandName: 'cmd_autocomplete', parameters: word }),
          })
          const data = await upstream.json()
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(data))
        } catch {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ parameters: '[]' }))
        }
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), shakespeareDevPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase': ['firebase/firestore', 'firebase/app'],
          'lucide': ['lucide-react'],
          'ui': ['@/components/ui/input', '@/components/ui/button', '@/components/ui/textarea', '@/components/ui/scroll-area']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
