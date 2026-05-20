import { useEffect, useRef, useState } from 'react';
import { View, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { colors } from '@/lib/theme';
import { fetchProfile, getProfileCached, type Profile } from '@/lib/profile';
import { initStorage } from '@/lib/cache';
import { supabase } from '@/lib/supabase';

// Capture URL at module-load time — before Expo Router processes/clears it.
const _initHash = typeof window !== 'undefined' ? window.location.hash : '';
const _initSearch = typeof window !== 'undefined' ? window.location.search : '';

function detectOAuthCallback(): boolean {
  if (Platform.OS !== 'web') return false;
  return (
    _initHash.includes('access_token=') ||
    new URLSearchParams(_initSearch).has('code')
  );
}

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const seg0 = segments[0] as string | undefined;
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // undefined = fetch in-flight, null = no profile, Profile = loaded
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [waitingForOAuth, setWaitingForOAuth] = useState(detectOAuthCallback);
  const mounted = useRef(false);

  useEffect(() => {
    initStorage().then(() => setReady(true));
  }, []);

  // Auth state listener — also clears the OAuth wait when session arrives.
  useEffect(() => {
    mounted.current = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted.current) return;
      setSession(s);
      if (s) setWaitingForOAuth(false);
    });
    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch profile from Supabase whenever session changes.
  // session === undefined means auth hasn't resolved yet — skip.
  // session === null means signed out — clear profile immediately.
  useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      setProfile(null);
      return;
    }
    setProfile(undefined); // mark as in-flight
    fetchProfile().then((p) => {
      if (mounted.current) setProfile(p);
    });
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manually exchange OAuth tokens from the URL — handles /callback and any other
  // landing route. callback.tsx is passive; _layout owns the exchange.
  useEffect(() => {
    if (!waitingForOAuth || Platform.OS !== 'web' || typeof window === 'undefined') return;

    const hash = window.location.hash;
    const search = window.location.search;

    const done = () => { if (mounted.current) setWaitingForOAuth(false); };

    if (hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      window.history.replaceState({}, '', window.location.pathname);

      if (accessToken && refreshToken) {
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ error }) => { if (error) done(); })
          .catch(done);
      } else {
        done();
      }
    } else if (new URLSearchParams(search).has('code')) {
      const fullUrl = window.location.href;
      window.history.replaceState({}, '', window.location.pathname);
      supabase.auth
        .exchangeCodeForSession(fullUrl)
        .then(({ error }) => { if (error) done(); })
        .catch(done);
    } else {
      done();
    }

    const t = setTimeout(done, 10000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Route guard — waits for OAuth exchange, storage init, auth, and profile fetch.
  useEffect(() => {
    console.log('[guard]', { ready, session: session ? 'SET' : session === null ? 'NULL' : 'UNDEFINED', profile: profile ? 'SET' : profile === null ? 'NULL' : 'UNDEFINED', seg0, waitingForOAuth });
    if (!ready || session === undefined || seg0 === undefined || waitingForOAuth) return;

    const inAuth = seg0 === '(auth)';
    const inOnboarding = seg0 === 'onboarding';
    const inCallback = seg0 === 'callback';

    if (!session) {
      console.log('[guard] no session → redirecting to auth');
      if (!inAuth) router.replace('/(auth)');
      return;
    }

    // Profile fetch still in-flight — wait.
    if (profile === undefined) return;

    // Fall back to local cache: covers the moment right after onboarding saves
    // (saveProfile writes to cache immediately, but layout state is still null).
    const resolvedProfile = profile ?? getProfileCached();
    console.log('[guard] resolvedProfile:', resolvedProfile ? 'SET' : 'NULL', '| inOnboarding:', inOnboarding, '| inAuth:', inAuth, '| inCallback:', inCallback);

    if (!resolvedProfile && !inOnboarding) { console.log('[guard] no profile → /onboarding'); router.replace('/onboarding'); return; }
    if (resolvedProfile && (inAuth || inOnboarding || inCallback)) { console.log('[guard] has profile + special route → /'); router.replace('/'); }
  }, [ready, session, profile, seg0, waitingForOAuth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hold splash until storage, auth, OAuth exchange, and profile are all resolved.
  if (!ready || session === undefined || waitingForOAuth || (session && profile === undefined)) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: Platform.OS === 'web' ? 'none' : 'fade',
        }}
      />
    </SafeAreaProvider>
  );
}
