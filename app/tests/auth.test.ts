// Tests: Auth screen logic
// Covers canSubmit conditions, isUnconfirmed detection, and route guard decisions

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// ── canSubmit logic (extracted from auth screen) ──────────────────────────────
function canSubmit(email: string, password: string, busy: boolean): boolean {
  return email.trim().length > 0 && password.length >= 6 && !busy;
}

describe('canSubmit', () => {
  it('false when email is empty', () => {
    expect(canSubmit('', 'password123', false)).toBe(false);
  });

  it('false when email is only whitespace', () => {
    expect(canSubmit('   ', 'password123', false)).toBe(false);
  });

  it('false when password is under 6 chars', () => {
    expect(canSubmit('test@example.com', '12345', false)).toBe(false);
  });

  it('false when busy', () => {
    expect(canSubmit('test@example.com', 'password123', true)).toBe(false);
  });

  it('true when valid email + password >= 6 + not busy', () => {
    expect(canSubmit('test@example.com', 'password123', false)).toBe(true);
  });

  it('true when password is exactly 6 chars', () => {
    expect(canSubmit('test@example.com', '123456', false)).toBe(true);
  });

  it('trims whitespace from email before checking', () => {
    expect(canSubmit('  test@example.com  ', 'password123', false)).toBe(true);
  });
});

// ── isUnconfirmed detection ───────────────────────────────────────────────────
function isUnconfirmed(msg: string): boolean {
  return (
    msg.toLowerCase().includes('email not confirmed') ||
    msg.toLowerCase().includes('not confirmed')
  );
}

describe('isUnconfirmed', () => {
  it('detects "Email not confirmed" (Supabase default message)', () => {
    expect(isUnconfirmed('Email not confirmed')).toBe(true);
  });

  it('detects lowercase variant', () => {
    expect(isUnconfirmed('email not confirmed')).toBe(true);
  });

  it('detects partial "not confirmed"', () => {
    expect(isUnconfirmed('User email is not confirmed')).toBe(true);
  });

  it('returns false for wrong credentials error', () => {
    expect(isUnconfirmed('Invalid login credentials')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isUnconfirmed('')).toBe(false);
  });
});

// ── Route guard decisions ─────────────────────────────────────────────────────
type RouteDecision = 'stay' | '/(auth)' | '/onboarding' | '/';

function routeGuardDecision(
  session: object | null,
  profile: object | null,
  seg0: string
): RouteDecision {
  const inAuth = seg0 === '(auth)';
  const inOnboarding = seg0 === 'onboarding';

  if (!session) {
    return inAuth ? 'stay' : '/(auth)';
  }
  if (!profile && !inOnboarding) return '/onboarding';
  if (profile && (inAuth || inOnboarding)) return '/';
  return 'stay';
}

const SESSION = { user: { id: '1' } };
const PROFILE = { name: 'Sohan' };

describe('routeGuardDecision', () => {
  it('no session + not on auth → navigate to auth', () => {
    expect(routeGuardDecision(null, null, '(tabs)')).toBe('/(auth)');
  });

  it('no session + already on auth → stay', () => {
    expect(routeGuardDecision(null, null, '(auth)')).toBe('stay');
  });

  it('session + no profile + not on onboarding → navigate to onboarding', () => {
    expect(routeGuardDecision(SESSION, null, '(auth)')).toBe('/onboarding');
    expect(routeGuardDecision(SESSION, null, '(tabs)')).toBe('/onboarding');
  });

  it('session + no profile + already on onboarding → stay', () => {
    expect(routeGuardDecision(SESSION, null, 'onboarding')).toBe('stay');
  });

  it('session + profile + on auth → navigate to tabs', () => {
    expect(routeGuardDecision(SESSION, PROFILE, '(auth)')).toBe('/');
  });

  it('session + profile + on onboarding → navigate to tabs', () => {
    expect(routeGuardDecision(SESSION, PROFILE, 'onboarding')).toBe('/');
  });

  it('session + profile + on tabs → stay', () => {
    expect(routeGuardDecision(SESSION, PROFILE, '(tabs)')).toBe('stay');
  });
});
