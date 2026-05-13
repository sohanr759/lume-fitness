// Sync-over-async storage.
// On app start, call initStorage() to hydrate in-memory cache from AsyncStorage.
// After that, getString/set/delete are synchronous (reads from memory).
// Writes persist to AsyncStorage in the background.
import AsyncStorage from '@react-native-async-storage/async-storage';

const mem: Record<string, string> = {};

export const storage = {
  getString(key: string): string | undefined {
    return mem[key];
  },
  set(key: string, value: string) {
    mem[key] = value;
    AsyncStorage.setItem(key, value).catch(() => {}); // fire-and-forget
  },
  delete(key: string) {
    delete mem[key];
    AsyncStorage.removeItem(key).catch(() => {});
  },
};

export async function initStorage() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const pairs = await AsyncStorage.multiGet(keys as string[]);
    for (const [k, v] of pairs) {
      if (k && v != null) mem[k] = v;
    }
  } catch {
    // first launch or empty — fine
  }
}

// Food suggestion cache (kept here for colocation)
export type CachedFood = {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  hits: number;
  ts: number;
};

const FOODS_KEY = 'recent_foods';

export function getRecentFoods(): CachedFood[] {
  const raw = storage.getString(FOODS_KEY);
  return raw ? (JSON.parse(raw) as CachedFood[]) : [];
}

export function rememberFood(food: Omit<CachedFood, 'hits' | 'ts'>) {
  const list = getRecentFoods();
  const i = list.findIndex((f) => f.name.toLowerCase() === food.name.toLowerCase());
  if (i >= 0) {
    list[i] = { ...list[i], ...food, hits: list[i].hits + 1, ts: Date.now() };
  } else {
    list.unshift({ ...food, hits: 1, ts: Date.now() });
  }
  storage.set(FOODS_KEY, JSON.stringify(list.slice(0, 50)));
}
