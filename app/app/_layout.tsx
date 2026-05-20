import { useEffect, useRef, useState } from 'react';
import { View, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { colors } from '@/lib/theme';
import { fetchProfile, getProfileCached, saveProfile, type Profile } from '@/lib/profile';
import { initStorage } from '@/lib/cache';
import { supabase } from '@/lib/supabase';

// When EXPO_PUBLIC_AUTH_DISABLED=true the entire auth/onboarding gate is
// bypassed. The app renders immediately with a guest profile so every other
// feature (food log, workout, history) can be tested without a Supabase
// account. Flip the flag back to re-enable auth with zero code changes.
const AUTH_DISABLED = process.env.EXPO_PUBLIC_AUTH_DISABLED === 'true';

const GUEST_PROFILE: Omit<Profile, 'goal_kcal' | 'created_at'> = {
  name: 'Guest',
  sex: 'male',
  age: 25,
  height_cm: 175,
  weight_kg: 70,
  goal: 'maintain',
  activity: 'moderate',
};

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
  // Tracks the previous session ref so the guard can detect when session just
  // changed. Prevents acting on a stale profile=null that belongs to the
  // previous signed-out state before the profile effect resets it to undefined.
  const prevSessionRef = useRef<Session | null | undefined>(undefined);

  useEffect(() => {
    if (AUTH_DISABLED) {
      // Seed a guest profile if the cache is empty so all screens render correctly.
      initStorage().then(async () => {
        if (!getProfileCached()) await saveProfile(GUEST_PROFILE);
        setReady(true);
      });
      return;
    }
    initStorage().then(() => setReady(true));
  }, []);

  // Auth state listener — also clears the OAuth wait when session arrives.
  useEffect(() => {
    if (AUTH_DISABLED) return;
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
    if (AUTH_DISABLED) return;
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
  // Always runs regardless of AUTH_DISABLED so the token is consumed and the
  // URL is cleaned up — the route guard then redirects to home.
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
          .then(() => done())  // always clear waitingForOAuth — onAuthStateChange may not fire in AUTH_DISABLED mode
          .catch(done);
      } else {
        done();
      }
    } else if (new URLSearchParams(search).has('code')) {
      const fullUrl = window.location.href;
      window.history.replaceState({}, '', window.location.pathname);
      supabase.auth
        .exchangeCodeForSession(fullUrl)
        .then(() => done())  // same — always clear
        .catch(done);
    } else {
      done();
    }

    const t = setTimeout(done, 10000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Route guard — waits for OAuth exchange, storage init, auth, and profile fetch.
  useEffect(() => {
    if (AUTH_DISABLED) {
      // Even with auth disabled, redirect away from auth-only routes so the
      // user isn't stranded on /callback or /(auth) if they land there.
      if (ready && seg0 !== undefined) {
        const onSpecialRoute = seg0 === '(auth)' || seg0 === 'callback' || seg0 === 'onboarding';
        if (onSpecialRoute) router.replace('/');
      }
      return;
    }

    // Detect session changes so we can ignore stale profile=null values.
    const sessionChanged = prevSessionRef.current !== session;
    prevSessionRef.current = session;

    if (!ready || session === undefined || seg0 === undefined || waitingForOAuth) return;

    const inAuth = seg0 === '(auth)';
    const inOnboarding = seg0 === 'onboarding';
    const inCallback = seg0 === 'callback';

    if (!session) {
      if (!inAuth) router.replace('/(auth)');
      return;
    }

    // Profile fetch still in-flight — wait.
    if (profile === undefined) return;

    // If session just became active, profile=null is stale (it was set when the
    // session was null). The profile effect will reset it to undefined shortly.
    // Returning here prevents a premature redirect to /onboarding.
    if (sessionChanged && profile === null) return;

    // Fall back to local cache: covers the moment right after onboarding saves
    // (saveProfile writes to cache immediately, but layout state is still null).
    const resolvedProfile = profile ?? getProfileCached();

    if (!resolvedProfile && !inOnboarding) { router.replace('/onboarding'); return; }
    if (resolvedProfile && (inAuth || inOnboarding || inCallback)) router.replace('/');
  }, [ready, session, profile, seg0, waitingForOAuth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hold splash until storage init and OAuth exchange complete.
  // In AUTH_DISABLED mode we skip session/profile checks but still wait for
  // the OAuth exchange so the callback token is consumed before rendering.
  if (!ready || waitingForOAuth) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!AUTH_DISABLED && (session === undefined || (session && profile === undefined))) {
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
