// Supabase client — used for Edge Function calls and user authentication.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon, {
  auth: {
    // On web: omit storage so Supabase uses its built-in localStorage adapter.
    // localStorage is synchronous — required for PKCE OAuth to retrieve the code
    // verifier on redirect. AsyncStorage is async-only and silently breaks this.
    // On native: AsyncStorage persists the session across app restarts.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // handled manually in _layout.tsx to avoid hash-clearing race
  },
});
