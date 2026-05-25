import { createClient } from '@supabase/supabase-js'

// तुमच्या Supabase च्या डिटेल्स इथे टाका
const supabaseUrl = 'https://lioqsvzabitnjkmftguu.supabase.co'
const supabaseAnonKey = 'sb_publishable_IbYWbpQK4vHB03AmpWwAkQ_wnL8IsML' // ही तुमची API Key आहे

export const supabase = createClient(supabaseUrl, supabaseAnonKey)