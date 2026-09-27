import { request as undiciRequest } from 'undici';
import { offDispatcher, normalizeProduct } from './openFoodFacts.js';
import { gradeProduct } from './grading.js';
import { resolveCategory } from './alternatives.js';

const SEARCH_BASE_URL = 'https://world.openfoodfacts.org/api/v2/search';
const REQUEST_TIMEOUT_MS = 10000;
const CANDIDATES_TO_FETCH = 20;
const RESULTS_WANTED = 3;
const SEARCH_FIELDS =
  'product_name,nutriments,nova_group,additives_n,code,categories_tags,image_small_url,image_url';
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Our internal category buckets don't always match Open Food Facts' own
// category vocabulary (e.g. we say "drinks", OFF categorizes as
// "beverages") — map to the term that actually finds matches there.
const CATEGORY_SEARCH_TERMS = {
  chocolate: 'chocolates',
  spreads: 'spreads',
  noodles: 'noodles',
  snacks: 'snacks',
  drinks: 'beverages',
  cereals: 'breakfast-cereals',
};

function buildHighlight(normalized, grading) {
  // gradeProduct's reasons list every scoring factor, including penalties
  // (e.g. "High sodium: ...") that a product can still absorb and grade
  // A/B overall — showing one of those as an alternative's "benefit" reads
  // backwards, so prefer an actual positive (bonus) reason when there is one.
  const positiveReason = grading.reasons.find((reason) => reason.startsWith('Good '));
  if (positiveReason) {
    return positiveReason;
  }
  const { sugar, protein } = normalized.nutrition;
  if (sugar != null && protein != null) {
    return `Sugar ${sugar}g · Protein ${protein}g per 100g`;
  }
  return 'Better nutritional profile';
}

async function fetchOnce(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await undiciRequest(url, {
      headers: { 'User-Agent': 'Swasthya-BarcodeScanner/1.0' },
      signal: controller.signal,
      dispatcher: offDispatcher,
    });
  } finally {
    clearTimeout(timeout);
  }
}

// OFF's search endpoint intermittently returns a transient 503 (seen
// repeatedly in practice) even when the request itself was fine — retry
// once before giving up, same as the barcode-lookup endpoint retries once
// on timeout. Each attempt still has its own REQUEST_TIMEOUT_MS budget.
async function fetchCandidates(searchTerm) {
  const url =
    `${SEARCH_BASE_URL}?categories_tags_en=${encodeURIComponent(searchTerm)}` +
    `&page_size=${CANDIDATES_TO_FETCH}&fields=${SEARCH_FIELDS}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[Alternatives] Searching OFF for "${searchTerm}" (attempt ${attempt})...`);

    try {
      const { statusCode, body } = await fetchOnce(url);

      if (statusCode !== 200) {
        console.error(`[Alternatives] Search returned status ${statusCode}`);
        if (attempt < MAX_ATTEMPTS) {
          await wait(RETRY_DELAY_MS);
          continue;
        }
        return null;
      }

      const data = await body.json();
      return data.products || [];
    } catch (err) {
      const timedOut = err.name === 'AbortError';
      console.error(`[Alternatives] Search ${timedOut ? 'timed out' : 'failed'}:`, err.message);
      return null;
    }
  }

  return null;
}

// Searches Open Food Facts for real products in `category`, grades each
// with the same algorithm used for scanned barcodes, and returns the first
// 3 that grade A or B. Returns null on any failure (network error, timeout,
// unknown category, or no A/B matches) so the caller can fall back to the
// Phase 1 hardcoded list.
export async function searchAlternatives(category, originalGrade) {
  const searchTerm = CATEGORY_SEARCH_TERMS[category];
  if (!searchTerm) {
    console.log(`[Alternatives] No OFF search term mapped for category "${category}"`);
    return null;
  }

  const candidates = await fetchCandidates(searchTerm);
  if (!candidates) {
    return null;
  }

  console.log(
    `[Alternatives] Grading ${candidates.length} candidates to replace a grade ${originalGrade} product...`
  );

  const seenNames = new Set();
  const goodMatches = [];

  for (const raw of candidates) {
    if (!raw.product_name) continue;

    const key = raw.product_name.trim().toLowerCase();
    if (seenNames.has(key)) continue;

    const normalized = normalizeProduct(raw.code || key, raw);
    // Skip entries with no real nutrition data at all — grading them would
    // silently default to a spuriously good score.
    if (normalized.nutrition.sugar == null && normalized.nutrition.protein == null) continue;

    // Open Food Facts' categories_tags_en search filter is looser than an
    // exact match — a search for "chocolates" can still surface a result
    // that's only tagged with the broader "snacks". Re-check each result's
    // own tags resolve to the same bucket we searched for, so a chocolate
    // search never quietly hands back a bag of chips.
    if (resolveCategory(normalized.categoryTags) !== category) continue;

    const grading = gradeProduct(normalized);
    if (grading.grade !== 'A' && grading.grade !== 'B') continue;

    seenNames.add(key);
    goodMatches.push({ name: raw.product_name.trim(), grade: grading.grade, grading, normalized });
  }

  if (goodMatches.length === 0) {
    console.log('[Alternatives] No A/B matches found in search results');
    return null;
  }

  // Prefer A over B, otherwise keep OFF's own relevance ordering.
  goodMatches.sort((a, b) => (a.grade === b.grade ? 0 : a.grade === 'A' ? -1 : 1));

  return goodMatches.slice(0, RESULTS_WANTED).map((match) => ({
    name: match.name,
    grade: match.grade,
    benefit: buildHighlight(match.normalized, match.grading),
    image: match.normalized.imageUrl,
  }));
}
