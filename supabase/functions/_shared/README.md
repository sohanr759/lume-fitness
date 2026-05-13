# _shared — Shared Edge Function Utilities

Internal utilities imported by `analyze-food` and `log-workout`. Not a deployable function — Supabase ignores folders prefixed with `_`.

## Overview

Centralises cross-cutting concerns (AI client, nutrition lookup, MET table, CORS) so each function stays focused on its own logic.

## Files

| File | Description |
|------|-------------|
| `gemini.ts` | **Gemini 2.5 Flash JSON wrapper.** `geminiJson<T>(opts)` sends a prompt (and optional inline image) to the Gemini `generateContent` API with `responseMimeType: 'application/json'`. Strips markdown fences from the response before parsing. Applies a configurable `AbortController` timeout (default 8 s). Reads `GEMINI_API_KEY` from Deno environment. |
| `nutrition.ts` | **Nutrition database lookup.** `lookupNutrition(name)` queries USDA FDC and OpenFoodFacts in parallel (4 s timeout each), returning the first successful `Per100g` result. `scaleToGrams(per100, grams)` scales macros from per-100 g to the actual portion. Reads `USDA_API_KEY` from Deno environment. |
| `met.ts` | **MET (Metabolic Equivalent of Task) table.** `lookupMet(activityName)` performs a fuzzy-match against a built-in MET table and returns a numeric MET value. `estimateKcal(met, weight_kg, duration_min)` applies the standard formula `MET × weight × (duration / 60)`. |
| `cors.ts` | **CORS headers.** Exports `corsHeaders` — a plain object with `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers`, and `Access-Control-Allow-Methods`. Applied to every response so the Expo web export can call functions from a browser context. |

## Dependencies

- Deno standard library (`Deno.env`, `fetch`, `AbortController`) — no npm packages
- `GEMINI_API_KEY` secret (runtime)
- `USDA_API_KEY` secret (runtime)

## Notes

- `gemini.ts` targets the `v1beta` endpoint for Gemini 2.5 Flash. If the model name changes, update the `ENDPOINT` constant there.
- `nutrition.ts` uses `Promise.all` with individual `.catch(() => null)` guards — one source failing never blocks the other.
- `cors.ts` sets `Access-Control-Allow-Origin: *` intentionally; edge functions are public-but-key-protected and serve no user-specific data.
