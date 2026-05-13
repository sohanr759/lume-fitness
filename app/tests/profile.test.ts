// Tests: lib/profile.ts
// Covers saveProfile, getProfile, updateProfile, computeGoalKcal, clearProfile

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// Use an in-memory storage mock so tests are isolated
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

import { saveProfile, getProfile, updateProfile, clearProfile, computeGoalKcal } from '@/lib/profile';

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
  });

  it('saves and retrieves a profile', () => {
    const saved = saveProfile(base);
    expect(saved.name).toBe('Sohan');
    expect(saved.goal_kcal).toBeGreaterThan(0);
    expect(saved.created_at).toBeLessThanOrEqual(Date.now());

    const got = getProfile();
    expect(got).not.toBeNull();
    expect(got!.name).toBe('Sohan');
  });

  it('goal_kcal matches computeGoalKcal', () => {
    const saved = saveProfile(base);
    expect(saved.goal_kcal).toBe(computeGoalKcal(base));
  });
});

describe('updateProfile', () => {
  it('preserves original created_at', () => {
    const original = saveProfile(base);
    const updated = updateProfile({ ...base, name: 'Updated' });
    expect(updated.created_at).toBe(original.created_at);
    expect(updated.name).toBe('Updated');
  });

  it('recalculates goal_kcal on update', () => {
    saveProfile(base);
    const updated = updateProfile({ ...base, goal: 'lose' });
    expect(updated.goal_kcal).toBe(computeGoalKcal({ ...base, goal: 'lose' }));
  });
});

describe('clearProfile', () => {
  it('removes profile from storage', () => {
    saveProfile(base);
    clearProfile();
    expect(getProfile()).toBeNull();
  });
});
