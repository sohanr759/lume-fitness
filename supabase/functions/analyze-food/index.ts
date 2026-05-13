// Edge function: analyze-food (stateless, Gemini-only)
// Input:  { imageBase64: string, mimeType?: string }
// Output: { items: Array<{ name, kcal, protein, carbs, fat, portion_g, confidence, source }> }
//
// Overview: Sends the food image to Gemini 2.5 Flash with a comprehensive nutrition prompt.
//           Gemini returns complete macronutrient data directly — no external API calls needed.
//           For complex dishes (curries, pasta, sandwiches) Gemini breaks them into constituent
//           ingredients and sums the calories mathematically before returning totals.
//
// Inputs:  imageBase64 (string) — JPEG base64 of the food photo
//          mimeType    (string) — MIME type, defaults to image/jpeg
//
// Outputs: { items } — array of food items with kcal/protein/carbs/fat for each portion
//
// Dependencies: ../_shared/gemini.ts, ../_shared/cors.ts
//
// Notes: timeoutMs is 15 000 ms — Gemini 2.5 Flash with ingredient breakdown can take 10–13 s.
import { geminiJson } from '../_shared/gemini.ts';
import { corsHeaders } from '../_shared/cors.ts';

type Ingredient = {
  name: string;
  quantity_g: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

type DetectedItem = {
  name: string;
  portion_g: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  method: 'direct' | 'ingredient_breakdown';
  ingredients?: Ingredient[];
};

const PROMPT = `You are a precise nutrition analysis model. Analyze the food image and return macronutrient data for every visible item.

Rules:
- GENERIC / SIMPLE items (banana, boiled egg, plain rice, glass of milk): use your built-in nutritional knowledge directly. method: "direct".
- COMPLEX DISHES (curries, pasta dishes, sandwiches, burgers, stews, stir-fries, mixed plates, restaurant dishes):
  Break the dish into its constituent ingredients with individual quantities.
  Sum kcal, protein, carbs, and fat mathematically across ingredients. method: "ingredient_breakdown".

Portion heuristics:
  Full dinner plate (27 cm): 400-700 g total across all items
  Fist of cooked rice or pasta: 150-200 g
  Palm-sized protein (deck of cards): 85-120 g
  Cup of salad or greens: 60-80 g; cooked vegetables: 80-120 g
  Golf ball of cheese or nuts: 28-35 g
  Standard burger: bun 60 g + patty 110 g + toppings 40 g
  Medium fruit (apple, banana): 120-150 g
  Restaurant curry or sauce dish: 300-400 g

Reference kcal per 100 g (use as nutritional anchors):
  rice cooked 130 | pasta cooked 131 | bread white 265 | potato boiled 87 | naan 310
  chicken breast grilled 165 | beef mince cooked 250 | salmon grilled 208 | egg whole 155 | paneer 265
  olive oil 884 | butter 717 | ghee 900 | cheddar cheese 403
  whole milk 61 | greek yogurt 97 | lentils cooked 116
  banana 89 | apple 52 | orange 47
  broccoli 34 | carrot 41 | spinach 23 | tomato 18 | onion 40

Return STRICT JSON only - no markdown fences, no extra text:
{
  "items": [
    {
      "name": "<descriptive name, e.g. 'Chicken tikka masala' or 'Steamed white rice' or 'Banana'>",
      "portion_g": <integer, estimated total grams of this item>,
      "kcal": <integer, total kcal for this portion>,
      "protein": <float, grams of protein for this portion>,
      "carbs": <float, grams of carbohydrates for this portion>,
      "fat": <float, grams of fat for this portion>,
      "confidence": <float 0.0-1.0>,
      "method": "direct" | "ingredient_breakdown",
      "ingredients": [
        {
          "name": "<ingredient name>",
          "quantity_g": <integer>,
          "kcal": <integer>,
          "protein": <float>,
          "carbs": <float>,
          "fat": <float>
        }
      ]
    }
  ]
}

Important:
- "ingredients" is REQUIRED when method is "ingredient_breakdown"; OMIT it when method is "direct".
- When method is "ingredient_breakdown": item-level kcal/protein/carbs/fat MUST equal the mathematical sum of ingredient values.
- Use confidence < 0.7 for sauces, hidden ingredients, or unclear portions.
- NEVER return 0 kcal for any visible food item.
- Do NOT invent items that are not visible in the image.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) return json({ error: 'imageBase64 required' }, 400);

    const detection = await geminiJson<{ items: DetectedItem[] }>({
      prompt: PROMPT,
      imageBase64,
      mimeType: mimeType ?? 'image/jpeg',
      timeoutMs: 15000,
    });

    const items = (detection.items ?? []).map((it) => ({
      name: it.name,
      kcal: Math.round(it.kcal),
      protein: Math.round(it.protein * 10) / 10,
      carbs: Math.round(it.carbs * 10) / 10,
      fat: Math.round(it.fat * 10) / 10,
      portion_g: it.portion_g,
      confidence: it.confidence,
      source: it.method === 'ingredient_breakdown' ? 'gemini-breakdown' : 'gemini-direct',
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
