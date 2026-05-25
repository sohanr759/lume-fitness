// Tests: Auth sequence — route guard, OAuth URL parsing, post-onboarding flow.

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// ─── canSubmit ────────────────────────────────────────────────────────────────
function canSubmit(email: string, password: string, busy: boolean): boolean {
  return email.trim().length > 0 && password.length >= 6 && !busy;
}

describe('canSubmit', () => {
  it('false when email is empty',           () => expect(canSubmit('', 'pass123', false)).toBe(false));
  it('false when email is only whitespace', () => expect(canSubmit('   ', 'pass123', false)).toBe(false));
  it('false when password under 6 chars',   () => expect(canSubmit('a@b.com', '12345', false)).toBe(false));
  it('false when busy',                     () => expect(canSubmit('a@b.com', 'pass123', true)).toBe(false));
  it('true when valid email + pass >= 6',   () => expect(canSubmit('a@b.com', 'pass123', false)).toBe(true));
  it('true when password is exactly 6',     () => expect(canSubmit('a@b.com', '123456', false)).toBe(true));
  it('trims whitespace from email',          () => expect(canSubmit('  a@b.com  ', 'pass123', false)).toBe(true));
});

// ─── isUnconfirmed ────────────────────────────────────────────────────────────
function isUnconfirmed(msg: string): boolean {
  return msg.toLowerCase().includes('email not confirmed') || msg.toLowerCase().includes('not confirmed');
}

describe('isUnconfirmed', () => {
  it('detects "Email not confirmed"',        () => expect(isUnconfirmed('Email not confirmed')).toBe(true));
  it('case-insensitive',                     () => expect(isUnconfirmed('email not confirmed')).toBe(true));
  it('detects partial "not confirmed"',      () => expect(isUnconfirmed('User email is not confirmed')).toBe(true));
  it('false for wrong credentials',          () => expect(isUnconfirmed('Invalid login credentials')).toBe(false));
  it('false for empty string',               () => expect(isUnconfirmed('')).toBe(false));
});

// ─── isOAuthCallback detection ────────────────────────────────────────────────
// Mirrors the logic in supabase.ts — run at module-load time on the URL
// before Expo Router or React can clear it.

function detectOAuthCallback(hash: string, search: string): boolean {
  return hash.includes('access_token=') || new URLSearchParams(search).has('code');
}

describe('detectOAuthCallback (supabase.ts logic)', () => {
  it('detects implicit flow token in hash',  () => expect(detectOAuthCallback('#access_token=ABC&refresh_token=XYZ', '')).toBe(true));
  it('detects PKCE code in search params',   () => expect(detectOAuthCallback('', '?code=abc123')).toBe(true));
  it('false when neither present',           () => expect(detectOAuthCallback('', '')).toBe(false));
  it('false for unrelated hash/params',      () => expect(detectOAuthCallback('#foo=bar', '?baz=qux')).toBe(false));
});

// ─── Implicit token parsing ───────────────────────────────────────────────────
function parseImplicitTokens(hash: string) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  return { accessToken: p.get('access_token'), refreshToken: p.get('refresh_token') };
}

describe('parseImplicitTokens (supabase.ts logic)', () => {
  it('extracts both tokens',           () => expect(parseImplicitTokens('#access_token=A&refresh_token=R&expires_in=3600')).toEqual({ accessToken: 'A', refreshToken: 'R' }));
  it('returns null for missing token', () => expect(parseImplicitTokens('#access_token=A')).toEqual({ accessToken: 'A', refreshToken: null }));
  it('handles hash without leading #', () => expect(parseImplicitTokens('access_token=A&refresh_token=R')).toEqual({ accessToken: 'A', refreshToken: 'R' }));
  it('returns nulls for empty hash',   () => expect(parseImplicitTokens('')).toEqual({ accessToken: null, refreshToken: null }));
});

// ─── PKCE URL reconstruction ──────────────────────────────────────────────────
function buildExchangeUrl(origin: string, pathname: string, search: string): string {
  return `${origin}${pathname}${search}`;
}

describe('buildExchangeUrl (supabase.ts logic)', () => {
  it('builds correct URL for exchangeCodeForSession', () =>
    expect(buildExchangeUrl('https://app.lume.com', '/callback', '?code=abc123'))
      .toBe('https://app.lume.com/callback?code=abc123'));
  it('preserves additional query params', () =>
    expect(buildExchangeUrl('https://app.lume.com', '/callback', '?code=abc&state=xyz'))
      .toBe('https://app.lume.com/callback?code=abc&state=xyz'));
});

// ─── OAuth provider error parsing ────────────────────────────────────────────
function parseOAuthProviderError(search: string): string | null {
  const p = new URLSearchParams(search);
  return p.get('error_description') ?? p.get('error') ?? null;
}

describe('parseOAuthProviderError (supabase.ts logic)', () => {
  it('prefers error_description over error', () =>
    expect(parseOAuthProviderError('?error=access_denied&error_description=Permissions+denied'))
      .toBe('Permissions denied'));
  it('falls back to error when no description', () =>
    expect(parseOAuthProviderError('?error=access_denied')).toBe('access_denied'));
  it('returns null when no error',  () => expect(parseOAuthProviderError('')).toBeNull());
  it('null for unrelated params',   () => expect(parseOAuthProviderError('?code=abc123')).toBeNull());
});

// ─── Route guard ──────────────────────────────────────────────────────────────
// Mirrors _layout.tsx. waitingForOAuth is initialised from isOAuthCallback
// (supabase.ts) and cleared when SIGNED_IN fires or the 10 s timeout fires.

type Profile = { name: string };
type RouteDecision = 'stay' | '/(auth)' | '/(auth)+error' | '/onboarding' | '/';

function routeGuard(p: {
  session:        object | null;
  profile:        Profile | null;
  cachedProfile:  Profile | null;
  seg0:           string;
  sessionChanged: boolean;
  waitingForOAuth: boolean;
  oauthProviderError: string | null;
}): RouteDecision {
  const { session, profile, cachedProfile, seg0, sessionChanged, waitingForOAuth, oauthProviderError } = p;

  if (waitingForOAuth) return 'stay'; // exchange in flight — never redirect prematurely

  const inAuth       = seg0 === '(auth)';
  const inOnboarding = seg0 === 'onboarding';
  const inCallback   = seg0 === 'callback';

  if (!session) {
    if (inAuth) return 'stay';
    return oauthProviderError ? '/(auth)+error' : '/(auth)';
  }

  if (sessionChanged && profile === null) return 'stay'; // stale null — wait for re-fetch

  const resolved = profile ?? cachedProfile;
  if (!resolved && !inOnboarding) return '/onboarding';
  if (resolved  && (inAuth || inOnboarding || inCallback)) return '/';
  return 'stay';
}

const S = { user: { id: '1' } };
const P: Profile = { name: 'Sohan' };

describe('routeGuard — waitingForOAuth blocks all redirects', () => {
  it('stays regardless of session/profile when exchange is in flight', () => {
    expect(routeGuard({ session: null,  profile: null, cachedProfile: null, seg0: 'callback', sessionChanged: false, waitingForOAuth: true,  oauthProviderError: null })).toBe('stay');
    expect(routeGuard({ session: S,     profile: null, cachedProfile: null, seg0: 'callback', sessionChanged: false, waitingForOAuth: true,  oauthProviderError: null })).toBe('stay');
    expect(routeGuard({ session: null,  profile: null, cachedProfile: null, seg0: '(auth)',   sessionChanged: false, waitingForOAuth: true,  oauthProviderError: null })).toBe('stay');
  });
});

describe('routeGuard — no session, exchange settled', () => {
  it('redirects to /(auth) from any non-auth route', () => {
    expect(routeGuard({ session: null, profile: null, cachedProfile: null, seg0: '(tabs)',    sessionChanged: false, waitingForOAuth: false, oauthProviderError: null })).toBe('/(auth)');
    expect(routeGuard({ session: null, profile: null, cachedProfile: null, seg0: 'callback',  sessionChanged: false, waitingForOAuth: false, oauthProviderError: null })).toBe('/(auth)');
    expect(routeGuard({ session: null, profile: null, cachedProfile: null, seg0: 'onboarding',sessionChanged: false, waitingForOAuth: false, oauthProviderError: null })).toBe('/(auth)');
  });
  it('stays when already on /(auth)', () =>
    expect(routeGuard({ session: null, profile: null, cachedProfile: null, seg0: '(auth)', sessionChanged: false, waitingForOAuth: false, oauthProviderError: null })).toBe('stay'));
  it('carries provider error to /(auth)', () =>
    expect(routeGuard({ session: null, profile: null, cachedProfile: null, seg0: 'callback', sessionChanged: false, waitingForOAuth: false, oauthProviderError: 'access_denied' })).toBe('/(auth)+error'));
});

describe('routeGuard — stale profile=null on session change', () => {
  // Sign-in: session went null→active. profile=null is from the signed-out state.
  // The profile effect will reset to undefined and re-fetch — guard must hold.
  it('holds when session just changed and profile is stale null', () => {
    expect(routeGuard({ session: S, profile: null, cachedProfile: null, seg0: '(auth)',   sessionChanged: true, waitingForOAuth: false, oauthProviderError: null })).toBe('stay');
    expect(routeGuard({ session: S, profile: null, cachedProfile: null, seg0: 'callback', sessionChanged: true, waitingForOAuth: false, oauthProviderError: null })).toBe('stay');
  });
  it('proceeds when session changed but profile is already loaded', () =>
    expect(routeGuard({ session: S, profile: P, cachedProfile: P, seg0: '(auth)', sessionChanged: true, waitingForOAuth: false, oauthProviderError: null })).toBe('/'));
});

describe('routeGuard — session active, no profile (new user)', () => {
  it('sends to /onboarding from any non-onboarding route', () => {
    expect(routeGuard({ session: S, profile: null, cachedProfile: null, seg0: '(auth)',   sessionChanged: false, waitingForOAuth: false, oauthProviderError: null })).toBe('/onboarding');
    expect(routeGuard({ session: S, profile: null, cachedProfile: null, seg0: '(tabs)',   sessionChanged: false, waitingForOAuth: false, oauthProviderError: null })).toBe('/onboarding');
    expect(routeGuard({ session: S, profile: null, cachedProfile: null, seg0: 'callback', sessionChanged: false, waitingForOAuth: false, oauthProviderError: null })).toBe('/onboarding');
  });
  it('stays on /onboarding', () =>
    expect(routeGuard({ session: S, profile: null, cachedProfile: null, seg0: 'onboarding', sessionChanged: false, waitingForOAuth: false, oauthProviderError: null })).toBe('stay'));
});

describe('routeGuard — session active, profile loaded', () => {
  it('exits auth/onboarding/callback to /', () => {
    expect(routeGuard({ session: S, profile: P, cachedProfile: P, seg0: '(auth)',    sessionChanged: false, waitingForOAuth: false, oauthProviderError: null })).toBe('/');
    expect(routeGuard({ session: S, profile: P, cachedProfile: P, seg0: 'onboarding',sessionChanged: false, waitingForOAuth: false, oauthProviderError: null })).toBe('/');
    expect(routeGuard({ session: S, profile: P, cachedProfile: P, seg0: 'callback',  sessionChanged: false, waitingForOAuth: false, oauthProviderError: null })).toBe('/');
  });
  it('stays on tabs', () =>
    expect(routeGuard({ session: S, profile: P, cachedProfile: P, seg0: '(tabs)', sessionChanged: false, waitingForOAuth: false, oauthProviderError: null })).toBe('stay'));
});

describe('routeGuard — post-onboarding cache fallback', () => {
  // saveProfile() writes cache synchronously. router.replace('/') fires.
  // Layout profile state is still null (not re-fetched since session unchanged).
  // resolvedProfile = profile ?? getProfileCached() → cache hit → stay at /.
  it('stays at / when state is null but cache has profile', () =>
    expect(routeGuard({ session: S, profile: null, cachedProfile: P, seg0: '(tabs)', sessionChanged: false, waitingForOAuth: false, oauthProviderError: null })).toBe('stay'));
  it('redirects to /onboarding when both state and cache are null', () =>
    expect(routeGuard({ session: S, profile: null, cachedProfile: null, seg0: '(tabs)', sessionChanged: false, waitingForOAuth: false, oauthProviderError: null })).toBe('/onboarding'));
});
