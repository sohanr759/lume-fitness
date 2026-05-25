import { useEffect, useRef, useState } from 'react';
import { View, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { colors } from '@/lib/theme';
import { fetchProfile, getProfileCached, type Profile } from '@/lib/profile';
import { initStorage } from '@/lib/cache';
import { supabase, isOAuthCallback, oauthProviderError } from '@/lib/supabase';

export default function RootLayout() {
  const router   = useRouter();
  const segments = useSegments();
  const seg0     = segments[0] as string | undefined;

  const [ready,          setReady]          = useState(false);
  // undefined = not yet resolved | null = signed out | Session = signed in
  const [session,        setSession]        = useState<Session | null | undefined>(undefined);
  // undefined = fetch in-flight | null = no profile row | Profile = loaded
  const [profile,        setProfile]        = useState<Profile | null | undefined>(undefined);
  // true while the OAuth exchange kicked off in supabase.ts is still in flight
  const [waitingForOAuth, setWaitingForOAuth] = useState(isOAuthCallback);

  const mounted        = useRef(false);
  // Detects session null→active transitions so the guard ignores the stale
  // profile=null that was set during the signed-out state.
  const prevSessionRef = useRef<Session | null | undefined>(undefined);

  // ── Storage init ────────────────────────────────────────────────────────────
  useEffect(() => {
    mounted.current = true;
    initStorage().then(() => { if (mounted.current) setReady(true); });
    return () => { mounted.current = false; };
  }, []);

  // ── Auth state ──────────────────────────────────────────────────────────────
  // INITIAL_SESSION fires once Supabase finishes initialising (reads localStorage).
  // SIGNED_IN fires when the exchange kicked off in supabase.ts completes.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted.current) return;
      setSession(s);
      if (s) setWaitingForOAuth(false); // exchange settled with a live session
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── OAuth timeout ───────────────────────────────────────────────────────────
  // If the exchange doesn't produce a session within 10 s, unblock so the user
  // can see the auth screen and try again.
  useEffect(() => {
    if (!isOAuthCallback) return;
    const t = setTimeout(() => { if (mounted.current) setWaitingForOAuth(false); }, 10_000);
    return () => clearTimeout(t);
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

    if (!ready || session === undefined || seg0 === undefined || waitingForOAuth) return;

    const inAuth       = seg0 === '(auth)';
    const inOnboarding = seg0 === 'onboarding';
    const inCallback   = seg0 === 'callback';

    // ── No session ────────────────────────────────────────────────────────────
    if (!session) {
      if (inAuth) return;
      const dest = oauthProviderError
        ? (`/(auth)?oauth_error=${encodeURIComponent(oauthProviderError)}` as any)
        : '/(auth)';
      router.replace(dest);
      return;
    }

    // ── Session active ────────────────────────────────────────────────────────
    if (profile === undefined) return; // fetch in-flight — wait

    // Session just went null→active: profile=null is stale from the signed-out
    // state. The profile effect will reset it to undefined — wait for that.
    if (sessionChanged && profile === null) return;

    // After onboarding: saveProfile() writes cache synchronously before
    // router.replace('/') fires. Profile state is still null (not re-fetched),
    // so fall back to cache as the source of truth.
    const resolvedProfile = profile ?? getProfileCached();

    if (!resolvedProfile && !inOnboarding) { router.replace('/onboarding'); return; }
    if (resolvedProfile && (inAuth || inOnboarding || inCallback)) router.replace('/');
  }, [ready, session, profile, seg0, waitingForOAuth]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Splash ───────────────────────────────────────────────────────────────────
  // waitingForOAuth is intentionally NOT here — it only blocks the route guard,
  // not the Stack. Keeping the Stack always mounted means router.replace() works
  // the moment the exchange settles (navigator is already ready).
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
