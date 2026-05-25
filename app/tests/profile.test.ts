// Tests: lib/profile.ts
// Covers saveProfile, getProfile, updateProfile, clearProfile, computeGoalKcal
//
// Supabase is mocked so these tests exercise local-cache logic only.
// getSession returns null → saveProfile/updateProfile skip the remote upsert.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// In-memory storage mock so tests are isolated
const mem: Record<string, string> = {};
jest.mock('@/lib/cache', () => ({
  storage: {
    getString: (k: string) => mem[k],
    set: (k: string, v: string) => { mem[k] = v; },
    delete: (k: string) => { delete mem[k]; },
  },
  initStorage: jest.fn(),
  rememberFood: jest.fn(),
  getRecentFoods: jest.fn(() => []),
}));

// Supabase mock — no session so remote calls are skipped
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

import {
  saveProfile,
  getProfile,
  getProfileCached,
  updateProfile,
  clearProfile,
  computeGoalKcal,
} from '@/lib/profile';

const base = {
  name: 'Sohan',
  sex: 'male' as const,
  age: 25,
  height_cm: 175,
  weight_kg: 75,
  goal: 'maintain' as const,
  activity: 'moderate' as const,
};

beforeEach(() => {
  Object.keys(mem).forEach((k) => delete mem[k]);
});

describe('computeGoalKcal', () => {
  it('returns a positive number for a typical male maintain profile', () => {
    const kcal = computeGoalKcal(base);
    expect(kcal).toBeGreaterThan(1500);
    expect(kcal).toBeLessThan(4000);
  });

  it('is lower for lose goal than maintain', () => {
    const maintain = computeGoalKcal({ ...base, goal: 'maintain' });
    const lose = computeGoalKcal({ ...base, goal: 'lose' });
    expect(lose).toBeLessThan(maintain);
  });

  it('is higher for gain goal than maintain', () => {
    const maintain = computeGoalKcal({ ...base, goal: 'maintain' });
    const gain = computeGoalKcal({ ...base, goal: 'gain' });
    expect(gain).toBeGreaterThan(maintain);
  });

  it('returns lower kcal for female vs male (same stats)', () => {
    const male = computeGoalKcal({ ...base, sex: 'male' });
    const female = computeGoalKcal({ ...base, sex: 'female' });
    expect(female).toBeLessThan(male);
  });
});

describe('saveProfile / getProfile', () => {
  it('returns null when no profile saved', () => {
    expect(getProfile()).toBeNull();
    expect(getProfileCached()).toBeNull();
  });

  it('saves and retrieves a profile', async () => {
    const saved = await saveProfile(base);
    expect(saved.name).toBe('Sohan');
    expect(saved.goal_kcal).toBeGreaterThan(0);
    expect(saved.created_at).toBeLessThanOrEqual(Date.now());

    const got = getProfile();
    expect(got).not.toBeNull();
    expect(got!.name).toBe('Sohan');
  });

  it('goal_kcal matches computeGoalKcal', async () => {
    const saved = await saveProfile(base);
    expect(saved.goal_kcal).toBe(computeGoalKcal(base));
  });
});

describe('updateProfile', () => {
  it('preserves original created_at', async () => {
    const original = await saveProfile(base);
    const updated = await updateProfile({ ...base, name: 'Updated' });
    expect(updated.created_at).toBe(original.created_at);
    expect(updated.name).toBe('Updated');
  });

  it('recalculates goal_kcal on update', async () => {
    await saveProfile(base);
    const updated = await updateProfile({ ...base, goal: 'lose' });
    expect(updated.goal_kcal).toBe(computeGoalKcal({ ...base, goal: 'lose' }));
  });
});

describe('clearProfile', () => {
  it('removes profile from storage', async () => {
    await saveProfile(base);
    clearProfile();
    expect(getProfile()).toBeNull();
  });
});
