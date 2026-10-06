import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // В разработке API доступен по относительному /api — без CORS
    proxy: { '/api': process.env.API_URL || 'http://localhost:4000' },
  },
})
