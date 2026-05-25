import { useEffect, useRef, useState } from 'react';
import { View, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { colors } from '@/lib/theme';
import { fetchProfile, getProfileCached, type Profile } from '@/lib/profile';
import { initStorage } from '@/lib/cache';
import { supabase, isOAuthCallback, oauthProviderError, oauthExchangePromise } from '@/lib/supabase';

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
  // Error returned by the OAuth exchange (null = success, string = failure message).
  const exchangeErrorRef = useRef<string | null>(null);

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

  // ── OAuth exchange settlement ────────────────────────────────────────────────
  // Awaits the promise kicked off in supabase.ts (module-load time). When it
  // settles we unblock the route guard. A 10 s fallback covers the case where
  // the promise somehow never settles (e.g. network hang before promise resolves).
  useEffect(() => {
    if (!isOAuthCallback) return;

    let settled = false;
    const fallback = setTimeout(() => {
      if (!settled && mounted.current) {
        console.error('[Lume] OAuth exchange timed out after 10 s — no session or error received.');
        setWaitingForOAuth(false);
      }
    }, 10_000);

    oauthExchangePromise.then((errMsg) => {
      settled = true;
      clearTimeout(fallback);
      if (errMsg) {
        console.error('[Lume] OAuth exchange failed:', errMsg);
        exchangeErrorRef.current = errMsg;
      }
      if (mounted.current) setWaitingForOAuth(false);
    });

    return () => { clearTimeout(fallback); };
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
      const authErr = exchangeErrorRef.current ?? oauthProviderError;
      const dest = authErr
        ? (`/(auth)?oauth_error=${encodeURIComponent(authErr)}` as any)
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
  // Once session resolves (INITIAL_SESSION fires), keep the Stack permanently
  // mounted — even during profile fetch. Unmounting/remounting the navigator
  // while profile is in-flight means router.replace() may fire before the
  // navigator is ready. The route guard already blocks on profile === undefined,
  // so no redirect fires prematurely.
  if (!ready || session === undefined) {
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
