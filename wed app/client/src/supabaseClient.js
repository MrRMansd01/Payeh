import { createClient } from '@supabase/supabase-js';

// از فایل .env (مقادیر از ریشه پروژه کپی می‌شوند؛ یک .env واحد برای امنیت)
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
