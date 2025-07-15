import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY; // <-- 'K' بزرگ شد

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 
