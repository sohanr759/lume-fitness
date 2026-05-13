// Nutrition lookup: USDA FDC -> OpenFoodFacts -> null. Macros are per 100g.
export type Per100g = { kcal: number; protein: number; carbs: number; fat: number; source: string };

const TIMEOUT = 4000;

function withTimeout<T>(p: Promise<T>, ms = TIMEOUT): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export async function lookupNutrition(name: string): Promise<Per100g | null> {
  const usda = withTimeout(fromUSDA(name)).catch(() => null);
  const off = withTimeout(fromOFF(name)).catch(() => null);
  const [u, o] = await Promise.all([usda, off]);
  return u ?? o ?? null;
}

async function fromUSDA(name: string): Promise<Per100g | null> {
  const key = Deno.env.get('USDA_API_KEY');
  if (!key) return null;
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}&query=${encodeURIComponent(
    name,
  )}&pageSize=1&dataType=Survey%20%28FNDDS%29,SR%20Legacy,Foundation`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = await res.json();
  const food = j.foods?.[0];
  if (!food) return null;
  const get = (n: string) =>
    food.foodNutrients?.find((x: any) => (x.nutrientName ?? '').toLowerCase().includes(n))?.value ?? 0;
  return {
    kcal: Math.round(get('energy')),
    protein: round1(get('protein')),
    carbs: round1(get('carbohydrate')),
    fat: round1(get('total lipid') || get('fat')),
    source: 'usda',
  };
}

async function fromOFF(name: string): Promise<Per100g | null> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
    name,
  )}&search_simple=1&action=process&json=1&page_size=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Lume/0.1 (small group app)' } });
  if (!res.ok) return null;
  const j = await res.json();
  const p = j.products?.[0]?.nutriments;
  if (!p) return null;
  return {
    kcal: Math.round(p['energy-kcal_100g'] ?? 0),
    protein: round1(p.proteins_100g ?? 0),
    carbs: round1(p.carbohydrates_100g ?? 0),
    fat: round1(p.fat_100g ?? 0),
    source: 'openfoodfacts',
  };
}

export function scaleToGrams(per100: Per100g, grams: number) {
  const k = grams / 100;
  return {
    kcal: Math.round(per100.kcal * k),
    protein: round1(per100.protein * k),
    carbs: round1(per100.carbs * k),
    fat: round1(per100.fat * k),
    source: per100.source,
  };
}

function round1(n: number) { return Math.round(n * 10) / 10; }
