import dns from 'node:dns';
import { Agent, request as undiciRequest } from 'undici';

const OFF_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 2;

// The OS DNS resolver fails to resolve world.openfoodfacts.org on some
// networks (times out) even though the domain resolves fine via public DNS.
// Route just this client's lookups through 8.8.8.8/1.1.1.1 instead of
// depending on the system resolver.
const publicDns = new dns.promises.Resolver();
publicDns.setServers(['8.8.8.8', '1.1.1.1']);

async function lookupViaPublicDns(hostname, options, callback) {
  try {
    const addresses = await publicDns.resolve4(hostname);
    if (options.all) {
      callback(null, addresses.map((address) => ({ address, family: 4 })));
    } else {
      callback(null, addresses[0], 4);
    }
  } catch (err) {
    callback(err);
  }
}

const offDispatcher = new Agent({ connect: { lookup: lookupViaPublicDns } });

function normalizeProduct(barcode, product) {
  const nutriments = product.nutriments || {};

  return {
    found: true,
    barcode,
    name: product.product_name || product.generic_name || 'Unknown product',
    brand: product.brands || 'Unknown brand',
    quantity: product.quantity || null,
    nutrition: {
      energyKcal: nutriments['energy-kcal_100g'] ?? null,
      sugar: nutriments['sugars_100g'] ?? null,
      protein: nutriments['proteins_100g'] ?? null,
      saturatedFat: nutriments['saturated-fat_100g'] ?? null,
      sodium: nutriments['sodium_100g'] ?? null,
      fiber: nutriments['fiber_100g'] ?? null,
    },
    additivesCount: product.additives_n ?? null,
    novaGroup: product.nova_group ?? null,
  };
}

async function fetchWithTimeout(barcode) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // Uses undici's own request()/dispatcher pair (not the global fetch) so
    // the custom-DNS Agent stays version-matched with the client issuing the
    // request — mixing an npm `undici` Agent into Node's built-in fetch
    // throws (their internal handler interfaces can diverge across versions).
    return await undiciRequest(`${OFF_BASE_URL}/${barcode}.json`, {
      headers: { 'User-Agent': 'Swasthya-BarcodeScanner/1.0' },
      signal: controller.signal,
      dispatcher: offDispatcher,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchProductByBarcode(barcode) {
  let statusCode, body;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[API] Fetching from OFF (attempt ${attempt})...`);
    try {
      ({ statusCode, body } = await fetchWithTimeout(barcode));
      break;
    } catch (err) {
      const timedOut = err.name === 'AbortError';

      if (timedOut && attempt < MAX_ATTEMPTS) {
        console.log('[API] Timeout, retrying...');
        continue;
      }
      if (timedOut) {
        console.error('[API] Failed after retries');
        return { found: false, message: 'Open Food Facts API is slow - try again' };
      }

      console.error('[API] Request failed:', err.message);
      return { found: false, message: 'API error, try again' };
    }
  }

  console.log('[API] Success');

  // OFF returns HTTP 404 (with a JSON body) for a barcode it doesn't know
  // about — that's a normal "not found" outcome, not a server failure.
  if (statusCode !== 200 && statusCode !== 404) {
    console.error(`[API] Unexpected status ${statusCode}`);
    await body.dump();
    return { found: false, message: 'API error, try again' };
  }

  let data;
  try {
    data = await body.json();
  } catch (err) {
    console.error('[API] Failed to parse response:', err.message);
    return { found: false, message: 'API error, try again' };
  }

  if (data.status !== 1 || !data.product) {
    return { found: false, message: 'Barcode not found in database' };
  }

  return normalizeProduct(barcode, data.product);
}
