# functions — Supabase Edge Functions

Deno-based stateless functions deployed to Supabase's edge runtime. Each function handles one domain concern and returns pure JSON.

## Overview

Two public functions and a private shared utilities folder. All functions are invoked by the Expo client via `@supabase/supabase-js` `functions.invoke()`. No direct HTTP calls from the client to Gemini or nutrition databases — all third-party API keys stay server-side.

## Functions

| Folder | HTTP Route | Description |
|--------|------------|-------------|
| [`analyze-food/`](analyze-food/) | `POST /analyze-food` | Accepts a base64 meal photo; uses Gemini vision to detect food items and portions; enriches with USDA / OpenFoodFacts macros; returns a structured nutrition array. |
| [`log-workout/`](log-workout/) | `POST /log-workout` | Accepts a free-text workout description; uses Gemini to parse name, category, duration, and intensity; computes kcal burned via MET formula; returns a structured workout object. |
| [`_shared/`](_shared/) | — | Internal utilities shared across functions (Gemini JSON wrapper, nutrition lookup, MET table, CORS headers). Not a deployable function. |

## Request / Response Contract

### `analyze-food`
```
POST body:  { imageBase64: string, mimeType?: string }
Response:   { items: Array<{ name, kcal, protein, carbs, fat, portion_g, confidence, source }> }
```

### `log-workout`
```
POST body:  { text: string, weight_kg?: number }
Response:   { name, category, duration_min, intensity, kcal_burned, met }
```

## Notes

- All functions respond to `OPTIONS` for CORS pre-flight.
- A 9 s timeout is applied to `analyze-food` (image processing is slower); 6 s to `log-workout`.
- If the USDA/OpenFoodFacts lookup fails or returns suspiciously low calories (< 5 kcal), `analyze-food` falls back to the AI-estimated kcal with a standard 20/50/30 protein/carbs/fat macro split.
