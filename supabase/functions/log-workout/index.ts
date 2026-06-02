// Edge function: log-workout (stateless)
// Input: { text: string, weight_kg?: number }
// Output: { name, category, duration_min, intensity, kcal_burned, met }
import { geminiJson } from '../_shared/gemini.ts';
import { lookupMet, estimateKcal } from '../_shared/met.ts';
import { corsHeaders } from '../_shared/cors.ts';

type Parsed = {
  name: string;
  category: 'gym' | 'cardio' | 'sports';
  duration_min: number;
  intensity: 'low' | 'moderate' | 'high';
};

const PROMPT = `Parse this workout description into STRICT JSON:
{ "name": "<short canonical name>",
  "category": "gym" | "cardio" | "sports",
  "duration_min": <int>,
  "intensity": "low" | "moderate" | "high" }
If duration is unspecified, default to 30. Description:`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { text, weight_kg } = await req.json();
    if (!text) return json({ error: 'text required' }, 400);

    const parsed = await geminiJson<Parsed>({ prompt: `${PROMPT}\n${text}`, timeoutMs: 9000 });

    const weight = Number(weight_kg ?? 70);
    const { met, category: fallbackCat } = lookupMet(parsed.name);
    const intensityScale = parsed.intensity === 'high' ? 1.15 : parsed.intensity === 'low' ? 0.85 : 1;
    const adjMet = met * intensityScale;
    const kcal = estimateKcal(adjMet, weight, parsed.duration_min);

    return json({
      name: parsed.name,
      category: parsed.category ?? fallbackCat,
      duration_min: parsed.duration_min,
      intensity: parsed.intensity,
      kcal_burned: kcal,
      met: Math.round(adjMet * 10) / 10,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('[log-workout] 500 error:', msg, stack);
    return json({ error: msg, detail: stack }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
