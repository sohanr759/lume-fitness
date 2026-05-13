// Local-only log store (MMKV). No auth, no backend DB.
import { storage } from './cache';

export type Macros = { protein: number; carbs: number; fat: number };

export type FoodLog = {
  id: string;
  ts: number;
  name: string;
  kcal: number;
  macros: Macros;
  portion: string | null;
  confidence: number;
  image_uri: string | null;
  source: string;
};

export type WorkoutLog = {
  id: string;
  ts: number;
  name: string;
  category: 'gym' | 'cardio' | 'sports';
  duration_min: number;
  intensity: string | null;
  kcal_burned: number;
  met: number;
};

const FOOD_KEY = 'food_logs';
const WORKOUT_KEY = 'workout_logs';

function read<T>(key: string): T[] {
  const raw = storage.getString(key);
  return raw ? (JSON.parse(raw) as T[]) : [];
}
function write<T>(key: string, list: T[]) {
  storage.set(key, JSON.stringify(list));
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Food
export function getFoodLogs(sinceTs = 0): FoodLog[] {
  return read<FoodLog>(FOOD_KEY).filter((f) => f.ts >= sinceTs).sort((a, b) => b.ts - a.ts);
}
export function addFoodLog(f: Omit<FoodLog, 'id' | 'ts'> & { ts?: number }): FoodLog {
  const row: FoodLog = { ...f, id: uid(), ts: f.ts ?? Date.now() };
  write(FOOD_KEY, [row, ...read<FoodLog>(FOOD_KEY)].slice(0, 2000));
  return row;
}
export function deleteFoodLog(id: string) {
  write(FOOD_KEY, read<FoodLog>(FOOD_KEY).filter((f) => f.id !== id));
}

// Workout
export function getWorkoutLogs(sinceTs = 0): WorkoutLog[] {
  return read<WorkoutLog>(WORKOUT_KEY).filter((w) => w.ts >= sinceTs).sort((a, b) => b.ts - a.ts);
}
export function addWorkoutLog(w: Omit<WorkoutLog, 'id' | 'ts'> & { ts?: number }): WorkoutLog {
  const row: WorkoutLog = { ...w, id: uid(), ts: w.ts ?? Date.now() };
  write(WORKOUT_KEY, [row, ...read<WorkoutLog>(WORKOUT_KEY)].slice(0, 2000));
  return row;
}
export function deleteWorkoutLog(id: string) {
  write(WORKOUT_KEY, read<WorkoutLog>(WORKOUT_KEY).filter((w) => w.id !== id));
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
