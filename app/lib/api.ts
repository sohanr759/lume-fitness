// Stateless calls to Supabase Edge Functions. No auth, no DB.
// Edge functions only do Gemini + nutrition lookup; persistence is local (MMKV).
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';
import { addFoodLog, addWorkoutLog, FoodLog, WorkoutLog } from './store';
import { rememberFood } from './cache';
import { getProfile } from './profile';

type DetectedItem = {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  portion_g: number;
  confidence: number;
  source: string;
};

type ParsedTextItem = {
  name: string;
  quantity_label: string;
  portion_g: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  source: string;
};

export type BuiltMealItem = {
  name: string;
  quantity_g: number;
  quantity_label: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type BuiltMeal = {
  meal_name: string;
  instructions: string;
  total_kcal: number;
  items: BuiltMealItem[];
};

async function uriToBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

export async function analyzeFoodImage(uri: string): Promise<{ items: FoodLog[]; needsClarification: boolean }> {
  const base64 = await uriToBase64(uri);
  const { data, error } = await supabase.functions.invoke('analyze-food', {
    body: { imageBase64: base64, mimeType: 'image/jpeg' },
  });
  if (error) {
    const body = await (error as any).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? error.message);
  }

  if (!data?.items) return { items: [], needsClarification: false };
  const items: FoodLog[] = [];
  let needsClarification = false;
  for (const it of (data.items as DetectedItem[])) {
    if (it.confidence < 0.6) needsClarification = true;
    const row = addFoodLog({
      name: it.name,
      kcal: it.kcal,
      macros: { protein: it.protein, carbs: it.carbs, fat: it.fat },
      portion: `${it.portion_g} g`,
      confidence: it.confidence,
      image_uri: uri,
      source: it.source,
    });
    items.push(row);
    rememberFood({ name: it.name, kcal: it.kcal, protein: it.protein, carbs: it.carbs, fat: it.fat });
  }
  return { items, needsClarification };
}

export async function logWorkoutText(text: string): Promise<WorkoutLog> {
  const profile = getProfile();
  let invokeResult: { data: any; error: any };
  try {
    invokeResult = await supabase.functions.invoke('log-workout', {
      body: { text, weight_kg: profile?.weight_kg ?? 70 },
    });
  } catch (e) {
    console.error('[logWorkoutText] invoke threw:', e);
    throw e;
  }
  const { data, error } = invokeResult;
  if (error) {
    let body: any = null;
    try { body = await (error as any).context?.json(); } catch {}
    const msg = body?.error ?? error.message ?? 'unknown error';
    console.error('[logWorkoutText] edge fn error:', msg, '\nraw:', error);
    throw new Error(msg);
  }
  if (!data?.name) throw new Error('Invalid workout response from server');
  return addWorkoutLog({
    name: data.name,
    category: data.category,
    duration_min: data.duration_min,
    intensity: data.intensity,
    kcal_burned: data.kcal_burned,
    met: data.met,
  });
}

// Overview: Sends a free-text ingredient list to the analyze-food-text edge function.
//           Gemini parses each item, resolves quantities, and returns macros per stated portion.
// Purpose:  Powers the Text mode of the Log tab — users type or dictate foods instead of taking a photo.
// Inputs:   text — free-text list e.g. "2 bananas, 100g oats, 80g peanut butter"
// Outputs:  { items: FoodLog[], needsClarification: boolean }
// Dependencies: analyze-food-text edge function, addFoodLog, rememberFood
// Notes:    image_uri is null (no photo). Logs items immediately, same as analyzeFoodImage.
export async function analyzeFoodText(
  text: string,
): Promise<{ items: FoodLog[]; needsClarification: boolean }> {
  const { data, error } = await supabase.functions.invoke('analyze-food-text', {
    body: { text },
  });
  if (error) {
    const body = await (error as any).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? error.message);
  }

  if (!data?.items) return { items: [], needsClarification: false };
  const items: FoodLog[] = [];
  let needsClarification = false;
  for (const it of (data.items as ParsedTextItem[])) {
    if (it.confidence < 0.6) needsClarification = true;
    const row = addFoodLog({
      name: it.name,
      kcal: it.kcal,
      macros: { protein: it.protein, carbs: it.carbs, fat: it.fat },
      portion: it.quantity_label,
      confidence: it.confidence,
      image_uri: null,
      source: it.source,
    });
    items.push(row);
    rememberFood({ name: it.name, kcal: it.kcal, protein: it.protein, carbs: it.carbs, fat: it.fat });
  }
  return { items, needsClarification };
}

// Overview: Calls the build-meal edge function to generate a curated meal from available ingredients
//           at a specific calorie target. Does NOT log to the store — logging is deferred to the
//           user confirming via "Log This Meal" in the UI (review-before-commit flow).
// Purpose:  Powers the Build mode of the Log tab.
// Inputs:   ingredients — comma-separated ingredient names
//           targetKcal  — desired calorie total (1–5000)
// Outputs:  BuiltMeal object with meal_name, instructions, total_kcal, and items[]
// Dependencies: build-meal edge function
// Notes:    Call logBuiltMeal() after the user confirms to persist to the local store.
export async function buildMeal(ingredients: string, targetKcal: number): Promise<BuiltMeal> {
  const { data, error } = await supabase.functions.invoke('build-meal', {
    body: { ingredients, target_kcal: targetKcal },
  });
  if (error) {
    const body = await (error as any).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? error.message);
  }
  if (!data?.meal_name || !Array.isArray(data?.items)) {
    throw new Error('Invalid meal response from server');
  }
  return data as BuiltMeal;
}

// Overview: Persists a confirmed BuiltMeal to the local food log store.
//           Called only after the user explicitly taps "Log This Meal".
// Purpose:  Separates the AI generation step (buildMeal) from the commit step.
// Inputs:   meal — BuiltMeal returned by buildMeal()
// Outputs:  FoodLog[] — one entry per ingredient
// Dependencies: addFoodLog, rememberFood
// Notes:    All items use confidence: 1.0 (user reviewed and confirmed).
//           source is "build-meal" for traceability in the store.
export function logBuiltMeal(meal: BuiltMeal): FoodLog[] {
  const logs: FoodLog[] = [];
  for (const it of meal.items) {
    const row = addFoodLog({
      name: it.name,
      kcal: it.kcal,
      macros: { protein: it.protein, carbs: it.carbs, fat: it.fat },
      portion: it.quantity_label,
      confidence: 1.0,
      image_uri: null,
      source: 'build-meal',
    });
    logs.push(row);
    rememberFood({ name: it.name, kcal: it.kcal, protein: it.protein, carbs: it.carbs, fat: it.fat });
  }
  return logs;
}
