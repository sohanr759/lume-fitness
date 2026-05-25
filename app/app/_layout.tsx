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

// Capture any OAuth error surfaced by the provider in the redirect URL.
// Read at module-load time before Expo Router processes the URL.
const _oauthError =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('error_description') ??
      new URLSearchParams(window.location.search).get('error') ??
      null
    : null;

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const seg0 = segments[0] as string | undefined;

  const [ready, setReady] = useState(false);
  // undefined → Supabase hasn't resolved yet | null → signed out | Session → signed in
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // undefined → fetch in-flight | null → no profile row | Profile → loaded
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  const mounted = useRef(false);
  // Detects when session transitions null→active so the guard can ignore
  // the stale profile=null that was set during the signed-out state.
  const prevSessionRef = useRef<Session | null | undefined>(undefined);

  // ── Storage init ────────────────────────────────────────────────────────────
  useEffect(() => {
    mounted.current = true;
    initStorage().then(() => { if (mounted.current) setReady(true); });
    return () => { mounted.current = false; };
  }, []);

  // ── Auth state ──────────────────────────────────────────────────────────────
  // Supabase fires INITIAL_SESSION once it resolves the session (including any
  // OAuth token exchange it started at client-init time). After that it fires
  // SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED as state changes.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted.current) return;
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Profile fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (session === undefined) return;         // not resolved yet — wait
    if (!session) { setProfile(null); return; } // signed out — clear immediately
    setProfile(undefined);                      // mark in-flight
    fetchProfile().then((p) => { if (mounted.current) setProfile(p); });
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Route guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const sessionChanged = prevSessionRef.current !== session;
    prevSessionRef.current = session;

    if (!ready || session === undefined || seg0 === undefined) return;

    const inAuth       = seg0 === '(auth)';
    const inOnboarding = seg0 === 'onboarding';
    const inCallback   = seg0 === 'callback';

    // ── No session ────────────────────────────────────────────────────────────
    if (!session) {
      if (inAuth) return; // already there
      const dest = _oauthError
        ? (`/(auth)?oauth_error=${encodeURIComponent(_oauthError)}` as any)
        : '/(auth)';
      router.replace(dest);
      return;
    }

    // ── Session active ────────────────────────────────────────────────────────
    if (profile === undefined) return; // profile fetch in-flight — wait

    // session just went null → active: profile=null is stale from signed-out state.
    // The profile effect already kicked off fetchProfile(); wait for it.
    if (sessionChanged && profile === null) return;

    // After onboarding: saveProfile() writes to cache synchronously then
    // router.replace('/') fires. Profile state is still null (wasn't re-fetched),
    // but the cache already has the new profile — use it as the source of truth.
    const resolvedProfile = profile ?? getProfileCached();

    if (!resolvedProfile && !inOnboarding) { router.replace('/onboarding'); return; }
    if (resolvedProfile && (inAuth || inOnboarding || inCallback)) router.replace('/');
  }, [ready, session, profile, seg0]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Splash ───────────────────────────────────────────────────────────────────
  // Hold until storage is ready, Supabase has resolved the session (including
  // any async OAuth exchange), and the profile fetch has settled.
  if (!ready || session === undefined || (session && profile === undefined)) {
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
