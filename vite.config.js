import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
    proxy: {
      '/api/shakespeare': {
        target: 'https://www.shakespeareswords.com',
        changeOrigin: true,
        rewrite: () => '/ajax/AjaxResponder.aspx',
      },
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
