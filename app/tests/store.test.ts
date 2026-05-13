// Tests: lib/store.ts
// Covers addFoodLog, getFoodLogs, deleteFoodLog, addWorkoutLog, getWorkoutLogs, deleteWorkoutLog, startOfToday

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

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

import {
  addFoodLog, getFoodLogs, deleteFoodLog,
  addWorkoutLog, getWorkoutLogs, deleteWorkoutLog,
  startOfToday,
} from '@/lib/store';

beforeEach(() => {
  Object.keys(mem).forEach((k) => delete mem[k]);
});

const foodPayload = {
  name: 'Banana',
  kcal: 90,
  macros: { protein: 1, carbs: 23, fat: 0 },
  portion: '1 medium',
  confidence: 0.95,
  image_uri: null,
  source: 'gemini-text',
};

const workoutPayload = {
  name: 'Running',
  category: 'cardio' as const,
  duration_min: 30,
  intensity: 'moderate',
  kcal_burned: 300,
  met: 8,
};

describe('FoodLog', () => {
  it('returns empty array when no logs', () => {
    expect(getFoodLogs()).toEqual([]);
  });

  it('adds and retrieves a food log', () => {
    const entry = addFoodLog(foodPayload);
    expect(entry.id).toBeTruthy();
    expect(entry.name).toBe('Banana');
    expect(entry.kcal).toBe(90);
    expect(entry.ts).toBeLessThanOrEqual(Date.now());

    const logs = getFoodLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe(entry.id);
  });

  it('multiple entries are returned newest-first', () => {
    const a = addFoodLog({ ...foodPayload, name: 'Apple', ts: 1000 });
    const b = addFoodLog({ ...foodPayload, name: 'Banana', ts: 2000 });
    const logs = getFoodLogs();
    expect(logs[0].id).toBe(b.id);
    expect(logs[1].id).toBe(a.id);
  });

  it('filters by sinceTs', () => {
    addFoodLog({ ...foodPayload, ts: 500 });
    addFoodLog({ ...foodPayload, ts: 1500 });
    const logs = getFoodLogs(1000);
    expect(logs).toHaveLength(1);
    expect(logs[0].ts).toBe(1500);
  });

  it('deletes a food log by id', () => {
    const entry = addFoodLog(foodPayload);
    deleteFoodLog(entry.id);
    expect(getFoodLogs()).toHaveLength(0);
  });

  it('delete is a no-op for unknown id', () => {
    addFoodLog(foodPayload);
    deleteFoodLog('nonexistent');
    expect(getFoodLogs()).toHaveLength(1);
  });
});

describe('WorkoutLog', () => {
  it('adds and retrieves a workout log', () => {
    const entry = addWorkoutLog(workoutPayload);
    expect(entry.name).toBe('Running');
    expect(entry.kcal_burned).toBe(300);

    const logs = getWorkoutLogs();
    expect(logs).toHaveLength(1);
  });

  it('deletes a workout log by id', () => {
    const entry = addWorkoutLog(workoutPayload);
    deleteWorkoutLog(entry.id);
    expect(getWorkoutLogs()).toHaveLength(0);
  });
});

describe('startOfToday', () => {
  it('returns a timestamp at midnight of today', () => {
    const ts = startOfToday();
    const d = new Date(ts);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });

  it('is less than or equal to now', () => {
    expect(startOfToday()).toBeLessThanOrEqual(Date.now());
  });
});
