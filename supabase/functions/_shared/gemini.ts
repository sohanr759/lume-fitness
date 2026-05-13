// Minimal Gemini 2.5 Flash wrapper (free tier).
// Docs: https://ai.google.dev/api/generate-content
const ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export async function geminiJson<T>(opts: {
  prompt: string;
  imageBase64?: string;
  mimeType?: string;
  timeoutMs?: number;
}): Promise<T> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY missing');

  const parts: any[] = [{ text: opts.prompt }];
  if (opts.imageBase64) {
    parts.push({ inline_data: { mime_type: opts.mimeType ?? 'image/jpeg', data: opts.imageBase64 } });
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
  try {
    const res = await fetch(`${ENDPOINT}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('gemini empty response');
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,'').trim();
    return JSON.parse(cleaned) as T;
  } finally {
    clearTimeout(t);
  }
}
