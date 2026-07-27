import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, '..', '')
  const localEnv = loadEnv(mode, '.', '')
  const env = { ...rootEnv, ...localEnv }
  const backendTarget = env.VITE_LOCAL_API_URL || 'http://localhost:8000'

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || ''),
      'import.meta.env.VITE_ADMIN_TOKEN': JSON.stringify(env.VITE_ADMIN_TOKEN || env.ADMIN_TOKEN || ''),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_KEY || env.VITE_SUPABASE_ANON_PUBLIC_KEY || ''),
    },
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': backendTarget,
        '/admin': backendTarget,
        '/crm': backendTarget,
      },
    },
  }
})
