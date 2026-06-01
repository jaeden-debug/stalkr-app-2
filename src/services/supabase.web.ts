import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

let _supabaseWeb: any = null;

export function getSupabaseWeb() {
  if (_supabaseWeb) return _supabaseWeb;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  _supabaseWeb = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  return _supabaseWeb;
}

export const supabaseWeb = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseWeb();
      const value = client[prop as keyof typeof client];

      if (typeof value === 'function') {
        return value.bind(client);
      }

      return value;
    },
  }
) as any;

export const supabase = supabaseWeb;
