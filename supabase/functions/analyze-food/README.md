# analyze-food — Food Image Analysis Edge Function

Stateless Supabase Edge Function. Accepts a base64-encoded meal photo, uses Gemini vision to identify food items and estimate portions, then enriches each item with verified macros from USDA FDC or OpenFoodFacts.

## Overview

Acts as a secure AI intermediary. The Expo client never holds the Gemini or USDA API keys — they live exclusively in Supabase secrets and are accessed only inside this function.

## Purpose

Hide third-party API credentials from the client while providing a single, reliable nutrition-analysis endpoint.

## Inputs

```json
POST /functions/v1/analyze-food
{
  "imageBase64": "<base64-encoded JPEG string>",
  "mimeType": "image/jpeg"   // optional, defaults to image/jpeg
}
```

## Outputs

```json
{
  "items": [
    {
      "name": "grilled chicken breast",
      "kcal": 165,
      "protein": 31.0,
      "carbs": 0.0,
      "fat": 3.6,
      "portion_g": 120,
      "confidence": 0.92,
      "source": "usda"        // "usda" | "openfoodfacts" | "ai-estimate"
    }
  ]
}
```

## Processing Pipeline

1. **Gemini vision detection** — sends the image with a structured prompt; receives a JSON array of `{ name, portion_g, confidence, estimated_kcal_per_100g }`.
2. **Nutrition enrichment** — for each detected item, calls `lookupNutrition(name)` (USDA FDC + OpenFoodFacts in parallel).
3. **AI fallback** — if both databases return nothing or < 5 kcal, falls back to the Gemini-estimated kcal with a 20/50/30 macro split (protein/carbs/fat).
4. **Scaling** — applies `scaleToGrams(per100, portion_g)` to convert per-100 g values to the actual portion.

## Dependencies

- `../_shared/gemini.ts` — `geminiJson`
- `../_shared/nutrition.ts` — `lookupNutrition`, `scaleToGrams`
- `../_shared/cors.ts` — `corsHeaders`
- `GEMINI_API_KEY` (Supabase secret)
- `USDA_API_KEY` (Supabase secret)

## Notes

- Timeout: 9 000 ms (image processing is slower than text).
- The Gemini prompt instructs it to list complex dishes as separate components (e.g. rice + protein + vegetables) for accuracy.
- `confidence` values below 0.6 are flagged by the client as `needsClarification`.
- `source: "ai-estimate"` in a response item indicates neither database returned a usable match — treat those macros as approximate.
