// Edge function: analyze-food-text (stateless, Gemini-only)
// Input:  { text: string }
//         e.g. "2 bananas, 100g oats, 80g peanut butter, 25g whey protein"
// Output: { items: Array<{ name, quantity_label, portion_g, kcal, protein, carbs, fat, confidence, source }> }
//
// Overview: Sends a free-text food list to Gemini 2.5 Flash.
//           Gemini parses each item, resolves quantities (count-based or gram-based),
//           and returns macronutrient data per item at the stated quantity.
//
// Inputs:  text (string) — comma- or newline-separated ingredient list with optional quantities
//
// Outputs: { items } — array of food items with kcal/protein/carbs/fat for each stated portion
//
// Dependencies: ../_shared/gemini.ts, ../_shared/cors.ts
//
// Notes: timeoutMs is 10 000 ms — text-only Gemini calls are significantly faster than image calls.
//        source is always "gemini-text" (set by this function, not Gemini).
//        confidence < 0.6 triggers a clarification notice in the client UI.
import { geminiJson } from '../_shared/gemini.ts';
import { corsHeaders } from '../_shared/cors.ts';

type ParsedItem = {
  name: string;
  quantity_label: string;
  portion_g: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
};

const PROMPT = `You are a precise nutrition calculator. The user has entered a list of foods with quantities.
Parse every item and calculate its exact macronutrients for the stated quantity.

Parsing rules:
- "2 bananas" → name: "Banana", quantity_label: "2 medium (240 g)", portion_g: 240
- "100g oats" or "100 g oats" → name: "Rolled Oats (dry)", quantity_label: "100 g", portion_g: 100
- "80g peanut butter" → name: "Peanut Butter", quantity_label: "80 g", portion_g: 80
- "25g whey protein" → name: "Whey Protein Powder", quantity_label: "25 g (1 scoop)", portion_g: 25
- "a cup of rice" → estimate grams using standard measures (cooked rice ~185 g per cup)
- "handful of almonds" → estimate ~28 g (standard handful)
- If no quantity is stated, use a single standard serving

Reference kcal per 100 g (use these exact values for your arithmetic):
  oats dry 389 | rice cooked 130 | pasta cooked 131 | bread white 265 | naan 310
  chicken breast cooked 165 | beef mince cooked 250 | salmon cooked 208 | egg whole 155
  whey protein powder 400 | casein protein powder 373
  peanut butter 588 | almond butter 614 | almonds 579 | cashews 553 | walnuts 654
  whole milk 61 | greek yogurt full-fat 97 | cheddar 403 | paneer 265
  banana 89 | apple 52 | orange 47 | blueberries 57 | mango 60
  broccoli 34 | spinach 23 | sweet potato 86 | potato boiled 87 | avocado 160
  olive oil 884 | butter 717 | coconut oil 862 | ghee 900
  lentils cooked 116 | chickpeas cooked 164 | black beans cooked 132
  dark chocolate 70% 598 | honey 304 | oat milk 45 | almond milk 15

Calculation rules:
- macros = (per-100g value × portion_g) / 100
- Verify: kcal ≈ protein×4 + carbs×4 + fat×9
- Round kcal to nearest integer, protein/carbs/fat to 1 decimal place

Confidence guidelines:
- 0.9–1.0: exact gram weight stated (e.g. "100g oats")
- 0.75–0.89: count-based common food (e.g. "2 bananas")
- 0.5–0.74: ambiguous item or inferred serving (e.g. "some protein", "a handful")

Return STRICT JSON only — no markdown fences, no extra text:
{
  "items": [
    {
      "name": "<canonical food name>",
      "quantity_label": "<human-readable quantity, e.g. '2 medium (240 g)' or '100 g'>",
      "portion_g": <integer>,
      "kcal": <integer>,
      "protein": <float, 1 decimal>,
      "carbs": <float, 1 decimal>,
      "fat": <float, 1 decimal>,
      "confidence": <float 0.0–1.0>
    }
  ]
}

Important:
- Do NOT invent items not mentioned in the input.
- One entry per distinct food item.
- NEVER return 0 kcal for any food.

Food list to parse:
`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string' || !text.trim()) {
      return json({ error: 'text is required' }, 400);
    }

    const detection = await geminiJson<{ items: ParsedItem[] }>({
      prompt: PROMPT + text.trim(),
      timeoutMs: 10000,
    });

    const items = (detection.items ?? []).map((it) => ({
      name: it.name,
      quantity_label: it.quantity_label,
      portion_g: it.portion_g,
      kcal: Math.round(it.kcal),
      protein: Math.round(it.protein * 10) / 10,
      carbs: Math.round(it.carbs * 10) / 10,
      fat: Math.round(it.fat * 10) / 10,
      confidence: it.confidence,
      source: 'gemini-text',
    }));

    return json({ items });
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
