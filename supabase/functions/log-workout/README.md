# log-workout — Workout Logging Edge Function

Stateless Supabase Edge Function. Parses a free-text workout description with Gemini, looks up its MET value, and returns a structured workout object including estimated kcal burned.

## Overview

Converts natural language ("cycled 45 min moderate", "ran 5k", "bench press 3 sets heavy") into a structured record. The Expo client persists the result locally via MMKV — nothing is stored server-side.

## Purpose

Provide a single, key-protected endpoint that abstracts Gemini parsing and MET calculation away from the client.

## Inputs

```json
POST /functions/v1/log-workout
{
  "text": "cycled 45 minutes moderate pace",
  "weight_kg": 75   // optional, defaults to 70
}
```

## Outputs

```json
{
  "name": "cycling",
  "category": "cardio",
  "duration_min": 45,
  "intensity": "moderate",
  "kcal_burned": 321,
  "met": 7.1
}
```

## Processing Pipeline

1. **Gemini text parse** — sends the description with a strict JSON schema prompt; receives `{ name, category, duration_min, intensity }`. If duration is unspecified, Gemini defaults it to 30 min.
2. **MET lookup** — `lookupMet(name)` fuzzy-matches against a built-in activity table.
3. **Intensity scaling** — multiplies MET by 1.15 (high), 1.0 (moderate), or 0.85 (low).
4. **Kcal estimate** — `estimateKcal(adjMet, weight_kg, duration_min)` applies `MET × weight × (duration / 60)`.

## Dependencies

- `../_shared/gemini.ts` — `geminiJson`
- `../_shared/met.ts` — `lookupMet`, `estimateKcal`
- `../_shared/cors.ts` — `corsHeaders`
- `GEMINI_API_KEY` (Supabase secret)

## Notes

- Timeout: 6 000 ms (text-only, faster than image analysis).
- `category` is returned by Gemini and validated against `"gym" | "cardio" | "sports"`; falls back to the MET-table category if Gemini omits it.
- Errors are logged to `console.error` with stack traces to aid Supabase Function Logs debugging.
- No USDA key required — this function is nutrition-free.
