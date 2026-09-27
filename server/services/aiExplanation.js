import { getCached, setCached } from './aiCache.js';

const GEMINI_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// gemini-3.8-flash (the initial choice) turned out to be a newest/preview
// model with a free-tier quota of just 20 requests *per day* (confirmed via
// the API's own 429 body: quotaId "GenerateRequestsPerDayPerProjectPerModel
// -FreeTier", quotaValue 20) — normal manual testing exhausted it almost
// immediately. gemini-flash-lite-latest (currently gemini-3.5-flash-lite)
// has no such wall in the same testing (15 rapid-fire calls, zero 429s) and
// has no mandatory "thinking" token overhead, so it's also ~5-10x faster
// (~1-2s vs 5-20s). Don't add thinkingConfig back for this model — it
// doesn't support the field and 400s if it's present.
const MODEL = 'gemini-flash-lite-latest';
// Per-attempt timeout, not the total budget — callGemini retries once (see
// below). Measured directly against this model: successful calls finish in
// ~1-2s, but roughly a third of calls hang with literally no response for
// the full timeout duration (not "slow", genuinely stuck) rather than
// erroring — a real, reproducible reliability gap in the endpoint, not
// something a longer timeout fixes. Retrying once recovered 10/10 in
// testing (7 succeeded first try, all 3 failures recovered on retry), same
// pattern already used for the OFF API calls elsewhere in this codebase.
const EXPLAIN_ATTEMPT_TIMEOUT_MS = 5000;
const COMPARE_ATTEMPT_TIMEOUT_MS = 6000;
const RETRY_DELAY_MS = 300;

async function callGeminiOnce(prompt, timeoutMs) {
  const apiKey = process.env.GEMINI_API_KEY;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${GEMINI_URL_BASE}/${MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 150, temperature: 0.4 },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[AI] Gemini API returned status ${res.status}: ${body.slice(0, 300)}`);
      return null;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
  } catch (err) {
    const timedOut = err.name === 'AbortError';
    console.error(`[AI] Gemini call ${timedOut ? 'timed out' : 'failed'}:`, err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGemini(prompt, attemptTimeoutMs) {
  if (!process.env.GEMINI_API_KEY) return null;

  const first = await callGeminiOnce(prompt, attemptTimeoutMs);
  if (first) return first;

  await wait(RETRY_DELAY_MS);
  return callGeminiOnce(prompt, attemptTimeoutMs);
}

// Deterministic, template-based explanation built only from what
// gradeProduct() already computed — used whenever the AI call is
// unavailable (no key, timeout, API error) so the feature never just
// disappears.
function fallbackExplanation({ grade, reasons }) {
  if (!reasons || reasons.length === 0) {
    return `This product graded ${grade}.`;
  }
  return `This product graded ${grade} because of: ${reasons.join(', ')}.`;
}

// { barcode, grade, totalScore, reasons } -> short plain-language
// explanation. Uses only the passed-in grading result — no recalculating,
// no outside facts. Cached by barcode+grade (1h) so re-scanning the same
// product doesn't burn a second API call — but only real AI successes are
// cached, so a failed call still retries fresh next time instead of
// locking in the fallback for an hour.
export async function explainGrade({ barcode, grade, totalScore, reasons }) {
  const cacheKey = `explain:${barcode}:${grade}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const prompt =
    `A food product was graded ${grade} (internal score ${totalScore}, where lower is healthier) ` +
    `by a nutrition scoring system. The specific reasons the system flagged were: ` +
    `${reasons.length ? reasons.join('; ') : 'none in particular'}.\n\n` +
    `Explain this in your own words in 1-2 short, friendly sentences — don't just list the ` +
    `factors back verbatim, reword it like you're actually talking to someone. ` +
    `Use only the reasons given above — don't invent nutrition facts, don't make medical claims, ` +
    `don't mention the internal score number. No markdown.`;

  const aiText = await callGemini(prompt, EXPLAIN_ATTEMPT_TIMEOUT_MS);
  if (aiText) {
    setCached(cacheKey, aiText);
    return aiText;
  }
  return fallbackExplanation({ grade, reasons });
}

function fallbackComparison({ original, alternative }) {
  const parts = [];
  const o = original.nutrition || {};
  const a = alternative.nutrition || {};

  if (o.sugar != null && a.sugar != null) {
    const diff = +(o.sugar - a.sugar).toFixed(1);
    if (diff > 0) parts.push(`${diff}g less sugar`);
    else if (diff < 0) parts.push(`${Math.abs(diff)}g more sugar`);
  }
  if (o.sodium != null && a.sodium != null) {
    const diffMg = Math.round((o.sodium - a.sodium) * 1000);
    if (diffMg > 0) parts.push(`${diffMg}mg less sodium`);
    else if (diffMg < 0) parts.push(`${Math.abs(diffMg)}mg more sodium`);
  }
  if (o.protein != null && a.protein != null) {
    const diff = +(a.protein - o.protein).toFixed(1);
    if (diff > 0) parts.push(`${diff}g more protein`);
  }

  const comparison = parts.length ? parts.join(', ') : 'a different nutritional profile';
  return `${alternative.name} (grade ${alternative.grade}) has ${comparison} than the scanned product (grade ${original.grade}).`;
}

// { original: {barcode, name, grade, nutrition}, alternative: {name, grade,
// nutrition} } -> short comparison. Uses only the real numbers passed in for
// both products. Cached by original-barcode+alternative-name (1h), same
// cache-successes-only rule as explainGrade.
export async function compareAlternative({ original, alternative }) {
  const cacheKey = `compare:${original.barcode || original.name || 'unknown'}:${alternative.name}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const fmt = (n) =>
    n == null
      ? 'unknown'
      : `sugar ${n.sugar ?? 'unknown'}g, sodium ${n.sodium != null ? Math.round(n.sodium * 1000) + 'mg' : 'unknown'}, ` +
        `protein ${n.protein ?? 'unknown'}g, additives ${n.additivesCount ?? 'unknown'}`;

  const prompt =
    `Scanned product: grade ${original.grade}, per 100g — ${fmt(original.nutrition)}.\n` +
    `Alternative: ${alternative.name}, grade ${alternative.grade}, per 100g — ${fmt(alternative.nutrition)}.\n\n` +
    `In 1 short, plain-English sentence, compare the alternative to the scanned product using only these numbers. ` +
    `Don't invent facts, don't make medical claims, don't recalculate or mention a different grade than given. ` +
    `Be direct and conversational, no markdown.`;

  const aiText = await callGemini(prompt, COMPARE_ATTEMPT_TIMEOUT_MS);
  if (aiText) {
    setCached(cacheKey, aiText);
    return aiText;
  }
  return fallbackComparison({ original, alternative });
}
