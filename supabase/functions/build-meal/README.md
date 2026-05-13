# build-meal — Meal Builder Edge Function

## Overview
Takes a list of available ingredients and a calorie target, then uses Gemini to produce a complete meal plan with specific gram quantities per ingredient that sum to the target (±10 kcal).

## Purpose
Powers the **Build mode** of the Log tab. Users who want to plan meals around a specific calorie count can input what ingredients they have available and receive a ready-to-cook, precisely quantified meal. The client shows a review card before any logging occurs — the user must explicitly tap "Log This Meal" to commit.

## Inputs
| Field        | Type   | Required | Description                             |
|--------------|--------|----------|-----------------------------------------|
| ingredients  | string | yes      | Comma-separated ingredient names        |
| target_kcal  | number | yes      | Desired calorie total (must be 1–5000)  |

## Outputs
```json
{
  "meal_name": "Grilled Chicken & Rice Bowl",
  "instructions": "Season chicken breast and grill on medium-high heat for 6–7 minutes per side. Cook rice according to package instructions. Steam broccoli for 4 minutes. Drizzle olive oil over the bowl before serving.",
  "total_kcal": 498,
  "items": [
    {
      "name": "Chicken Breast (grilled)",
      "quantity_g": 150,
      "quantity_label": "150 g",
      "kcal": 248,
      "protein": 46.5,
      "carbs": 0.0,
      "fat": 5.3
    }
  ]
}
```

## Dependencies
- `../_shared/gemini.ts` — Gemini 2.5 Flash JSON wrapper
- `../_shared/cors.ts` — CORS response headers
- Deno runtime, `GEMINI_API_KEY` environment secret

## Usage
```bash
curl -X POST https://<project>.supabase.co/functions/v1/build-meal \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"ingredients": "chicken breast, rice, broccoli, olive oil", "target_kcal": 500}'
```

## Notes
- `timeoutMs` is 15 000 ms — multi-step arithmetic reasoning is the most compute-intensive prompt.
- The function re-sums item `kcal` values in Deno after receiving the response. If they disagree with `total_kcal` by >10, returns HTTP 500 rather than serving inconsistent data.
- Ingredients not needed (excluded to hit the calorie target) will not appear in the response.
- The client does **not** call `addFoodLog()` when `buildMeal()` resolves — logging is deferred to the user confirming via "Log This Meal". This is intentional: Build mode is a deliberate review-before-commit flow.
- Items logged via Build mode use `confidence: 1.0` and `source: "build-meal"`.
