const GEMINI_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-3.8-flash';
// gemini-3.8-flash burns a mandatory chunk of internal "thinking" tokens
// even on trivial prompts (~200+ tokens, several seconds) regardless of
// thinkingBudget — confirmed by direct testing, real responses have taken
// anywhere from ~5s to ~20s. Two different timeout budgets below reflect two
// different blast radii, not two different opinions of the model:
//
// - explainGrade() runs inside POST /api/scan, which blocks the entire
//   barcode-scan result (not just the AI card) until it resolves — capped
//   short so a slow Gemini response can't turn a barcode scan into a
//   multi-second stall for something the user didn't explicitly ask to wait
//   on.
// - compareAlternative() runs behind its own explicit "Why is this better?"
//   click, with its own dedicated per-card loading spinner in the UI — the
//   user already opted into waiting for this one, so it can afford to give
//   Gemini the room the model actually needs.
const EXPLAIN_TIMEOUT_MS = 8000;
const COMPARE_TIMEOUT_MS = 20000;

async function callGemini(prompt, timeoutMs) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${GEMINI_URL_BASE}/${MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 150,
          temperature: 0.4,
          thinkingConfig: { thinkingBudget: 0 },
        },
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

// { grade, totalScore, reasons } -> short plain-language explanation.
// Uses only the passed-in grading result — no recalculating, no outside facts.
export async function explainGrade({ grade, totalScore, reasons }) {
  const prompt =
    `A food product was graded ${grade} (internal score ${totalScore}, where lower is healthier) ` +
    `by a nutrition scoring system. The specific reasons the system flagged were: ` +
    `${reasons.length ? reasons.join('; ') : 'none in particular'}.\n\n` +
    `In 1-2 short, plain-English sentences, explain to a shopper why this product got this grade. ` +
    `Use only the reasons given above — don't invent nutrition facts, don't make medical claims, ` +
    `don't mention the internal score number. Be direct and conversational, no markdown.`;

  const aiText = await callGemini(prompt, EXPLAIN_TIMEOUT_MS);
  return aiText || fallbackExplanation({ grade, reasons });
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

// { original: {grade, nutrition}, alternative: {name, grade, nutrition} } ->
// short comparison. Uses only the real numbers passed in for both products.
export async function compareAlternative({ original, alternative }) {
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

  const aiText = await callGemini(prompt, COMPARE_TIMEOUT_MS);
  return aiText || fallbackComparison({ original, alternative });
}
