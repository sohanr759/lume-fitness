import { storage } from './cache';
import { supabase } from './supabase';

export type Sex = 'male' | 'female' | 'other';
export type Goal = 'lose' | 'maintain' | 'gain';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';

export type Profile = {
  name: string;
  sex: Sex;
  age: number;
  height_cm: number;
  weight_kg: number;
  goal: Goal;
  activity: Activity;
  goal_kcal: number;
  created_at: number;
};

const KEY = 'profile';

// Synchronous local-cache read — only valid after initStorage() resolves.
// Prefer fetchProfile() for the authoritative value.
export function getProfileCached(): Profile | null {
  const raw = storage.getString(KEY);
  return raw ? (JSON.parse(raw) as Profile) : null;
}

// Alias used by local-only callers (e.g. unit tests that mock Supabase).
export const getProfile = getProfileCached;

// Fetch from Supabase (source of truth), write to local cache, return result.
// Returns null if the user has no profile row yet.
// Accepts userId directly — avoids an internal getSession() call that can
// return null in the brief window after INITIAL_SESSION fires on native.
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('name, sex, age, height_cm, weight_kg, goal, activity, goal_kcal, created_at')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  const profile = data as Profile;
  storage.set(KEY, JSON.stringify(profile));
  return profile;
}

// Save profile to Supabase and local cache.
// userId is passed in from the caller (available in _layout.tsx via session.user.id)
// to avoid calling supabase.auth.getSession() here — in Supabase auth-js v2.103+
// getSession() re-validates the stored session and can fire SIGNED_OUT if the
// session fails internal validation, booting the user back to the auth screen.
export async function saveProfile(
  p: Omit<Profile, 'goal_kcal' | 'created_at'>,
  userId: string | null,
): Promise<Profile> {
  const goal_kcal = computeGoalKcal(p);
  const full: Profile = { ...p, goal_kcal, created_at: Date.now() };

  storage.set(KEY, JSON.stringify(full));

  if (userId) {
    const { error } = await supabase.from('profiles').upsert({ id: userId, ...full });
    if (error) throw new Error(error.message);
  }

  return full;
}

// Update an existing profile — recalculates goal_kcal, preserves original created_at.
export async function updateProfile(
  p: Omit<Profile, 'goal_kcal' | 'created_at'>,
  userId: string | null,
): Promise<Profile> {
  const existing = getProfileCached();
  const goal_kcal = computeGoalKcal(p);
  const full: Profile = { ...p, goal_kcal, created_at: existing?.created_at ?? Date.now() };

  storage.set(KEY, JSON.stringify(full));

  if (userId) {
    const { error } = await supabase.from('profiles').upsert({ id: userId, ...full });
    if (error) throw new Error(error.message);
  }

  return full;
}

export function clearProfile() {
  storage.delete(KEY);
}

// Wipe all local user data. Call this before signing out.
export function clearAllLocalData() {
  storage.delete('profile');
  storage.delete('food_logs');
  storage.delete('workout_logs');
  storage.delete('recent_foods');
}

// Mifflin–St Jeor BMR × activity × goal adjustment
export function computeGoalKcal(p: Pick<Profile, 'sex' | 'age' | 'height_cm' | 'weight_kg' | 'activity' | 'goal'>) {
  const base = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age;
  const bmr = p.sex === 'male' ? base + 5 : p.sex === 'female' ? base - 161 : base - 78;
  const factor = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9 }[p.activity];
  const tdee = bmr * factor;
  const adj = p.goal === 'lose' ? -500 : p.goal === 'gain' ? 350 : 0;
  return Math.round(tdee + adj);
}
