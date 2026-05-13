// Edge function: build-meal (stateless, Gemini-only)
// Input:  { ingredients: string, target_kcal: number }
//         e.g. { ingredients: "chicken breast, rice, broccoli, olive oil", target_kcal: 500 }
// Output: { meal_name, instructions, total_kcal, items: Array<{ name, quantity_g, quantity_label, kcal, protein, carbs, fat }> }
//
// Overview: Takes a list of available ingredients and a calorie target, then uses Gemini
//           to produce a complete meal plan with specific gram quantities per ingredient
//           that sum to the target (±10 kcal). Server-side arithmetic verification ensures
//           the returned total_kcal is consistent with the sum of item kcal values.
//
// Inputs:  ingredients (string) — comma-separated ingredient names
//          target_kcal (number) — desired calorie total (1–5000)
//
// Outputs: { meal_name, instructions, total_kcal, items }
//
// Dependencies: ../_shared/gemini.ts, ../_shared/cors.ts
//
// Notes: timeoutMs is 15 000 ms — multi-step arithmetic reasoning is the most compute-intensive prompt.
//        Server re-sums item kcal values; returns HTTP 500 if they disagree with total_kcal by >10.
//        Client does NOT log items until user taps "Log This Meal" — logging is deferred to review.
import { geminiJson } from '../_shared/gemini.ts';
import { corsHeaders } from '../_shared/cors.ts';

type BuiltMealItem = {
  name: string;
  quantity_g: number;
  quantity_label: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

type BuiltMealResponse = {
  meal_name: string;
  instructions: string;
  total_kcal: number;
  items: BuiltMealItem[];
};

function buildPrompt(ingredients: string, targetKcal: number): string {
  return `You are a meal planning assistant. The user wants to build a meal from specific ingredients that hits a precise calorie target.

Your task:
1. Assign gram quantities to each ingredient so the combined meal totals as close to ${targetKcal} kcal as possible (within ±10 kcal).
2. Name the meal concisely (e.g. "Grilled Chicken & Rice Bowl").
3. Write 2–4 short cooking instructions.

Reference kcal per 100 g (use these exact values for your arithmetic):
  chicken breast raw 114 | chicken breast cooked/grilled 165 | chicken thigh cooked 209
  beef mince cooked 250 | salmon cooked 208 | tuna canned in water 116 | egg whole 155
  rice cooked 130 | rice dry 365 | pasta cooked 131 | bread white 265 | oats dry 389
  sweet potato cooked 90 | potato boiled 87 | lentils cooked 116 | chickpeas cooked 164
  broccoli 34 | spinach 23 | mixed greens 20 | tomato 18 | cucumber 15 | bell pepper 31 | onion 40
  olive oil 884 | butter 717 | coconut oil 862 | ghee 900
  cheddar 403 | greek yogurt 97 | whole milk 61 | paneer 265
  avocado 160 | banana 89 | apple 52 | peanut butter 588 | almonds 579
  whey protein powder 400

Portion guidance (use as starting points, then adjust to hit target):
  Protein (chicken/fish/beef): 100–200 g cooked
  Starchy carb (rice/pasta/oats): 100–200 g cooked
  Vegetables: 80–150 g
  Fat/oil: 5–15 g

Calculation method — follow this order exactly:
  Step 1: Assign initial quantities using portion guidance above.
  Step 2: Compute kcal per item: kcal_item = (kcal_per_100g × quantity_g) / 100
  Step 3: Sum all kcal_item values.
  Step 4: If total differs from ${targetKcal} by more than 10, adjust the starchy carb quantity (easiest lever) and recalculate. Repeat once if needed.
  Step 5: Only emit JSON once total_kcal is within ±10 of ${targetKcal}.

Return STRICT JSON only — no markdown fences, no reasoning, no extra text:
{
  "meal_name": "<short descriptive name>",
  "instructions": "<2–4 sentences of cooking instructions>",
  "total_kcal": <integer — MUST equal sum of item kcal values>,
  "items": [
    {
      "name": "<ingredient canonical name>",
      "quantity_g": <integer>,
      "quantity_label": "<e.g. '150 g' or '10 g (2 tsp)'>",
      "kcal": <integer>,
      "protein": <float, 1 decimal>,
      "carbs": <float, 1 decimal>,
      "fat": <float, 1 decimal>
    }
  ]
}

Rules:
- Only use ingredients from the provided list. Do not add unlisted ingredients (no salt, spices, or water unless listed).
- An ingredient may be omitted if including it at any sensible quantity would push the total past ${targetKcal} + 10.
- total_kcal MUST be the mathematical sum of all item kcal values.
- total_kcal MUST be within ±10 of ${targetKcal}.

Ingredients: ${ingredients}
Target calories: ${targetKcal} kcal`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { ingredients, target_kcal } = await req.json();

    if (!ingredients || typeof ingredients !== 'string' || !ingredients.trim()) {
      return json({ error: 'ingredients is required' }, 400);
    }
    const targetKcal = Number(target_kcal);
    if (!targetKcal || targetKcal < 1 || targetKcal > 5000) {
      return json({ error: 'target_kcal must be a number between 1 and 5000' }, 400);
    }

    const meal = await geminiJson<BuiltMealResponse>({
      prompt: buildPrompt(ingredients.trim(), Math.round(targetKcal)),
      timeoutMs: 15000,
    });

    if (!meal?.meal_name || !Array.isArray(meal?.items)) {
      return json({ error: 'Invalid response from AI — missing meal_name or items' }, 500);
    }

    // Server-side arithmetic verification: re-sum item kcal values
    const recomputedTotal = meal.items.reduce((sum, it) => sum + Math.round(it.kcal), 0);
    if (Math.abs(recomputedTotal - Math.round(meal.total_kcal)) > 10) {
      return json(
        { error: `Calorie arithmetic mismatch: stated ${meal.total_kcal} vs computed ${recomputedTotal}` },
        500,
      );
    }

    // Round all numeric fields
    const items = meal.items.map((it) => ({
      name: it.name,
      quantity_g: Math.round(it.quantity_g),
      quantity_label: it.quantity_label,
      kcal: Math.round(it.kcal),
      protein: Math.round(it.protein * 10) / 10,
      carbs: Math.round(it.carbs * 10) / 10,
      fat: Math.round(it.fat * 10) / 10,
    }));

    return json({
      meal_name: meal.meal_name,
      instructions: meal.instructions,
      total_kcal: Math.round(meal.total_kcal),
      items,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
