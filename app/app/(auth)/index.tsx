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
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { colors, radius, space, type } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

type Mode = 'signin' | 'signup';

function getRedirectTo(): string | undefined {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/callback`;
  }
  return undefined;
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
  return <Text style={{ fontSize: 18, lineHeight: 22 }}>G</Text>;
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
