import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { View, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { colors } from '@/lib/theme';
import { fetchProfile, getProfileCached, type Profile } from '@/lib/profile';
import { initStorage } from '@/lib/cache';
import { supabase, isOAuthCallback, oauthProviderError, oauthExchangePromise } from '@/lib/supabase';

// ── App context ──────────────────────────────────────────────────────────────
// Provides onProfileSaved so child screens (onboarding) can push the freshly
// saved profile into the root state immediately, without waiting for a
// re-fetch or relying on the local cache as a fallback.
export type AppContextValue = { onProfileSaved: (p: Profile) => void };
export const AppContext = createContext<AppContextValue>({ onProfileSaved: () => {} });

export default function RootLayout() {
  const router   = useRouter();
  const segments = useSegments();
  const seg0     = segments[0] as string | undefined;

  const [ready,           setReady]           = useState(false);
  // undefined = not yet resolved | null = signed out | Session = signed in
  const [session,         setSession]         = useState<Session | null | undefined>(undefined);
  // undefined = fetch in-flight | null = no profile row | Profile = loaded
  const [profile,         setProfile]         = useState<Profile | null | undefined>(undefined);
  // true while the OAuth exchange kicked off in supabase.ts is still in flight
  const [waitingForOAuth, setWaitingForOAuth] = useState(isOAuthCallback);

  const mounted       = useRef(false);
  // Tracks the last user ID we fetched a profile for.
  // Prevents a token-refresh (same user, new Session object) from
  // triggering a redundant fetchProfile() + setProfile(undefined) cycle.
  const currentUserId = useRef<string | null>(null);
  // Error returned by the OAuth exchange (null = success, string = failure message).
  const exchangeErrorRef = useRef<string | null>(null);

  // ── Storage init ────────────────────────────────────────────────────────────
  useEffect(() => {
    mounted.current = true;
    initStorage().then(() => { if (mounted.current) setReady(true); });
    return () => { mounted.current = false; };
  }, []);

  // ── Auth state ──────────────────────────────────────────────────────────────
  // INITIAL_SESSION fires once Supabase finishes initialising (reads storage).
  // SIGNED_IN fires when the exchange kicked off in supabase.ts completes.
  // TOKEN_REFRESHED fires ~hourly and passes a new Session with the same user.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted.current) return;
      setSession(s);
      if (s) setWaitingForOAuth(false); // exchange settled with a live session
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── OAuth exchange settlement ────────────────────────────────────────────────
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
        // Exchange failed — store the error and unblock the route guard so it
        // can redirect to /(auth) with the error message.
        console.error('[Lume] OAuth exchange failed:', errMsg);
        exchangeErrorRef.current = errMsg;
        if (mounted.current) setWaitingForOAuth(false);
        return;
      }
      // Exchange succeeded — do NOT touch waitingForOAuth here.
      // onAuthStateChange fires SIGNED_IN (or INITIAL_SESSION with the saved
      // session if SIGNED_IN was missed) and calls setSession + setWaitingForOAuth
      // in the same synchronous callback, so React batches them into a single
      // render.  Calling setWaitingForOAuth(false) here races with that and can
      // produce a render where session is still null but waitingForOAuth is false,
      // causing the route guard to redirect to auth prematurely.
    });

    return () => { clearTimeout(fallback); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Profile fetch ───────────────────────────────────────────────────────────
  // Only fetches when the user actually changes (new sign-in or sign-out).
  // Token refresh keeps the same user.id — we skip the fetch to avoid
  // a brief profile=undefined window that could trigger a spurious redirect.
  useEffect(() => {
    if (session === undefined) return;

    if (!session) {
      currentUserId.current = null;
      setProfile(null);
      return;
    }

    // Same user (e.g. TOKEN_REFRESHED) — keep the existing profile state.
    if (session.user.id === currentUserId.current) return;

    currentUserId.current = session.user.id;
    setProfile(undefined); // mark in-flight
    fetchProfile(session.user.id).then((p) => {
      if (!mounted.current) return;
      // If the network fetch returned null, try the local cache as fallback.
      // This keeps users on the home screen when the device is offline.
      setProfile(p ?? getProfileCached());
    });
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── onProfileSaved ──────────────────────────────────────────────────────────
  // Called by onboarding.tsx immediately after saveProfile() resolves.
  // Updates the profile state before router.replace('/') fires so the route
  // guard never sees profile=null after onboarding completes.
  const onProfileSaved = useCallback((p: Profile) => {
    setProfile(p);
  }, []);

  // ── Route guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
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

    // ── Session active: wait for profile fetch ────────────────────────────────
    if (profile === undefined) return;

    // ── No profile row ────────────────────────────────────────────────────────
    if (!profile) {
      if (inOnboarding) return;
      router.replace('/onboarding');
      return;
    }

    // ── Profile exists: ensure user is on the main app ────────────────────────
    if (inAuth || inOnboarding || inCallback) router.replace('/');
  }, [ready, session, profile, seg0, waitingForOAuth]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Splash ───────────────────────────────────────────────────────────────────
  // Show a blank screen until session resolves so the Stack is always mounted
  // once we start navigating — unmounting the navigator during profile fetch
  // can cause router.replace() to fire before the navigator is ready.
  if (!ready || session === undefined) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <AppContext.Provider value={{ onProfileSaved }}>
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
    </AppContext.Provider>
  );
}
