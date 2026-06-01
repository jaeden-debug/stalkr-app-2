import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const isServerExport = typeof window === 'undefined';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: !isServerExport,
    persistSession: !isServerExport,
    detectSessionInUrl: false,
  },
  realtime: isServerExport
    ? {
        transport: class NoopWebSocket {
          static CONNECTING = 0;
          static OPEN = 1;
          static CLOSING = 2;
          static CLOSED = 3;
          readyState = NoopWebSocket.CLOSED;
          onopen: any = null;
          onclose: any = null;
          onerror: any = null;
          onmessage: any = null;
          constructor() {
            setTimeout(() => {
              this.onerror?.(new Error('Realtime disabled during server export'));
              this.onclose?.({ code: 1000, reason: 'server export' });
            }, 0);
          }
          send() {}
          close() {}
          addEventListener() {}
          removeEventListener() {}
        } as any,
      }
    : undefined,
});
