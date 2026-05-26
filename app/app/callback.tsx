/**
 * OAuth Callback Screen
 *
 * Overview: Landing page for OAuth redirects that shows a loading spinner
 *           while _layout.tsx exchanges the OAuth code/token for a session.
 *
 * Purpose: Gives the user visible feedback during the auth exchange. Also
 *          surfaces the exchange error directly so it's visible without
 *          browser dev tools.
 *
 * Inputs:  URL hash (#access_token=...) or query param (?code=...) — read by supabase.ts
 * Outputs: Nothing — _layout.tsx's route guard navigates away once exchange completes.
 *          Shows error text if the exchange fails, plus a manual "Back to sign in" link.
 * Dependencies: lib/theme, lib/supabase, components/Text
 * Usage: Set OAuth redirect URL to https://yoursite.com/callback in Supabase dashboard.
 */

import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/theme';
import { Text } from '@/components/Text';
import { oauthExchangePromise } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [timedOut,      setTimedOut]      = useState(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [exchangeDone,  setExchangeDone]  = useState(false);

  useEffect(() => {
    // Mirror the exchange result so we can display it directly.
    oauthExchangePromise.then((errMsg) => {
      setExchangeDone(true);
      if (errMsg) setExchangeError(errMsg);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 15_000);
    return () => clearTimeout(t);
  }, []);

  const showError    = !!exchangeError;
  // Only show the timeout message if the exchange is still pending — not if it already
  // finished cleanly (which can happen when isOAuthCallback is false, meaning the page
  // loaded without OAuth params and there was nothing to exchange).
  const showTimeout  = timedOut && !exchangeDone && !exchangeError;
  const showSpinner  = !exchangeDone && !timedOut;
  // Show a "no OAuth params" warning when we landed on /callback but there was nothing
  // to exchange — almost always a misconfigured Supabase redirect URL.
  const showNoParams = exchangeDone && !exchangeError && !timedOut;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 32 }}>
      {showSpinner && <ActivityIndicator color={colors.accent} size="large" />}

      {showError && (
        <Text variant="label" style={{ color: colors.danger, textAlign: 'center' }}>
          Sign-in failed: {exchangeError}
        </Text>
      )}

      {showTimeout && (
        <Text variant="label" dim style={{ textAlign: 'center' }}>
          Sign-in is taking longer than expected. You will be redirected back shortly.
        </Text>
      )}

      {showNoParams && (
        <Text variant="label" style={{ color: colors.danger, textAlign: 'center' }}>
          Sign-in could not complete — the redirect URL is missing the auth code.{'\n\n'}
          Check that your Supabase project's Redirect URL list includes{'\n'}
          this app's /callback URL.
        </Text>
      )}

      {/* Escape hatch — visible whenever the exchange is done or timed out */}
      {(exchangeDone || timedOut) && (
        <Pressable onPress={() => router.replace('/(auth)' as any)}>
          <Text variant="label" style={{ color: colors.accent, textAlign: 'center' }}>
            Back to sign in
          </Text>
        </Pressable>
      )}
    </View>
  );
}
