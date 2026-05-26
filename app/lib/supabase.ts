// Supabase client — auth and Edge Function calls.
//
// OAuth exchange is handled here at module-load time (before React/Expo Router
// run) so the URL hash/search is guaranteed to be intact.
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
    // Force PKCE so the callback carries ?code= (query string) instead of
    // #access_token= (hash). Expo Router strips the hash during initialisation
    // before our module-level code can read it, so implicit flow silently
    // fails. PKCE query params are never touched by the router.
    flowType:           'pkce',
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: false, // we exchange the token below, at the right time
  },
});

// True when this page load is an OAuth redirect (implicit or PKCE).
export const isOAuthCallback =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  (_h.includes('access_token=') || new URLSearchParams(_s).has('code'));

// Any error the OAuth *provider* put in the redirect URL (e.g. user denied).
export const oauthProviderError =
  typeof window !== 'undefined'
    ? new URLSearchParams(_s).get('error_description') ??
      new URLSearchParams(_s).get('error') ??
      null
    : null;

// Promise that settles once the token exchange completes.
// Resolves to an error string on failure, null on success.
// _layout.tsx awaits this to surface exchange errors on the auth screen.
export const oauthExchangePromise: Promise<string | null> = (() => {
  if (!isOAuthCallback) return Promise.resolve(null);

  window.history.replaceState({}, '', window.location.pathname);

  if (_h.includes('access_token=')) {
    const p  = new URLSearchParams(_h.replace(/^#/, ''));
    const at = p.get('access_token');
    const rt = p.get('refresh_token');
    if (!at || !rt) return Promise.resolve('Incomplete token in redirect URL.');
    return supabase.auth
      .setSession({ access_token: at, refresh_token: rt })
      .then(({ error }) => error?.message ?? null)
      .catch((e: unknown) => (e instanceof Error ? e.message : 'OAuth exchange failed.'));
  }

  const fullUrl = `${window.location.origin}${window.location.pathname}${_s}`;
  return supabase.auth
    .exchangeCodeForSession(fullUrl)
    .then(({ error }) => error?.message ?? null)
    .catch((e: unknown) => (e instanceof Error ? e.message : 'OAuth exchange failed.'));
})();
