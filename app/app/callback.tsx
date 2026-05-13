/**
 * OAuth Callback Screen
 *
 * Overview: Passive landing page for OAuth redirects.
 *
 * Purpose: Provides a valid route for the OAuth redirect URL. All token exchange
 *          and post-auth routing is handled by _layout.tsx (waitingForOAuth +
 *          route guard), so this screen just renders a blank loading view while
 *          _layout.tsx finishes the exchange and navigates away.
 *
 * Inputs:  URL hash (#access_token=...) or query param (?code=...) — read by _layout.tsx
 * Outputs: Nothing — _layout.tsx's route guard handles navigation after exchange.
 * Dependencies: lib/theme
 * Usage: Set OAuth redirect URL to https://yoursite.com/callback in Supabase dashboard.
 */

import { View } from 'react-native';
import { colors } from '@/lib/theme';

export default function AuthCallback() {
  return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
}
