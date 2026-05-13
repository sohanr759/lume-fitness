# supabase — Edge Functions Backend

Stateless Supabase Edge Functions that proxy AI and nutrition API calls. No database, no storage bucket, no auth — the functions exist solely to keep API keys off the client device.

## Overview

Two deployed functions act as secure intermediaries: they receive lightweight payloads from the Expo app, call external APIs (Gemini, USDA FDC, OpenFoodFacts), and return structured JSON. All persistence happens on-device after the response is received.

## Folder Structure

```
supabase/
├── config.toml              # Supabase project config (project ref, function settings)
└── functions/
    ├── analyze-food/        # Image → Gemini vision → nutrition lookup → JSON
    ├── log-workout/         # Text → Gemini parse → MET calc → JSON
    └── _shared/             # Shared utilities (Gemini wrapper, nutrition, MET, CORS)
```

## Secrets Required

| Secret | Source |
|--------|--------|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) — free tier |
| `USDA_API_KEY` | [USDA FDC](https://fdc.nal.usda.gov/api-key-signup.html) — free tier |

Set via:
```bash
supabase secrets set GEMINI_API_KEY=... USDA_API_KEY=...
```

## Deployment

```bash
supabase link --project-ref <your-ref>
supabase functions deploy analyze-food log-workout
```

## Notes

- Functions run on Deno (not Node.js) — imports use URL or npm: specifiers.
- No migrations or database schemas are needed; this project uses Supabase only for its edge runtime and secret management.
- CORS is handled by the shared `corsHeaders` utility — all functions respond to `OPTIONS` pre-flight requests.
