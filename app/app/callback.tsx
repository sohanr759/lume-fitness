/**
 * OAuth Callback Screen
 *
 * Overview: Landing page for OAuth redirects that shows a loading spinner
 *           while _layout.tsx exchanges the OAuth code/token for a session.
 *
 * Purpose: Gives the user visible feedback during the auth exchange instead of
 *          a blank screen. Displays a timeout message if the exchange stalls.
 *
 * Inputs:  URL hash (#access_token=...) or query param (?code=...) — read by _layout.tsx
 * Outputs: Nothing — _layout.tsx's route guard navigates away once exchange completes.
 * Dependencies: lib/theme, components/Text
 * Usage: Set OAuth redirect URL to https://yoursite.com/callback in Supabase dashboard.
 *
 * Notes:
 *   - The 15-second timeout message is purely cosmetic — _layout.tsx continues
 *     its own 10-second timeout independently and redirects to /(auth) on failure.
 */

import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '@/lib/theme';
import { Text } from '@/components/Text';

export default function AuthCallback() {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 15_000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      {timedOut ? (
        <Text variant="label" dim style={{ textAlign: 'center', paddingHorizontal: 32 }}>
          Sign-in is taking longer than expected. You will be redirected back shortly.
        </Text>
      ) : (
        <ActivityIndicator color={colors.accent} size="large" />
      )}
    </View>
  );
}
