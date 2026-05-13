# components — Shared UI Primitives

Reusable, design-system-aligned components used across all screens. All components consume tokens from `lib/theme.ts` — no inline colors or font sizes.

## Overview

Thin presentation layer. No business logic, no API calls, no storage access. Each component accepts typed props and renders consistently with the Lume design language (near-black background, volt accent `#D7FF1E`, SF Pro Display / Inter, hairline dividers).

## Files

| File | Description |
|------|-------------|
| `Text.tsx` | Themed text wrapper. Maps named variants (`heading`, `body`, `label`, `caption`) to `type` tokens from `lib/theme`. Replaces raw `<Text>` throughout the app to enforce typographic consistency. |
| `Button.tsx` | Full-width or compact pressable. Supports `primary` (volt fill) and `ghost` (transparent, hairline border) variants. Includes spring scale animation and haptic feedback on press. |
| `Screen.tsx` | Safe-area-aware scrollable container with standard horizontal padding. Wraps every screen to ensure consistent margins and avoids content hiding behind notches or the tab bar. |
| `MacroRing.tsx` | SVG donut ring that visualises daily calorie and macro progress. Accepts `consumed` and `goal` values for kcal, protein, carbs, and fat; renders four arc segments. |
| `MealCard.tsx` | Card row for a single food log entry. Shows meal name, kcal, macro pills, confidence badge, and an optional thumbnail. Swipe-to-delete triggers `deleteFoodLog`. |
| `WorkoutCard.tsx` | Card row for a single workout log entry. Displays name, duration, intensity label, and kcal burned. Swipe-to-delete triggers `deleteWorkoutLog`. |

## Dependencies

- `lib/theme` — colors, typography tokens
- `lib/store` — `deleteFoodLog`, `deleteWorkoutLog` (used inside card components)
- `expo-haptics` — tactile feedback in `Button`
- `react-native-svg` — SVG rendering in `MacroRing`

## Notes

- Components are intentionally stateless. All data flows down via props; mutations are handled by calling store functions passed as callbacks.
- Do not add navigation logic or API calls to this layer — keep it purely presentational.
