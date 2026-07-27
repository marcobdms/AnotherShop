/**
 * supabase.js — Cliente Supabase singleton
 * Importar desde aquí en toda la app, nunca crear nuevas instancias.
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no están definidas. ' +
    'Añádelas en frontend/.env.local para desarrollo local.'
  )
}

export const supabase = createClient(SUPABASE_URL ?? '', SUPABASE_ANON ?? '')
