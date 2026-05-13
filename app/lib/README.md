# lib — Business Logic & Storage

All non-UI logic: local persistence, profile management, edge-function calls, caching, theming, and haptics. Nothing in this folder renders UI.

## Overview

The library layer is the single source of truth for data access. Screens and components import from here and never touch storage or network directly.

## Files

| File | Description |
|------|-------------|
| `store.ts` | **Primary log store (MMKV).** Exports typed CRUD functions for `FoodLog` and `WorkoutLog`. Logs are stored as JSON arrays under the keys `food_logs` and `workout_logs`, capped at 2 000 entries each. Provides `startOfToday()` and `uid()` helpers. |
| `profile.ts` | **User profile (MMKV).** Stores name, biometrics, goal, and activity level. `saveProfile()` runs the Mifflin–St Jeor × activity-factor formula to compute and persist `goal_kcal`. `clearProfile()` triggers the onboarding gate on next launch. |
| `cache.ts` | **Recent-foods cache (MMKV).** Keeps a rolling list of the last ~50 foods the user has logged. Used to surface quick-add suggestions without a network call. Exports `rememberFood()` and `getRecentFoods()`. |
| `api.ts` | **Edge function client.** `analyzeFoodImage(uri)` converts a photo URI to base64, invokes the `analyze-food` edge function, and persists each returned item via `addFoodLog` + `rememberFood`. `logWorkoutText(text)` sends a description to `log-workout` and persists the result via `addWorkoutLog`. Surfaces `needsClarification` when confidence < 0.6. |
| `supabase.ts` | **Supabase client (functions-only).** Initialises the Supabase JS client with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Used solely to call edge functions — no database queries, no auth, no storage bucket. |
| `theme.ts` | **Design tokens.** Exports `colors` (near-black background, volt `#D7FF1E` accent, hairline, text variants) and `type` (heading, body, label, caption styles using SF Pro Display / Inter). Single source of truth for all visual decisions. |
| `haptics.ts` | **Haptic helpers.** Thin wrappers around `expo-haptics` for consistent feedback: `tap()` (light), `shutter()` (medium notification), `error()` (warning). |

## Dependencies

- `react-native-mmkv` — fast synchronous on-device key-value store
- `@supabase/supabase-js` — edge function invocation
- `expo-file-system` — reading photo URIs as base64 on native
- `expo-haptics` — vibration feedback

## Notes

- `api.ts` is the **only** file that makes network calls from the client. All other lib files are purely local.
- Secrets (`SUPABASE_URL`, `ANON_KEY`) are read from environment variables prefixed `EXPO_PUBLIC_` — they are safe to ship in the client bundle because they only grant access to public edge functions.
- Never import from `lib/` inside `components/` for data-fetching; pass data down as props instead.
