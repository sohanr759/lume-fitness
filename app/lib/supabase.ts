// Supabase client — auth and Edge Function calls.
//
// OAuth exchange is handled here at module-load time (before React/Expo Router
// run) so the URL hash/search is guaranteed to be intact. detectSessionInUrl is
// intentionally false — we do it ourselves below, once, at the right moment.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url  = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Read the URL synchronously before anything else can clear it.
const _h = typeof window !== 'undefined' ? window.location.hash   : '';
const _s = typeof window !== 'undefined' ? window.location.search : '';

export const supabase = createClient(url, anon, {
  auth: {
    // On web use localStorage (synchronous) so the PKCE code verifier survives
    // the OAuth redirect. AsyncStorage is async-only and silently breaks PKCE.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: false, // we exchange the token below, at the right time
  },
});

// True when this page load is an OAuth redirect (implicit or PKCE).
// Exported so _layout.tsx can hold its splash until the exchange settles.
export const isOAuthCallback =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  (_h.includes('access_token=') || new URLSearchParams(_s).has('code'));

// Any error the OAuth provider put in the redirect URL (e.g. user denied access).
export const oauthProviderError =
  typeof window !== 'undefined'
    ? new URLSearchParams(_s).get('error_description') ??
      new URLSearchParams(_s).get('error') ??
      null
    : null;

// Kick off the exchange immediately — runs once, synchronously triggered, before
// React mounts. Cleans the URL right away so tokens never sit in the address bar.
if (isOAuthCallback) {
  window.history.replaceState({}, '', window.location.pathname);

  if (_h.includes('access_token=')) {
    // Implicit flow: server returned tokens directly in the hash.
    const p  = new URLSearchParams(_h.replace(/^#/, ''));
    const at = p.get('access_token');
    const rt = p.get('refresh_token');
    if (at && rt) {
      supabase.auth.setSession({ access_token: at, refresh_token: rt }).catch(() => {});
    }
  } else {
    // PKCE flow: exchange the code for a session.
    const fullUrl = `${window.location.origin}${window.location.pathname}${_s}`;
    supabase.auth.exchangeCodeForSession(fullUrl).catch(() => {});
  }
}
