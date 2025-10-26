import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Change base to '/your-repo-name/' when publishing under a repo path
export default defineConfig({
  plugins: [react()],
  base: './'
})
