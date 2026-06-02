// Auth screen — combined login / signup with OAuth + email/password.
//
// Overview: Google and Apple OAuth buttons (web redirect flow) sit above
//           the email/password form as the primary sign-in method.
//           On success, onAuthStateChange in _layout.tsx routes the user.
//
// Purpose: Gate the app behind authentication.
//
// Inputs:  OAuth provider click, or email + password (min 6 chars)
//
// Outputs: Calls supabase.auth.signInWithOAuth or signInWithPassword/signUp.
//          Navigation is handled by the root _layout.tsx auth listener.
//
// Dependencies: lib/supabase.ts, lib/theme.ts, components/Screen, components/Text, components/Button
//
// Notes:
//   - OAuth uses a redirect flow on web — user is sent to provider then back to app origin.
//   - detectSessionInUrl:true in supabase.ts picks up the token on return.
//   - Email confirmation banner + resend button shown when Supabase requires it.
import { useState } from 'react';
import {
  View, TextInput, StyleSheet, KeyboardAvoidingView,
  ScrollView, Platform, ActivityIndicator, Pressable,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { colors, radius, space, type } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

type Mode = 'signin' | 'signup';

function getRedirectTo(): string | undefined {
  if (Platform.OS !== 'web') return undefined;
  // Always use the fixed production URL so the PKCE code verifier (stored in
  // localStorage during sign-in) is on the same origin as the callback page.
  // Dynamic window.location.origin caused origin mismatches when the app was
  // accessed from preview or staging URLs that weren't the configured Supabase
  // redirect URL, breaking the PKCE exchange.
  const appUrl = process.env.EXPO_PUBLIC_APP_URL ?? 'https://lume-fitness.vercel.app';
  return `${appUrl.replace(/\/$/, '')}/callback`;
}

// ─── OAuth buttons ────────────────────────────────────────────────────────────
function OAuthButton({
  label,
  logo,
  onPress,
  busy,
}: {
  label: string;
  logo: React.ReactNode;
  onPress: () => void;
  busy: boolean;
}) {
  return (
    <Pressable
      onPress={busy ? undefined : onPress}
      style={({ pressed }) => [
        styles.oauthBtn,
        pressed && !busy && { opacity: 0.8 },
        busy && { opacity: 0.5 },
      ]}
    >
      <View style={styles.oauthLogo}>{logo}</View>
      <Text variant="label" style={{ color: colors.text, flex: 1, textAlign: 'center', marginRight: 28 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function GoogleLogo() {
  return (
    <Svg viewBox="0 0 533.5 544.3" width={20} height={20}>
      <Path
        d="M533.5 278.4c0-18.5-1.5-37.1-4.7-55.3H272.1v104.8h147c-6.1 33.8-25.7 63.7-54.4 82.7v68h87.7c51.5-47.4 81.1-117.4 81.1-200.2z"
        fill="#4285F4"
      />
      <Path
        d="M272.1 544.3c73.4 0 135.3-24.1 180.4-65.7l-87.7-68c-24.4 16.6-55.9 26-92.6 26-71 0-131.2-47.9-152.8-112.3H28.9v70.1c46.2 91.9 140.3 149.9 243.2 149.9z"
        fill="#34A853"
      />
      <Path
        d="M119.3 324.3c-11.4-33.8-11.4-70.4 0-104.2V150H28.9c-38.6 76.9-38.6 167.5 0 244.4l90.4-70.1z"
        fill="#FBBC05"
      />
      <Path
        d="M272.1 107.7c38.8-.6 76.3 14 104.4 40.8l77.7-77.7C405 24.6 339.7-.8 272.1 0 169.2 0 75.1 58 28.9 150l90.4 70.1c21.5-64.5 81.8-112.4 152.8-112.4z"
        fill="#EA4335"
      />
    </Svg>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function AuthScreen() {
  // oauth_error is set by _layout.tsx when the OAuth exchange fails
  const { oauth_error } = useLocalSearchParams<{ oauth_error?: string }>();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    oauth_error ? decodeURIComponent(oauth_error) : null
  );
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  const clearStatus = () => {
    setError(null);
    setNeedsConfirmation(false);
    setResendDone(false);
  };

  const signInWithGoogle = async () => {
    clearStatus();
    setOauthBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getRedirectTo() },
      });
      if (authError) setError(authError.message);
      // On success: browser redirects to Google; session picked up on return via detectSessionInUrl
    } finally {
      setOauthBusy(false);
    }
  };

  const isUnconfirmed = (msg: string) =>
    msg.toLowerCase().includes('email not confirmed') ||
    msg.toLowerCase().includes('not confirmed');

  const submit = async () => {
    clearStatus();
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) {
          isUnconfirmed(authError.message) ? setNeedsConfirmation(true) : setError(authError.message);
        }
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: getRedirectTo() },
        });
        if (authError) setError(authError.message);
        else if (!data.session) setNeedsConfirmation(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    setResendBusy(true);
    setResendDone(false);
    try {
      await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: getRedirectTo() },
      });
      setResendDone(true);
    } finally {
      setResendBusy(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    clearStatus();
  };

  const canSubmit = email.trim().length > 0 && password.length >= 6 && !busy;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: space.xxl }}
        >
          <View style={{ paddingTop: space.xl }}>
            <Text variant="label" dim>Welcome to Lume</Text>
            <Text variant="display">
              {mode === 'signin' ? 'Sign in' : 'Create\naccount'}
            </Text>
          </View>

          {/* ── OAuth buttons ── */}
          <View style={{ marginTop: space.xl }}>
            <OAuthButton
              label="Continue with Google"
              logo={<GoogleLogo />}
              onPress={signInWithGoogle}
              busy={oauthBusy}
            />
          </View>

          {/* ── Divider ── */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text variant="label" dim style={{ marginHorizontal: space.md }}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Email / password ── */}
          <View>
            <Text variant="label" dim>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={styles.input}
              returnKeyType="next"
              nativeID="email"
              // @ts-ignore — name forwarded to DOM by RN Web
              name="email"
              autoComplete="email"
            />
          </View>

          <View style={{ marginTop: space.lg }}>
            <Text variant="label" dim>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={() => canSubmit && submit()}
              nativeID="password"
              // @ts-ignore — name forwarded to DOM by RN Web
              name="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </View>
        </ScrollView>

        {/* ── Status banners — always above buttons ── */}
        {needsConfirmation && (
          <View style={styles.banner}>
            <Text variant="label" style={{ color: colors.text }}>
              Check your inbox and click the confirmation link, then sign in.
            </Text>
            <View style={{ height: space.sm }} />
            {resendDone ? (
              <Text variant="label" dim>Confirmation email resent ✓</Text>
            ) : (
              <Button
                label={resendBusy ? 'Sending…' : 'Resend confirmation email'}
                variant="ghost"
                onPress={resendBusy ? undefined : resendConfirmation}
              />
            )}
          </View>
        )}

        {!!error && (
          <View style={styles.errorBanner}>
            <Text variant="label" style={{ color: colors.danger }}>{error}</Text>
          </View>
        )}

        <View style={{ paddingVertical: space.lg, gap: space.sm }}>
          {busy ? (
            <View style={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <Button
              label={mode === 'signin' ? 'Sign In' : 'Create Account'}
              onPress={canSubmit ? submit : undefined}
            />
          )}
          <Button
            label={mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account?'}
            variant="ghost"
            onPress={toggleMode}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    marginTop: space.sm,
    color: colors.text,
    ...type.title,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    paddingVertical: space.md,
  },
  oauthBtn: {
    height: 52,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
  },
  oauthLogo: {
    width: 28,
    alignItems: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: space.xl,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
  },
  banner: {
    marginBottom: space.sm,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  errorBanner: {
    marginBottom: space.sm,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
});
