import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY
  || import.meta.env.VITE_SUPABASE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_PUBLIC_KEY
  || ''
)

function createMissingSupabaseClient() {
  return {
    from() {
      const error = new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: null, error }),
              }
            },
          }
        },
      }
    },
  }
}

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMissingSupabaseClient()
