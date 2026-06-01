import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Transaction } from '@mysten/sui/transactions';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Config ───────────────────────────────────────────────────────────────────

const TATUM_API_KEY         = process.env.TATUM_API_KEY || '';
// Mainnet key is used for Tatum Data API (exchange rates) — separate from RPC key
const TATUM_MAINNET_API_KEY = process.env.TATUM_MAINNET_API_KEY || TATUM_API_KEY;
const SUI_NETWORK   = (process.env.SUI_NETWORK || 'testnet') as 'testnet' | 'mainnet';
const PACKAGE_ID    = process.env.PACKAGE_ID  || '0x0';
const ADMIN_CAP_ID  = process.env.ADMIN_CAP_ID || '0x0';
const ADMIN_KEY     = process.env.ADMIN_PRIVATE_KEY || '';

const TATUM_RPC: Record<string, string> = {
  mainnet: 'https://sui-mainnet.gateway.tatum.io',
  testnet: 'https://sui-testnet.gateway.tatum.io',
};
const PUBLIC_RPC: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
};

function getRpcUrl(): string {
  return TATUM_API_KEY ? TATUM_RPC[SUI_NETWORK] : PUBLIC_RPC[SUI_NETWORK];
}

// Sui RPC for the backend. We use the public fullnode by default: the Tatum
// gateway rate-limits and doesn't implement some methods needed for transaction
// submission (e.g. suix_getLatestSuiSystemState), so settlement fails through it.
// Override with SUI_RPC_URL if you have a CORS/method-complete premium endpoint.
function getSuiClient(): SuiJsonRpcClient {
  const url = process.env.SUI_RPC_URL || PUBLIC_RPC[SUI_NETWORK];
  return new SuiJsonRpcClient({ url, network: SUI_NETWORK });
}

/**
 * Raw JSON-RPC helper — works around SuiJsonRpcClient missing methods like
 * queryEvents on some @mysten/sui v2.x builds.
 */
async function suiRpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const url = process.env.SUI_RPC_URL || PUBLIC_RPC[SUI_NETWORK];
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Sui RPC HTTP ${res.status}`);
  const json = await res.json() as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(`Sui RPC error: ${json.error.message}`);
  return json.result as T;
}

// ── Market prices: Tatum (primary) + CoinGecko (backup) ───────────────────────

const ALL_SYMBOLS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'SUI', 'DOGE', 'ADA', 'AVAX', 'LINK',
  'MATIC', 'DOT', 'UNI', 'LTC', 'BCH', 'ALGO', 'ATOM', 'APT', 'ARB', 'FIL',
] as const;

let priceCache: Record<string, number> = {};
let priceCacheTime = 0;
let lastPriceSource = 'none';

const COINGECKO_IDS: Record<string, string> = {
  BTC:  'bitcoin',      ETH:  'ethereum',   SOL:  'solana',       SUI:  'sui',
  AVAX: 'avalanche-2',  LINK: 'chainlink',  DOT:  'polkadot',     DOGE: 'dogecoin',
  UNI:  'uniswap',      MATIC:'polygon-ecosystem-token', ADA: 'cardano', ATOM: 'cosmos',
  XRP:  'ripple',       BNB:  'binancecoin',LTC:  'litecoin',     BCH:  'bitcoin-cash',
  ALGO: 'algorand',     APT:  'aptos',      ARB:  'arbitrum',     FIL:  'filecoin',
};

/** Min interval between upstream fetches (background + coalesced client polls). */
const PRICE_REFRESH_MS = 8_000;
const STALE_PRICE_MAX_AGE_MS = 30 * 60_000;
const CG_BACKOFF_MS = 180_000;
const PRICE_CACHE_FILE = path.join(process.cwd(), '.price-cache.json');
const PRICE_ERROR_LOG_MS = 60_000;

let priceFetchInFlight: Promise<Record<string, number>> | null = null;
let cgBackoffUntil = 0;
let lastUpstreamFetchAt = 0;
let lastPriceErrorLog: Record<string, number> = {};

function logPriceWarn(key: string, message: string): void {
  const now = Date.now();
  if (now - (lastPriceErrorLog[key] ?? 0) < PRICE_ERROR_LOG_MS) return;
  lastPriceErrorLog[key] = now;
  console.warn(`[prices] ${message}`);
}

function coingeckoIdsForSymbols(symbols: string[]): string[] {
  const ids = new Set<string>();
  for (const sym of symbols) {
    if (sym === 'MATIC') {
      ids.add('polygon-ecosystem-token');
      ids.add('matic-network');
    } else if (COINGECKO_IDS[sym]) {
      ids.add(COINGECKO_IDS[sym]);
    }
  }
  return [...ids];
}

function parseCoingeckoResponse(
  data: Record<string, { usd: number }>,
  targetSymbols: string[],
): Record<string, number> {
  const prices: Record<string, number> = {};
  for (const symbol of targetSymbols) {
    const geckoId = COINGECKO_IDS[symbol];
    if (geckoId && data[geckoId]?.usd) prices[symbol] = data[geckoId].usd;
  }
  if (targetSymbols.includes('MATIC') && !prices.MATIC) {
    const pol = data['polygon-ecosystem-token']?.usd ?? data['matic-network']?.usd;
    if (pol) prices.MATIC = pol;
  }
  return prices;
}

function loadPriceCacheFromDisk(): void {
  try {
    if (!fs.existsSync(PRICE_CACHE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(PRICE_CACHE_FILE, 'utf8')) as {
      prices?: Record<string, number>;
      cachedAt?: number;
      source?: string;
    };
    if (raw.prices && Object.keys(raw.prices).length > 0) {
      priceCache = raw.prices;
      priceCacheTime = raw.cachedAt ?? Date.now();
      lastPriceSource = raw.source ?? 'cache';
      console.log(`[prices] Loaded ${Object.keys(priceCache).length} asset(s) from disk cache`);
    }
  } catch (err) {
    console.warn('[prices] Could not load disk cache:', err instanceof Error ? err.message : err);
  }
}

function persistPriceCacheToDisk(): void {
  try {
    fs.writeFileSync(
      PRICE_CACHE_FILE,
      JSON.stringify({ prices: priceCache, cachedAt: priceCacheTime, source: lastPriceSource }),
    );
  } catch {
    /* ignore */
  }
}

async function fetchMaticFromBinance(): Promise<number | null> {
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=MATICUSDT', {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { price?: string };
    const p = parseFloat(String(data.price ?? '0'));
    return p > 0 ? p : null;
  } catch {
    return null;
  }
}

async function fillMissingSymbols(prices: Record<string, number>, symbols: string[]): Promise<void> {
  if (symbols.includes('MATIC') && (!prices.MATIC || prices.MATIC <= 0)) {
    const fromBinance = await fetchMaticFromBinance();
    if (fromBinance) prices.MATIC = fromBinance;
  }
}

async function fetchFromCoinGecko(symbols?: string[]): Promise<Record<string, number>> {
  if (Date.now() < cgBackoffUntil) {
    throw new Error('CoinGecko backoff');
  }

  const targetSymbols = symbols?.length
    ? symbols.filter((s) => COINGECKO_IDS[s] || s === 'MATIC')
    : [...ALL_SYMBOLS];
  const ids = coingeckoIdsForSymbols(targetSymbols).join(',');
  if (!ids) return {};

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 429) {
      cgBackoffUntil = Date.now() + CG_BACKOFF_MS;
      throw new Error('CoinGecko 429');
    }
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json() as Record<string, { usd: number }>;

    return parseCoingeckoResponse(data, targetSymbols);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tatum Exchange Rate API — batch fetch using the mainnet API key.
 * Endpoint: POST https://api.tatum.io/v4/data/rate/symbol/batch
 * Docs: https://docs.tatum.io/reference/getexchangerates
 *
 * Request body: array of { batchId, symbol, basePair }
 * Response: array of { batchId, symbol, basePair, value (string), timestamp, source }
 *
 * Note: Tatum only has exchange-rate data for well-known CEX-listed tokens.
 * Symbols not in their DB cause a 403 for the entire batch, so we only request
 * confirmed-supported symbols and merge the rest from CoinGecko.
 */
/** Symbols with confirmed Tatum exchange-rate data (others filled by CoinGecko). */
const TATUM_RATE_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'LINK', 'MATIC', 'UNI', 'LTC', 'BCH', 'ALGO'];

async function fetchFromTatumWithKey(apiKey: string): Promise<Record<string, number>> {
  const body = TATUM_RATE_SYMBOLS.map((sym) => ({
    batchId: sym,
    symbol: sym,
    basePair: 'USD',
  }));

  const res = await fetch('https://api.tatum.io/v4/data/rate/symbol/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Tatum exchange-rate HTTP ${res.status}: ${text.slice(0, 120)}`);
  }

  const data = await res.json() as Array<{ batchId?: string; symbol?: string; value?: string | number }>;
  if (!Array.isArray(data)) throw new Error('Tatum returned unexpected format');

  const prices: Record<string, number> = {};
  for (const item of data) {
    const sym = (item.batchId ?? item.symbol ?? '').toUpperCase();
    const price = parseFloat(String(item.value ?? '0'));
    if (sym && price > 0) prices[sym] = price;
  }

  if (Object.keys(prices).length === 0) throw new Error('Tatum returned empty price set');
  return prices;
}

async function fetchFromTatum(): Promise<Record<string, number>> {
  const keys = [...new Set([TATUM_MAINNET_API_KEY, TATUM_API_KEY].filter(Boolean))];
  if (keys.length === 0) throw new Error('No Tatum API key');

  let lastErr: Error | null = null;
  for (const key of keys) {
    try {
      return await fetchFromTatumWithKey(key);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastErr ?? new Error('Tatum failed');
}

function symbolsMissingFromTatum(tatumPrices: Record<string, number>): string[] {
  return ALL_SYMBOLS.filter((sym) => !tatumPrices[sym] || tatumPrices[sym] <= 0);
}

async function refreshPricesUpstream(): Promise<Record<string, number>> {
  let source = 'none';
  let tatumPrices: Record<string, number> = {};
  try {
    tatumPrices = await fetchFromTatum();
    source = 'tatum';
  } catch (tatumErr) {
    logPriceWarn('tatum', `Tatum unavailable: ${(tatumErr as Error).message}`);
  }

  const missing = symbolsMissingFromTatum(tatumPrices);
  let cgPrices: Record<string, number> = {};
  if (missing.length > 0) {
    try {
      cgPrices = await fetchFromCoinGecko(missing);
      if (source === 'none' && Object.keys(cgPrices).length > 0) source = 'coingecko';
    } catch (cgErr) {
      logPriceWarn('coingecko', `CoinGecko failed: ${(cgErr as Error).message}`);
    }
  }

  const prices = { ...priceCache, ...cgPrices, ...tatumPrices };
  await fillMissingSymbols(prices, [...ALL_SYMBOLS]);

  if (Object.keys(tatumPrices).length > 0 && Object.keys(cgPrices).length > 0) {
    source = 'tatum+coingecko';
  } else if (Object.keys(tatumPrices).length > 0) {
    source = 'tatum';
  } else if (Object.keys(cgPrices).length > 0) {
    source = 'coingecko';
  } else if (Object.keys(prices).length > 0) {
    source = lastPriceSource === 'none' ? 'cache' : lastPriceSource;
  }
  if (prices.MATIC && !tatumPrices.MATIC && !cgPrices.MATIC && source !== 'cache') {
    source = source === 'coingecko' ? 'coingecko+binance' : `${source}+binance`;
  }
  lastPriceSource = source;
  lastUpstreamFetchAt = Date.now();

  if (Object.keys(prices).length === 0) {
    if (Object.keys(priceCache).length > 0) {
      logPriceWarn('upstream', 'Upstream empty — keeping existing cache');
      return priceCache;
    }
    throw new Error('Tatum and CoinGecko both failed');
  }

  const count = Object.keys(prices).length;
  const hasMatic = (prices.MATIC ?? 0) > 0;
  console.log(`[prices] ${count} assets via ${lastPriceSource}${hasMatic ? '' : ' (MATIC missing)'}`);
  priceCache = prices;
  priceCacheTime = Date.now();
  persistPriceCacheToDisk();
  return prices;
}

function schedulePriceRefresh(): void {
  if (priceFetchInFlight) return;
  if (Date.now() - lastUpstreamFetchAt < PRICE_REFRESH_MS) return;
  priceFetchInFlight = refreshPricesUpstream()
    .catch((err) => {
      if (Object.keys(priceCache).length > 0) {
        logPriceWarn('bg-refresh', `Background refresh failed — keeping cache: ${(err as Error).message}`);
        return priceCache;
      }
      logPriceWarn('bg-refresh', `Background refresh failed (no cache yet): ${(err as Error).message}`);
      return {};
    })
    .finally(() => {
      priceFetchInFlight = null;
    });
}

async function fetchMarketPrices(options?: { force?: boolean }): Promise<Record<string, number>> {
  const now = Date.now();
  const cacheAge = now - priceCacheTime;
  const hasCache = Object.keys(priceCache).length > 0;

  if (hasCache && cacheAge < STALE_PRICE_MAX_AGE_MS) {
    if (cacheAge >= PRICE_REFRESH_MS) schedulePriceRefresh();
    if (!options?.force || cacheAge < PRICE_REFRESH_MS) {
      return priceCache;
    }
  }

  if (priceFetchInFlight) {
    try {
      return await priceFetchInFlight;
    } catch {
      if (hasCache && cacheAge < STALE_PRICE_MAX_AGE_MS) {
        console.warn('[prices] Live fetch failed — serving stale cache');
        return priceCache;
      }
      throw new Error('Price fetch failed');
    }
  }

  if (!options?.force && hasCache && cacheAge < PRICE_REFRESH_MS) {
    return priceCache;
  }

  priceFetchInFlight = refreshPricesUpstream()
    .catch((err) => {
      if (hasCache && cacheAge < STALE_PRICE_MAX_AGE_MS) {
        console.warn('[prices] Live fetch failed — serving stale cache');
        return priceCache;
      }
      throw err;
    })
    .finally(() => {
      priceFetchInFlight = null;
    });

  return priceFetchInFlight;
}

/** @deprecated Use fetchMarketPrices — kept for settlement import */
const fetchPythPrices = fetchMarketPrices;

// ── Walrus helpers ────────────────────────────────────────────────────────────

const WALRUS_PUBLISHER  = process.env.WALRUS_PUBLISHER  || 'https://publisher.walrus-testnet.walrus.space';
const WALRUS_AGGREGATOR = process.env.WALRUS_AGGREGATOR || 'https://aggregator.walrus-testnet.walrus.space';

/** In-memory blob cache — used when Walrus testnet is down or content-hash IDs are used. */
const blobCache = new Map<string, string>();
const BLOB_CACHE_FILE = path.join(process.cwd(), '.blob-cache.json');
let blobCacheSaveTimer: ReturnType<typeof setTimeout> | null = null;

function sha256hex(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function isContentHashBlobId(blobId: string): boolean {
  return /^[a-f0-9]{64}$/i.test(blobId);
}

function loadBlobCacheFromDisk(): void {
  try {
    if (!fs.existsSync(BLOB_CACHE_FILE)) return;
    const raw = fs.readFileSync(BLOB_CACHE_FILE, 'utf8');
    const obj = JSON.parse(raw) as Record<string, string>;
    for (const [id, data] of Object.entries(obj)) blobCache.set(id, data);
    console.log(`[Walrus] Loaded ${blobCache.size} blob(s) from disk cache`);
  } catch (err) {
    console.warn('[Walrus] Could not load disk cache:', err instanceof Error ? err.message : err);
  }
}

function persistBlobCacheToDisk(): void {
  if (blobCacheSaveTimer) return;
  blobCacheSaveTimer = setTimeout(() => {
    blobCacheSaveTimer = null;
    try {
      fs.writeFileSync(BLOB_CACHE_FILE, JSON.stringify(Object.fromEntries(blobCache)));
    } catch { /* ignore */ }
  }, 400);
}

function cacheBlob(blobId: string, data: string): void {
  blobCache.set(blobId, data);
  persistBlobCacheToDisk();
}

loadBlobCacheFromDisk();
loadPriceCacheFromDisk();

async function storeOnWalrus(data: string): Promise<string> {
  const res = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=10`, {
    method: 'PUT',
    body: data,
    headers: { 'Content-Type': 'application/octet-stream' },
    signal: AbortSignal.timeout(15_000),
  });

  // The publisher returns plain-text errors (e.g. "the publisher is at capacity")
  // on failure — guard before parsing JSON.
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Walrus publisher HTTP ${res.status}: ${body.slice(0, 120)}`);
  }

  const raw = await res.text();
  let result: { newlyCreated?: { blobObject: { blobId: string } }; alreadyCertified?: { blobId: string } };
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error(`Walrus publisher returned non-JSON: ${raw.slice(0, 120)}`);
  }
  if (result.newlyCreated)     return result.newlyCreated.blobObject.blobId;
  if (result.alreadyCertified) return result.alreadyCertified.blobId;
  throw new Error('Unexpected Walrus response: ' + raw.slice(0, 120));
}

async function readFromWalrus(blobId: string): Promise<string> {
  const res = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`, {
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Walrus read failed: ${res.status}`);
  return res.text();
}

/** Read blob: server cache first, then Walrus aggregator. */
async function readBlobData(blobId: string): Promise<string> {
  const cached = blobCache.get(blobId);
  if (cached != null) return cached;
  if (isContentHashBlobId(blobId)) {
    throw new Error(`Blob not in server cache (${blobId.slice(0, 16)}…)`);
  }
  const text = await readFromWalrus(blobId);
  cacheBlob(blobId, text);
  return text;
}

// ── Return calculation ────────────────────────────────────────────────────────

interface IndexAsset { symbol: string; weight: number; }
interface IndexComposition { assets: IndexAsset[]; creator: string; timestamp: number; }

function calculateWeightedReturn(
  assets: IndexAsset[],
  startPrices: Record<string, number>,
  endPrices: Record<string, number>
): number {
  let total = 0;
  for (const asset of assets) {
    const start = startPrices[asset.symbol];
    const end   = endPrices[asset.symbol];
    if (!start || !end) continue;
    const ret = ((end - start) / start) * 100;
    total += ret * (asset.weight / 100);
  }
  return total;
}

/** Convert return percentage to basis points: 0% → 10000, +10% → 11000, -5% → 9500 */
function returnToBps(pct: number): number {
  return Math.round(10000 + pct * 100);
}

// ── On-chain settlement ───────────────────────────────────────────────────────

async function settleDuelOnChain(
  duelId: string,
  creatorReturnBps: number,
  opponentReturnBps: number,
  resultBlobId: string
): Promise<string> {
  if (!ADMIN_KEY) throw new Error('ADMIN_PRIVATE_KEY not set');
  if (PACKAGE_ID === '0x0') throw new Error('PACKAGE_ID not set');

  // Accept both suiprivkey... bech32 (from `sui keytool export`) and raw hex
  let keypair: Ed25519Keypair;
  if (ADMIN_KEY.startsWith('suiprivkey')) {
    const { secretKey } = decodeSuiPrivateKey(ADMIN_KEY);
    keypair = Ed25519Keypair.fromSecretKey(secretKey);
  } else {
    keypair = Ed25519Keypair.fromSecretKey(
      Uint8Array.from(Buffer.from(ADMIN_KEY.replace('0x', ''), 'hex'))
    );
  }
  const client = getSuiClient();

  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::index_duel::settle_duel`,
    arguments: [
      tx.object(ADMIN_CAP_ID),
      tx.object(duelId),
      tx.pure.u64(creatorReturnBps),
      tx.pure.u64(opponentReturnBps),
      tx.pure.string(resultBlobId),
      tx.object('0x6'), // clock
    ],
  });

  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true },
  });

  return result.digest;
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    network: SUI_NETWORK,
    rpc: getRpcUrl(),
    contractDeployed: PACKAGE_ID !== '0x0',
  });
});

/**
 * GET /api/prices
 * Live prices — Tatum primary, CoinGecko backup. Returns cache quickly; refreshes upstream ~every 4s.
 */
app.get('/api/prices', async (req, res) => {
  try {
    const force = req.query.fresh === '1';
    const prices = await fetchMarketPrices({ force });
    res.json({
      success: true,
      prices,
      source: lastPriceSource,
      cachedAt: priceCacheTime,
      stale: Date.now() - priceCacheTime > PRICE_REFRESH_MS,
    });
  } catch (error) {
    if (Object.keys(priceCache).length > 0) {
      res.json({
        success: true,
        prices: priceCache,
        source: lastPriceSource,
        cachedAt: priceCacheTime,
        stale: true,
      });
      return;
    }
    console.error('Failed to fetch prices:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch prices' });
  }
});

/**
 * GET /api/prices/snapshot
 * Force-fresh prices for duel start (join flow). Never served from stale cache.
 */
app.get('/api/prices/snapshot', async (_req, res) => {
  try {
    const prices = await fetchMarketPrices({ force: true });
    res.json({
      success: true,
      prices,
      timestamp: Date.now(),
      source: lastPriceSource,
    });
  } catch (error) {
    console.error('Failed to create price snapshot:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch snapshot prices' });
  }
});

/**
 * GET /api/walrus/:blobId
 * Read any blob from Walrus (proxy to avoid CORS).
 */
app.get('/api/walrus/:blobId', async (req, res) => {
  try {
    const raw = await readBlobData(req.params.blobId);
    res.json({ success: true, data: JSON.parse(raw) });
  } catch (error) {
    res.status(404).json({ success: false, error: error instanceof Error ? error.message : 'Blob not found' });
  }
});

/**
 * POST /api/walrus/cache
 * Register blob content by ID (content-hash fallback from the browser).
 * Body: { blobId: string, data: string }
 */
app.post('/api/walrus/cache', (req, res) => {
  const { blobId, data } = req.body as { blobId?: string; data?: string };
  if (!blobId || data == null) {
    return res.status(400).json({ success: false, error: 'Missing blobId or data' });
  }
  cacheBlob(blobId, data);
  console.log(`[Walrus] Cached blob ${blobId.slice(0, 16)}... (${data.length} bytes)`);
  return res.json({ success: true, blobId });
});

/**
 * POST /api/walrus/store
 * Store a blob on Walrus (proxy to avoid browser CORS).
 * Falls back to content-hash ID + server cache when Walrus is unavailable.
 * Body: { data: string }
 */
app.post('/api/walrus/store', async (req, res) => {
  try {
    const { data } = req.body as { data?: string };
    if (!data) return res.status(400).json({ success: false, error: 'Missing data field' });
    console.log(`[Walrus] Storing blob — ${data.length} bytes`);
    try {
      const blobId = await storeOnWalrus(data);
      cacheBlob(blobId, data);
      console.log(`[Walrus] Stored ✓ blobId: ${blobId}`);
      return res.json({ success: true, blobId, source: 'walrus' });
    } catch (walrusErr) {
      const blobId = sha256hex(data);
      cacheBlob(blobId, data);
      console.warn(
        `[Walrus] Publisher unavailable — cached locally as ${blobId.slice(0, 16)}...`,
        walrusErr instanceof Error ? walrusErr.message : walrusErr
      );
      return res.json({ success: true, blobId, source: 'cache' });
    }
  } catch (error) {
    console.error('[Walrus] Store failed:', error);
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Store failed' });
  }
});

// ── Settlement core (shared by the API route and the auto-settler) ───────────

// Tracks duels currently being settled (avoid double-submit) and ones already settled.
const settling = new Set<string>();
const settledDuels = new Set<string>();
/** Duels we can't settle (missing Walrus blobs, etc.) — don't spam retries. */
const abandonedSettleDuels = new Set<string>();

const DUEL_STATUS_ACTIVE = 1;
const DUEL_STATUS_SETTLED = 2;

let lastSettleErrorLog: Record<string, number> = {};

function logSettleWarn(duelId: string, message: string): void {
  const now = Date.now();
  const key = duelId.slice(0, 10);
  if (now - (lastSettleErrorLog[key] ?? 0) < 60_000) return;
  lastSettleErrorLog[key] = now;
  console.warn(`[settle] ${duelId.slice(0, 10)}… ${message}`);
}

function isTransientSettleError(message: string): boolean {
  return /fetch failed|timed out|timeout|ECONNRESET|429|502|503/i.test(message);
}

async function getDuelStatus(duelId: string): Promise<number | null> {
  try {
    const client = getSuiClient();
    const obj = await client.getObject({ id: duelId, options: { showContent: true } });
    if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') return null;
    return Number((obj.data.content.fields as Record<string, unknown>).status);
  } catch {
    return null;
  }
}

/** Seed skip-list from on-chain DuelSettled events so we don't retry finished duels. */
async function loadAlreadySettledDuels(): Promise<void> {
  if (PACKAGE_ID === '0x0') return;
  try {
    const events = await suiRpcCall<{ data: Array<{ parsedJson: unknown }> }>(
      'suix_queryEvents',
      [{ MoveEventType: `${PACKAGE_ID}::index_duel::DuelSettled` }, null, 200, false]
    );
    for (const ev of events.data) {
      const p = ev.parsedJson as { duel_id?: string };
      if (p?.duel_id) settledDuels.add(p.duel_id);
    }
    if (settledDuels.size > 0) {
      console.log(`⚖️  Skipping ${settledDuels.size} duel(s) already settled on-chain`);
    }
  } catch (err) {
    console.warn('[settle] Could not load DuelSettled events:', err instanceof Error ? err.message : err);
  }
}

interface SettlementResult {
  duelId: string;
  winner: string;
  creatorReturn: number;
  opponentReturn: number;
  creatorReturnBps: number;
  opponentReturnBps: number;
  resultBlobId: string;
  txDigest: string;
}

/** Thrown when a duel can't be settled yet but it's not a real error (skip quietly). */
class SettlementSkip extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettlementSkip';
  }
}

/**
 * Full settlement flow for a single duel:
 *  1. Read duel object from chain
 *  2. Read start prices from Walrus
 *  3. Read creator + opponent indexes from Walrus
 *  4. Fetch current (end) prices from Pyth/CoinGecko
 *  5. Compute weighted returns
 *  6. Store result on Walrus
 *  7. Call settle_duel on-chain (AdminCap-signed)
 *
 * Throws SettlementSkip if the duel isn't ACTIVE or hasn't expired yet.
 */
async function performSettlement(duelId: string): Promise<SettlementResult> {
  const client = getSuiClient();

  const obj = await client.getObject({ id: duelId, options: { showContent: true } });
  if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') {
    throw new SettlementSkip('Duel object not found');
  }

  const fields = obj.data.content.fields as Record<string, unknown>;
  const status = Number(fields.status);
  if (status === DUEL_STATUS_SETTLED) {
    throw new SettlementSkip('Duel already settled on-chain');
  }
  if (status !== DUEL_STATUS_ACTIVE) {
    throw new SettlementSkip(`Duel is not ACTIVE (status=${status})`);
  }

  const endTime = Number(fields.end_time);
  if (Date.now() < endTime) {
    const remaining = Math.round((endTime - Date.now()) / 1000);
    throw new SettlementSkip(`Duel hasn't expired yet. ${remaining}s remaining.`);
  }

  const creatorBlobId     = String(fields.creator_blob_id);
  const opponentBlobId    = String(fields.opponent_blob_id);
  const startPricesBlobId = String(fields.start_prices_blob_id);

  // Start prices (snapshotted at join) + both indexes from Walrus
  const startPricesRaw = await readBlobData(startPricesBlobId);
  const startPrices = (JSON.parse(startPricesRaw) as { prices: Record<string, number> }).prices;

  const [creatorRaw, opponentRaw] = await Promise.all([
    readBlobData(creatorBlobId),
    readBlobData(opponentBlobId),
  ]);
  const creatorIndex  = JSON.parse(creatorRaw)  as IndexComposition;
  const opponentIndex = JSON.parse(opponentRaw) as IndexComposition;

  // End prices + weighted returns
  const endPrices = await fetchMarketPrices({ force: true });
  const creatorReturn  = calculateWeightedReturn(creatorIndex.assets,  startPrices, endPrices);
  const opponentReturn = calculateWeightedReturn(opponentIndex.assets, startPrices, endPrices);
  const creatorReturnBps  = returnToBps(creatorReturn);
  const opponentReturnBps = returnToBps(opponentReturn);

  const winner = creatorReturn >= opponentReturn ? String(fields.creator) : String(fields.opponent);

  // Archive full result on Walrus. This is best-effort — the on-chain payout is
  // what matters, so if the publisher is flaky we still settle with a placeholder.
  const result = {
    duelId,
    creator:  String(fields.creator),
    opponent: String(fields.opponent),
    creatorIndex,
    opponentIndex,
    startPrices,
    endPrices,
    creatorReturn:  Math.round(creatorReturn  * 100) / 100,
    opponentReturn: Math.round(opponentReturn * 100) / 100,
    creatorReturnBps,
    opponentReturnBps,
    winner,
    settledAt: Date.now(),
  };
  let resultBlobId = '';
  try {
    resultBlobId = await storeOnWalrus(JSON.stringify(result));
  } catch (err) {
    console.warn(`[Settle] Could not archive result on Walrus (settling anyway):`, err instanceof Error ? err.message : err);
  }

  // Settle on-chain (pays winner, takes fee)
  let txDigest = '';
  if (PACKAGE_ID !== '0x0' && ADMIN_KEY) {
    txDigest = await settleDuelOnChain(duelId, creatorReturnBps, opponentReturnBps, resultBlobId);
  }

  return {
    duelId,
    winner,
    creatorReturn:  result.creatorReturn,
    opponentReturn: result.opponentReturn,
    creatorReturnBps,
    opponentReturnBps,
    resultBlobId,
    txDigest,
  };
}

/**
 * POST /api/settle/:duelId
 * Manually trigger settlement for one duel (also used by the "Settle Now" button).
 */
app.post('/api/settle/:duelId', async (req, res) => {
  try {
    const result = await performSettlement(req.params.duelId);
    settledDuels.add(req.params.duelId);
    return res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof SettlementSkip) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error('Settlement failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Settlement failed',
    });
  }
});

/**
 * GET /api/duel/:duelId
 * Read a Duel object from chain and return parsed fields.
 */
app.get('/api/duel/:duelId', async (req, res) => {
  try {
    const client = getSuiClient();
    const obj = await client.getObject({
      id: req.params.duelId,
      options: { showContent: true, showType: true },
    });

    if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') {
      return res.status(404).json({ success: false, error: 'Duel not found' });
    }

    return res.json({ success: true, duel: obj.data.content.fields });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch duel' });
  }
});

/**
 * GET /api/leaderboard
 * Builds a leaderboard from DuelSettled events, stores snapshot on Walrus.
 */
app.get('/api/leaderboard', async (_req, res) => {
  try {
    if (PACKAGE_ID === '0x0') {
      return res.json({ success: true, leaderboard: [], mock: true });
    }

    // Use raw RPC — SuiJsonRpcClient.queryEvents not available in all @mysten/sui v2 builds
    const events = await suiRpcCall<{ data: Array<{ parsedJson: unknown }> }>(
      'suix_queryEvents',
      [{ MoveEventType: `${PACKAGE_ID}::index_duel::DuelSettled` }, null, 100, false]
    );

    // Aggregate wins/losses per address
    const stats: Record<string, { wins: number; losses: number; totalReturnBps: number; best: number }> = {};

    for (const ev of events.data) {
      const parsed = ev.parsedJson as {
        winner: string;
        creator_return_bps: string;
        opponent_return_bps: string;
      };

      const winner = parsed.winner;
      // We'd need creator/opponent addresses from a prior DuelCreated lookup —
      // for now record wins for the winner
      if (!stats[winner]) stats[winner] = { wins: 0, losses: 0, totalReturnBps: 0, best: 10000 };
      stats[winner].wins++;

      const creatorBps  = Number(parsed.creator_return_bps);
      const opponentBps = Number(parsed.opponent_return_bps);
      const maxBps = Math.max(creatorBps, opponentBps);
      if (maxBps > stats[winner].best) stats[winner].best = maxBps;
    }

    const leaderboard = Object.entries(stats)
      .map(([address, s]) => ({
        address,
        wins: s.wins,
        losses: s.losses,
        winRate: s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 100,
        bestReturnPct: ((s.best - 10000) / 100).toFixed(2),
      }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 50);

    // Store snapshot on Walrus
    const blobId = await storeOnWalrus(JSON.stringify({ leaderboard, timestamp: Date.now() }));

    return res.json({ success: true, leaderboard, walrusBlobId: blobId });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to build leaderboard' });
  }
});

// ── Auto-settlement watcher ─────────────────────────────────────────────────

const SETTLE_POLL_MS = 30_000;

/** Find joined (ACTIVE) duels whose timer has expired and aren't already settled. */
async function findExpiredActiveDuels(): Promise<string[]> {
  // Use raw RPC — SuiJsonRpcClient.queryEvents is not available in some @mysten/sui v2 builds
  const result = await suiRpcCall<{ data: Array<{ parsedJson: unknown }> }>(
    'suix_queryEvents',
    [{ MoveEventType: `${PACKAGE_ID}::index_duel::DuelJoined` }, null, 100, false]
  );

  const now = Date.now();
  const ids: string[] = [];
  for (const ev of result.data) {
    const p = ev.parsedJson as { duel_id: string; end_time: string };
    if (!p?.duel_id) continue;
    if (settledDuels.has(p.duel_id) || abandonedSettleDuels.has(p.duel_id)) continue;
    if (Number(p.end_time) <= now) ids.push(p.duel_id);
  }
  return ids;
}

async function settlementTick(): Promise<void> {
  if (PACKAGE_ID === '0x0' || !ADMIN_KEY) return; // need admin key to settle
  try {
    const ids = await findExpiredActiveDuels();
    for (const duelId of ids) {
      if (settling.has(duelId)) continue;
      if (abandonedSettleDuels.has(duelId)) continue;

      const preStatus = await getDuelStatus(duelId);
      if (preStatus === DUEL_STATUS_SETTLED) {
        settledDuels.add(duelId);
        continue;
      }
      if (preStatus != null && preStatus !== DUEL_STATUS_ACTIVE) {
        settledDuels.add(duelId);
        continue;
      }

      settling.add(duelId);
      try {
        const result = await performSettlement(duelId);
        settledDuels.add(duelId);
        console.log(
          `⚖️  Auto-settled ${duelId.slice(0, 10)}… → winner ${result.winner.slice(0, 10)}… ` +
          `(creator ${result.creatorReturn}% vs opponent ${result.opponentReturn}%) tx ${result.txDigest.slice(0, 10)}…`
        );
      } catch (err) {
        const postStatus = await getDuelStatus(duelId);
        if (postStatus === DUEL_STATUS_SETTLED) {
          settledDuels.add(duelId);
          console.log(`⚖️  Duel ${duelId.slice(0, 10)}… already settled on-chain`);
          continue;
        }

        if (err instanceof SettlementSkip) {
          if (
            err.message.includes('not ACTIVE') ||
            err.message.includes('already settled')
          ) {
            settledDuels.add(duelId);
          }
          continue;
        }

        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Blob not in server cache')) {
          abandonedSettleDuels.add(duelId);
          logSettleWarn(duelId, `abandoned — missing Walrus blob (${msg})`);
        } else if (isTransientSettleError(msg)) {
          logSettleWarn(duelId, `transient error, will retry — ${msg}`);
        } else {
          console.error(`Auto-settle failed for ${duelId.slice(0, 10)}…:`, msg);
        }
      } finally {
        settling.delete(duelId);
      }
    }
  } catch (err) {
    console.error('Settlement tick error:', err instanceof Error ? err.message : err);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 Sui-Index backend running on port ${PORT}`);
  console.log(`📡 Network:  ${SUI_NETWORK} via ${getRpcUrl()}`);
  console.log(`📦 Package:  ${PACKAGE_ID}`);
  console.log(`💰 Prices:   http://localhost:${PORT}/api/prices`);
  console.log(`🏆 Leaderboard: http://localhost:${PORT}/api/leaderboard`);

  // Pre-seed + keep cache warm without per-client upstream hammering.
  fetchMarketPrices({ force: true })
    .then(() => console.log(`💰 Price cache seeded via ${lastPriceSource}`))
    .catch((e) => console.warn('💰 Startup price seed failed — will retry on first request:', (e as Error).message));

  setInterval(() => schedulePriceRefresh(), PRICE_REFRESH_MS);

  if (PACKAGE_ID !== '0x0' && ADMIN_KEY) {
    console.log(`⚖️  Auto-settlement: ON (every ${SETTLE_POLL_MS / 1000}s)`);
    loadAlreadySettledDuels()
      .then(() => {
        setTimeout(settlementTick, 5_000);
        setInterval(settlementTick, SETTLE_POLL_MS);
      })
      .catch(() => {
        setTimeout(settlementTick, 5_000);
        setInterval(settlementTick, SETTLE_POLL_MS);
      });
  } else {
    console.log('⚖️  Auto-settlement: OFF (set PACKAGE_ID + ADMIN_PRIVATE_KEY to enable)');
  }
});

export { fetchMarketPrices, fetchPythPrices, storeOnWalrus, readFromWalrus };
