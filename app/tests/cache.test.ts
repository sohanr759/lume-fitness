// Tests: lib/cache.ts
// Covers storage set/get/delete, initStorage hydration, rememberFood ranking

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage, initStorage, rememberFood, getRecentFoods } from '@/lib/cache';

// Clear the in-memory cache between tests by deleting all known keys
beforeEach(async () => {
  await AsyncStorage.clear();
  // Clear the internal mem object by deleting all keys via the storage API
  ['key1', 'key2', 'hydrated_key', 'profile', 'food_logs', 'recent_foods'].forEach((k) => {
    storage.delete(k);
  });
});

describe('storage (in-memory)', () => {
  it('returns undefined for missing key', () => {
    expect(storage.getString('missing')).toBeUndefined();
  });

  it('sets and retrieves a value', () => {
    storage.set('key1', 'value1');
    expect(storage.getString('key1')).toBe('value1');
  });

  it('deletes a key', () => {
    storage.set('key2', 'value2');
    storage.delete('key2');
    expect(storage.getString('key2')).toBeUndefined();
  });

  it('overwrite updates the value', () => {
    storage.set('key1', 'first');
    storage.set('key1', 'second');
    expect(storage.getString('key1')).toBe('second');
  });
});

describe('initStorage', () => {
  it('hydrates in-memory cache from AsyncStorage', async () => {
    await AsyncStorage.setItem('hydrated_key', 'hydrated_value');
    await initStorage();
    expect(storage.getString('hydrated_key')).toBe('hydrated_value');
  });

  it('handles empty AsyncStorage without throwing', async () => {
    await expect(initStorage()).resolves.not.toThrow();
  });
});

describe('rememberFood', () => {
  it('stores a new food entry', () => {
    rememberFood({ name: 'Apple', kcal: 80, protein: 0.4, carbs: 21, fat: 0.2 });
    const foods = getRecentFoods();
    expect(foods).toHaveLength(1);
    expect(foods[0].name).toBe('Apple');
    expect(foods[0].hits).toBe(1);
  });

  it('increments hits for the same food (case-insensitive)', () => {
    rememberFood({ name: 'Apple', kcal: 80, protein: 0.4, carbs: 21, fat: 0.2 });
    rememberFood({ name: 'apple', kcal: 80, protein: 0.4, carbs: 21, fat: 0.2 });
    const foods = getRecentFoods();
    expect(foods).toHaveLength(1);
    expect(foods[0].hits).toBe(2);
  });

  it('stores multiple distinct foods', () => {
    rememberFood({ name: 'Apple', kcal: 80, protein: 0.4, carbs: 21, fat: 0.2 });
    rememberFood({ name: 'Banana', kcal: 90, protein: 1, carbs: 23, fat: 0 });
    expect(getRecentFoods()).toHaveLength(2);
  });

  it('most recently added food appears first', () => {
    rememberFood({ name: 'Apple', kcal: 80, protein: 0.4, carbs: 21, fat: 0.2 });
    rememberFood({ name: 'Banana', kcal: 90, protein: 1, carbs: 23, fat: 0 });
    expect(getRecentFoods()[0].name).toBe('Banana');
  });
});
