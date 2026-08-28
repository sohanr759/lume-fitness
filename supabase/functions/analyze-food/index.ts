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

const PROMPT = `You are a food nutrition estimator. Analyze ONLY visible food in the provided image. Return STRICT JSON only.

TASK
For each visible food item:

1. Identify the item.
2. Estimate portion size in grams.
3. Estimate kcal, protein, carbs, and fat.
4. Choose method:

   * "direct" for simple single foods.
   * "ingredient_breakdown" for mixed/complex dishes.

METHOD RULES

DIRECT:
Use for clearly identifiable simple foods such as:
banana, apple, orange, boiled/fried egg, plain rice, plain bread, milk, plain vegetables, grilled plain meat.

For "direct":

* Estimate nutrition directly.
* OMIT "ingredients".

INGREDIENT_BREAKDOWN:
Use for mixed dishes such as:
curries, biryani, pasta dishes, sandwiches, burgers, stews, stir-fries, mixed gravies, restaurant dishes.

For "ingredient_breakdown":

* Estimate only the major visible/likely ingredients needed for nutrition.
* Avoid unnecessary spices/garnishes unless nutritionally significant.
* Include ingredient quantities and macros.
* Item macros MUST exactly equal the sum of ingredient macros.

PORTION GUIDE

* Full 27 cm plate total: 400-700 g
* Cooked rice/pasta fist: 150-200 g
* Palm-sized meat/protein: 85-120 g
* Salad/greens cup: 60-80 g
* Cooked vegetables cup: 80-120 g
* Cheese/nuts golf ball: 28-35 g
* Standard burger: bun 60 g + patty 110 g + toppings 40 g
* Medium fruit: 120-150 g
* Curry/sauce dish serving: 300-400 g

KCAL / 100 g ANCHORS
rice cooked 130
pasta cooked 131
white bread 265
boiled potato 87
naan 310
grilled chicken breast 165
cooked beef mince 250
grilled salmon 208
whole egg 155
paneer 265
olive oil 884
butter 717
ghee 900
cheddar 403
whole milk 61
greek yogurt 97
cooked lentils 116
banana 89
apple 52
orange 47
broccoli 34
carrot 41
spinach 23
tomato 18
onion 40

CONFIDENCE

* 0.8-1.0: clearly visible/simple item and portion
* 0.7-0.79: identifiable with moderate portion uncertainty
* below 0.7: hidden oil/sauce/ingredients, unclear portion, or ambiguous dish

CONSTRAINTS

* Do not invent food that is not visible.
* Never return 0 kcal for visible food.
* Prefer the simplest reasonable identification.
* Do not explain reasoning.
* Do not output markdown.
* Output only valid JSON matching this schema exactly:

{
"items": [
{
"name": "<descriptive name>",
"portion_g": <integer>,
"kcal": <integer>,
"protein": <float>,
"carbs": <float>,
"fat": <float>,
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

IMPORTANT:

* If method = "direct", OMIT "ingredients".
* If method = "ingredient_breakdown", "ingredients" is REQUIRED.
* For ingredient_breakdown:
  portion_g = sum of ingredient quantity_g.
  kcal = sum of ingredient kcal.
  protein = sum of ingredient protein.
  carbs = sum of ingredient carbs.
  fat = sum of ingredient fat.`;

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
