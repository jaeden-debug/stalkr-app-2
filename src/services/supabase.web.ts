/**
 * Web-safe Supabase client
 *
 * Uses the browser's localStorage for session persistence instead of
 * @react-native-async-storage/async-storage, which is not available in
 * Expo web builds. Import this wherever you need Supabase in web-only
 * code (e.g. the invite landing page).
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseWeb = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
  },
});
