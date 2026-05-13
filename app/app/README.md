# app/app — Route Tree (Expo Router)

All screens are defined here as files. Expo Router maps the file system directly to navigation routes.

## Overview

File-based routing layer. The root layout guards new users into onboarding; returning users land on the tab navigator.

## Files

| File | Route | Description |
|------|-------|-------------|
| `_layout.tsx` | `/` (root) | Root layout. Reads the MMKV profile on mount; redirects to `/onboarding` if none exists. Wraps the app in any global providers. |
| `onboarding.tsx` | `/onboarding` | 3-step wizard: (1) name, (2) sex / age / height / weight, (3) goal + activity level. Calls `saveProfile()` and computes the Mifflin–St Jeor daily kcal target before navigating to tabs. |
| `(tabs)/_layout.tsx` | — | Tab bar configuration. Renders four tabs — Today, Log, Move, History — with a blur-frosted dark background and hairline top border. |
| `(tabs)/index.tsx` | `/` (tab) | **Today** screen. Displays the daily calorie ring, macro breakdown, and today's food + workout entries. |
| `(tabs)/log.tsx` | `/log` | **Log** screen. Camera shutter to snap a meal; calls `analyzeFoodImage()`, then shows detected items with confidence badges. |
| `(tabs)/workout.tsx` | `/workout` | **Move** screen. Text input for workout description; calls `logWorkoutText()` and shows parsed name, duration, and kcal burned. |
| `(tabs)/history.tsx` | `/history` | **History** screen. Scrollable day-by-day list of all past food and workout logs. |

## Dependencies

- `expo-router` — file-to-route mapping and `<Tabs>` navigator
- `expo-blur` — `<BlurView>` for the frosted tab bar background
- `lib/store` — read/delete food and workout logs
- `lib/api` — `analyzeFoodImage`, `logWorkoutText`
- `lib/profile` — `getProfile`, `saveProfile`
- `lib/theme` — design tokens (colors, typography)

## Notes

- The `(tabs)` folder name is a route group — it does not appear in the URL path.
- Redirects in `_layout.tsx` use `expo-router`'s `<Redirect>` component, not imperative navigation, to avoid rendering race conditions.
