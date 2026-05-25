// Tests: Auth sequence — route guard decisions, OAuth URL parsing, post-onboarding flow.

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// ─── canSubmit ────────────────────────────────────────────────────────────────
function canSubmit(email: string, password: string, busy: boolean): boolean {
  return email.trim().length > 0 && password.length >= 6 && !busy;
}

describe('canSubmit', () => {
  it('false when email is empty', () => expect(canSubmit('', 'pass123', false)).toBe(false));
  it('false when email is only whitespace', () => expect(canSubmit('   ', 'pass123', false)).toBe(false));
  it('false when password under 6 chars', () => expect(canSubmit('a@b.com', '12345', false)).toBe(false));
  it('false when busy', () => expect(canSubmit('a@b.com', 'pass123', true)).toBe(false));
  it('true when valid email + password >= 6 + not busy', () => expect(canSubmit('a@b.com', 'pass123', false)).toBe(true));
  it('true when password is exactly 6 chars', () => expect(canSubmit('a@b.com', '123456', false)).toBe(true));
  it('trims whitespace from email', () => expect(canSubmit('  a@b.com  ', 'pass123', false)).toBe(true));
});

// ─── isUnconfirmed ────────────────────────────────────────────────────────────
function isUnconfirmed(msg: string): boolean {
  return msg.toLowerCase().includes('email not confirmed') || msg.toLowerCase().includes('not confirmed');
}

describe('isUnconfirmed', () => {
  it('detects "Email not confirmed"', () => expect(isUnconfirmed('Email not confirmed')).toBe(true));
  it('case-insensitive', () => expect(isUnconfirmed('email not confirmed')).toBe(true));
  it('detects partial "not confirmed"', () => expect(isUnconfirmed('User email is not confirmed')).toBe(true));
  it('false for wrong credentials', () => expect(isUnconfirmed('Invalid login credentials')).toBe(false));
  it('false for empty string', () => expect(isUnconfirmed('')).toBe(false));
});

// ─── Route guard ──────────────────────────────────────────────────────────────
// Mirrors the guard in _layout.tsx. No waitingForOAuth — Supabase handles the
// exchange internally; the splash (session===undefined) covers that period.

type Profile = { name: string };
type RouteDecision = 'stay' | '/(auth)' | '/(auth)+error' | '/onboarding' | '/';

function routeGuard(params: {
  session: object | null;        // null = signed out
  profile: Profile | null;       // null = no profile (not in-flight)
  cachedProfile: Profile | null; // what getProfileCached() returns
  seg0: string;
  sessionChanged: boolean;
  oauthError: string | null;     // captured from URL at module load
}): RouteDecision {
  const { session, profile, cachedProfile, seg0, sessionChanged, oauthError } = params;

  const inAuth       = seg0 === '(auth)';
  const inOnboarding = seg0 === 'onboarding';
  const inCallback   = seg0 === 'callback';

  if (!session) {
    if (inAuth) return 'stay';
    return oauthError ? '/(auth)+error' : '/(auth)';
  }

  // Stale profile=null from signed-out state — profile effect is re-fetching.
  if (sessionChanged && profile === null) return 'stay';

  const resolvedProfile = profile ?? cachedProfile;

  if (!resolvedProfile && !inOnboarding) return '/onboarding';
  if (resolvedProfile && (inAuth || inOnboarding || inCallback)) return '/';
  return 'stay';
}

const SESSION = { user: { id: '1' } };
const PROFILE: Profile = { name: 'Sohan' };

describe('routeGuard — no session', () => {
  it('redirects to /(auth) from any non-auth route', () => {
    expect(routeGuard({ session: null, profile: null, cachedProfile: null, seg0: '(tabs)', sessionChanged: false, oauthError: null })).toBe('/(auth)');
    expect(routeGuard({ session: null, profile: null, cachedProfile: null, seg0: 'callback', sessionChanged: false, oauthError: null })).toBe('/(auth)');
    expect(routeGuard({ session: null, profile: null, cachedProfile: null, seg0: 'onboarding', sessionChanged: false, oauthError: null })).toBe('/(auth)');
  });

  it('stays when already on /(auth)', () => {
    expect(routeGuard({ session: null, profile: null, cachedProfile: null, seg0: '(auth)', sessionChanged: false, oauthError: null })).toBe('stay');
  });

  it('carries oauth error to /(auth) when provider returned an error', () => {
    expect(routeGuard({ session: null, profile: null, cachedProfile: null, seg0: 'callback', sessionChanged: false, oauthError: 'access_denied' })).toBe('/(auth)+error');
    expect(routeGuard({ session: null, profile: null, cachedProfile: null, seg0: '(tabs)', sessionChanged: false, oauthError: 'Permissions denied by user' })).toBe('/(auth)+error');
  });
});

describe('routeGuard — stale profile=null after sign-in (sessionChanged guard)', () => {
  // When the user signs in, session goes null→active in one render.
  // profile=null is stale from the signed-out state; fetchProfile hasn't run yet.
  // The guard must hold and not redirect to /onboarding prematurely.
  it('holds when session just changed and profile is stale null', () => {
    expect(routeGuard({ session: SESSION, profile: null, cachedProfile: null, seg0: '(auth)', sessionChanged: true, oauthError: null })).toBe('stay');
    expect(routeGuard({ session: SESSION, profile: null, cachedProfile: null, seg0: 'callback', sessionChanged: true, oauthError: null })).toBe('stay');
  });

  it('does not hold when session changed but profile is already loaded', () => {
    // fetchProfile resolved quickly — no need to wait
    expect(routeGuard({ session: SESSION, profile: PROFILE, cachedProfile: PROFILE, seg0: '(auth)', sessionChanged: true, oauthError: null })).toBe('/');
  });
});

describe('routeGuard — session active, no profile (new user)', () => {
  it('sends to /onboarding from any non-onboarding route', () => {
    expect(routeGuard({ session: SESSION, profile: null, cachedProfile: null, seg0: '(auth)',    sessionChanged: false, oauthError: null })).toBe('/onboarding');
    expect(routeGuard({ session: SESSION, profile: null, cachedProfile: null, seg0: '(tabs)',    sessionChanged: false, oauthError: null })).toBe('/onboarding');
    expect(routeGuard({ session: SESSION, profile: null, cachedProfile: null, seg0: 'callback',  sessionChanged: false, oauthError: null })).toBe('/onboarding');
  });

  it('stays when already on /onboarding', () => {
    expect(routeGuard({ session: SESSION, profile: null, cachedProfile: null, seg0: 'onboarding', sessionChanged: false, oauthError: null })).toBe('stay');
  });
});

describe('routeGuard — session active, profile loaded', () => {
  it('navigates to / from auth / onboarding / callback', () => {
    expect(routeGuard({ session: SESSION, profile: PROFILE, cachedProfile: PROFILE, seg0: '(auth)',    sessionChanged: false, oauthError: null })).toBe('/');
    expect(routeGuard({ session: SESSION, profile: PROFILE, cachedProfile: PROFILE, seg0: 'onboarding', sessionChanged: false, oauthError: null })).toBe('/');
    expect(routeGuard({ session: SESSION, profile: PROFILE, cachedProfile: PROFILE, seg0: 'callback',  sessionChanged: false, oauthError: null })).toBe('/');
  });

  it('stays on tabs', () => {
    expect(routeGuard({ session: SESSION, profile: PROFILE, cachedProfile: PROFILE, seg0: '(tabs)', sessionChanged: false, oauthError: null })).toBe('stay');
  });
});

describe('routeGuard — post-onboarding cache fallback', () => {
  // saveProfile() writes to cache synchronously, then router.replace('/') fires.
  // The layout's profile React state is still null (fetchProfile was called before
  // onboarding and returned null; session didn't change so it wasn't re-fetched).
  // resolvedProfile = profile ?? getProfileCached() must find the profile in cache.

  it('stays at / when state is null but cache has the profile', () => {
    expect(routeGuard({ session: SESSION, profile: null, cachedProfile: PROFILE, seg0: '(tabs)', sessionChanged: false, oauthError: null })).toBe('stay');
  });

  it('redirects to /onboarding when both state and cache are null', () => {
    expect(routeGuard({ session: SESSION, profile: null, cachedProfile: null, seg0: '(tabs)', sessionChanged: false, oauthError: null })).toBe('/onboarding');
  });

  it('navigates away from /onboarding when cache has profile (guard re-fires after seg0 changes)', () => {
    // After router.replace('/'), seg0 changes from 'onboarding' to '(tabs)'.
    // profile state = null, cache = PROFILE → resolvedProfile is truthy → stay.
    expect(routeGuard({ session: SESSION, profile: null, cachedProfile: PROFILE, seg0: '(tabs)', sessionChanged: false, oauthError: null })).toBe('stay');
  });
});

// ─── OAuth error URL parsing ──────────────────────────────────────────────────
// _oauthError in _layout.tsx captures provider errors from the redirect URL.
// These come as ?error_description=... or ?error=... (Google / Supabase convention).

function parseOAuthError(search: string): string | null {
  const p = new URLSearchParams(search);
  return p.get('error_description') ?? p.get('error') ?? null;
}

describe('parseOAuthError', () => {
  it('returns error_description when present', () => {
    expect(parseOAuthError('?error=access_denied&error_description=Permissions+denied')).toBe('Permissions denied');
  });

  it('falls back to error when error_description is absent', () => {
    expect(parseOAuthError('?error=access_denied')).toBe('access_denied');
  });

  it('returns null when no error params', () => {
    expect(parseOAuthError('')).toBeNull();
    expect(parseOAuthError('?code=abc123')).toBeNull();
  });

  it('returns null for unrelated query params', () => {
    expect(parseOAuthError('?foo=bar&baz=qux')).toBeNull();
  });
});
