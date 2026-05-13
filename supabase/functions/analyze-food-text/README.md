# analyze-food-text — Text-to-Nutrition Edge Function

## Overview
Parses a free-text food list (e.g. "2 bananas, 100g oats, 80g peanut butter") and returns macronutrient data for each item at the stated quantity.

## Purpose
Powers the **Text mode** of the Log tab. Users can type or dictate foods using the native iOS/Android keyboard microphone rather than taking a photo. Handles both count-based quantities ("2 bananas") and weight-based quantities ("100g oats") in a single pass.

## Inputs
| Field | Type   | Required | Description                                      |
|-------|--------|----------|--------------------------------------------------|
| text  | string | yes      | Free-text food list, comma- or newline-separated |

## Outputs
```json
{
  "items": [
    {
      "name": "Rolled Oats (dry)",
      "quantity_label": "100 g",
      "portion_g": 100,
      "kcal": 389,
      "protein": 13.5,
      "carbs": 66.3,
      "fat": 6.9,
      "confidence": 0.95,
      "source": "gemini-text"
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
curl -X POST https://<project>.supabase.co/functions/v1/analyze-food-text \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"text": "2 bananas, 100g oats, 80g peanut butter, 25g whey protein"}'
```

## Notes
- `timeoutMs` is 10 000 ms (text-only calls are faster than image analysis).
- `confidence < 0.6` items trigger a clarification notice in the client UI.
- `source` is always `"gemini-text"` — set by this function, not Gemini.
- kcal values are rounded to the nearest integer; macros to 1 decimal place.
- Items not mentioned in the input are never invented.
