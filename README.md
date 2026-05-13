# Lume

Minimal, luxe calorie + workout tracker. Snap a meal, log a workout in one tap. **No login** — onboarding asks your name + basics, everything is stored on-device.

**Stack:** Expo (React Native) · MMKV (local storage) · Supabase Edge Functions (for hiding the Gemini key only) · Google Gemini 2.0 Flash (free tier) · USDA FoodData Central · OpenFoodFacts.

## Layout

```
Lume/
├── app/                    # Expo client
│   ├── app/
│   │   ├── _layout.tsx     # gates onto onboarding if no profile
│   │   ├── onboarding.tsx  # name → body → goal (3 steps)
│   │   └── (tabs)/         # Today, Log, Workout (Move), History
│   ├── components/         # Text, Button, MacroRing, MealCard, Screen
│   └── lib/
│       ├── theme.ts        # luxe design tokens
│       ├── profile.ts      # local profile + Mifflin–St Jeor goal calc
│       ├── store.ts        # MMKV food/workout logs
│       ├── cache.ts        # MMKV recent foods cache
│       ├── api.ts          # calls edge functions, persists locally
│       └── supabase.ts     # client (functions only, no auth/DB)
└── supabase/functions/
    ├── analyze-food/       # base64 image → Gemini → USDA/OFF → JSON
    ├── log-workout/        # text → Gemini → MET calc → JSON
    └── _shared/            # gemini, nutrition, met, cors
```

## Setup

### 1. Supabase (edge functions only)
```bash
npm i -g supabase
supabase init
supabase link --project-ref <your-ref>
supabase secrets set GEMINI_API_KEY=... USDA_API_KEY=...
supabase functions deploy analyze-food log-workout
```
- Free Gemini key: https://aistudio.google.com/apikey
- Free USDA key: https://fdc.nal.usda.gov/api-key-signup.html
- No database, no migrations, no storage bucket — the functions are stateless.

### 2. Expo client
```bash
cd app
npm install
cp .env.example .env   # add EXPO_PUBLIC_SUPABASE_URL + ANON_KEY
npx expo start
```

## How it works
- **First launch** → onboarding: name → sex/age/height/weight → goal/activity. We compute a daily kcal target via Mifflin–St Jeor × activity factor (± 500 / +350 for lose/gain).
- **Snap a meal** → image is base64-encoded, sent to `analyze-food`, which calls Gemini Flash for detection + USDA/OFF for nutrition. Result is stored in local MMKV with the photo URI.
- **Log a workout** → text goes to `log-workout`, which parses with Gemini and computes `MET × weight × duration`. Stored locally.
- **All data is on-device.** Reset by deleting/reinstalling the app.

## Verification
- Onboarding flow: launch → enter name → see daily target on the goal step.
- Snap a pizza → expect ~600–900 kcal entry on Today within ~3 s.
- "cycled 30 min moderate" → kcal ≈ 6.8 × weight × 0.5.
- Force quit and reopen → today's log is still there.

## Design language
Near-black background, single accent (volt `#D7FF1E`), SF Pro Display / Inter, hairline dividers, blur tab bar, spring motion, haptics on shutter. No gradients except photo scrims, no emoji in UI.
