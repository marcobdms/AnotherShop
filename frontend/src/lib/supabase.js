import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY
  || import.meta.env.VITE_SUPABASE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_PUBLIC_KEY
  || ''
)

function createMissingSupabaseClient() {
  const error = new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
  const response = async () => ({ data: null, error })

  return {
    from() {
      return {
        select: () => ({ eq: () => ({ maybeSingle: response, single: response }), maybeSingle: response, single: response }),
        insert: () => ({ select: () => ({ single: response }) }),
        update: () => ({ eq: () => ({ select: () => ({ single: response }) }) }),
        delete: () => ({ eq: response }),
      }
    },
    storage: {
      from() {
        return {
          upload: response,
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
        }
      },
    },
  }
}

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMissingSupabaseClient()
