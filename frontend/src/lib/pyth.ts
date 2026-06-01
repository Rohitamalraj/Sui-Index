/**
 * Market prices for Sui-Index.
 * Primary: backend (Tatum + CoinGecko). Browser fallback: CoinGecko only.
 */

import { GAME_ASSETS } from '@/lib/assetLogos';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

/** All tradable symbols in the app */
export const SUPPORTED_SYMBOLS = GAME_ASSETS.map((a) => a.symbol);

/** @deprecated Kept for imports that referenced PYTH_FEED_IDS */
export const PYTH_FEED_IDS: Record<string, string> = Object.fromEntries(
  SUPPORTED_SYMBOLS.map((s) => [s, s])
);

const COINGECKO_IDS: Record<string, string> = {
  BTC:  'bitcoin',       ETH:  'ethereum',      SOL:  'solana',       SUI:  'sui',
  AVAX: 'avalanche-2',   LINK: 'chainlink',     DOT:  'polkadot',     DOGE: 'dogecoin',
  UNI:  'uniswap',       MATIC:'polygon-ecosystem-token', ADA: 'cardano', ATOM: 'cosmos',
  XRP:  'ripple',        BNB:  'binancecoin',   LTC:  'litecoin',     BCH:  'bitcoin-cash',
  ALGO: 'algorand',      APT:  'aptos',         ARB:  'arbitrum',     FIL:  'filecoin',
};

export interface PriceData {
  symbol: string;
  price: number;
  confidence: number;
  timestamp: number;
  expo: number;
}

function toPriceData(prices: Record<string, number>, symbols?: string[]): Record<string, PriceData> {
  const now = Date.now();
  const out: Record<string, PriceData> = {};
  const list = symbols ?? Object.keys(prices);
  for (const symbol of list) {
    const price = prices[symbol];
    if (price != null && price > 0) {
      out[symbol] = { symbol, price, confidence: 0, timestamp: now, expo: 0 };
    }
  }
  return out;
}

/** Backend proxy — Tatum primary, CoinGecko backup (server refreshes upstream ~every 4s). */
async function fetchFromBackend(symbols: string[]): Promise<Record<string, PriceData>> {
  const url = `${BACKEND_URL}/api/prices`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`Backend HTTP ${res.status}`);
    const data = await res.json() as {
      success: boolean;
      prices: Record<string, number>;
      source?: string;
    };
    if (!data.success || !data.prices) throw new Error('No prices in response');
    console.log('[Prices] Backend OK via', data.source ?? 'unknown', '—', Object.keys(data.prices).length, 'assets');
    return toPriceData(data.prices, symbols);
  } catch (err) {
    console.warn('[Prices] Backend unavailable:', err instanceof Error ? err.message : err);
    return {};
  }
}

let cgClientBackoffUntil = 0;

function coingeckoIdsForSymbols(symbols: string[]): string {
  const ids = new Set<string>();
  for (const sym of symbols) {
    if (sym === 'MATIC') {
      ids.add('polygon-ecosystem-token');
      ids.add('matic-network');
    } else if (COINGECKO_IDS[sym]) {
      ids.add(COINGECKO_IDS[sym]);
    }
  }
  return [...ids].join(',');
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

/** CoinGecko — browser fallback only when backend is down (rate-limit sensitive). */
async function fetchFromCoinGecko(symbols: string[]): Promise<Record<string, PriceData>> {
  if (Date.now() < cgClientBackoffUntil) return {};
  const ids = coingeckoIdsForSymbols(symbols);
  if (!ids) return {};
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(8_000) }
    );
    if (res.status === 429) {
      cgClientBackoffUntil = Date.now() + 180_000;
      throw new Error('CoinGecko HTTP 429');
    }
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const data = await res.json() as Record<string, { usd: number }>;
    const prices: Record<string, number> = {};
    for (const symbol of symbols) {
      const geckoId = COINGECKO_IDS[symbol];
      if (geckoId && data[geckoId]?.usd) prices[symbol] = data[geckoId].usd;
    }
    if (symbols.includes('MATIC') && !prices.MATIC) {
      const pol = data['polygon-ecosystem-token']?.usd ?? data['matic-network']?.usd;
      if (pol) prices.MATIC = pol;
    }
    if (symbols.includes('MATIC') && !prices.MATIC) {
      const fromBinance = await fetchMaticFromBinance();
      if (fromBinance) prices.MATIC = fromBinance;
    }
    console.log('[Prices] CoinGecko fallback —', Object.keys(prices).length, 'assets');
    return toPriceData(prices);
  } catch (err) {
    console.warn('[Prices] CoinGecko failed:', err instanceof Error ? err.message : err);
    if (symbols.includes('MATIC')) {
      const fromBinance = await fetchMaticFromBinance();
      if (fromBinance) return toPriceData({ MATIC: fromBinance });
    }
    return {};
  }
}

/**
 * Fresh snapshot for duel join — always bypasses backend cache.
 */
export async function fetchSnapshotPrices(): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/prices/snapshot`, {
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`Snapshot HTTP ${res.status}`);
    const data = await res.json() as { success: boolean; prices: Record<string, number> };
    if (!data.success || !data.prices) throw new Error('Invalid snapshot response');
    console.log('[Prices] Snapshot captured —', Object.keys(data.prices).length, 'assets');
    return data.prices;
  } catch (err) {
    console.warn('[Prices] Snapshot API failed:', err instanceof Error ? err.message : err);
    const all = await fetchAllPrices();
    const map: Record<string, number> = {};
    for (const [sym, d] of Object.entries(all)) map[sym] = d.price;
    return map;
  }
}

export async function fetchAllPrices(): Promise<Record<string, PriceData>> {
  const symbols = SUPPORTED_SYMBOLS;
  const backend = await fetchFromBackend(symbols);
  if (Object.keys(backend).length > 0) return backend;
  return fetchFromCoinGecko(symbols);
}

/**
 * Live prices for duel chart — uses backend cache (refreshed server-side ~every 4s).
 */
export async function fetchPrices(symbols: string[]): Promise<Record<string, PriceData>> {
  const valid = symbols.filter((s) => SUPPORTED_SYMBOLS.includes(s));
  if (valid.length === 0) return {};

  const backend = await fetchFromBackend(valid);
  if (Object.keys(backend).length > 0) return backend;

  return fetchFromCoinGecko(valid);
}

export function calculateIndexReturn(
  assets: { symbol: string; weight: number }[],
  startPrices: Record<string, number>,
  endPrices: Record<string, number>
): IndexReturn {
  let totalReturn = 0;
  const assetReturns = assets.map((asset) => {
    const startPrice = startPrices[asset.symbol] ?? 0;
    const rawEnd = endPrices[asset.symbol];
    // Missing live price → treat as unchanged (avoid -100% cliff when an oracle blips)
    const endPrice = rawEnd != null && rawEnd > 0 ? rawEnd : startPrice;
    const assetReturn = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
    const weightedReturn = assetReturn * (asset.weight / 100);
    totalReturn += weightedReturn;
    return {
      symbol: asset.symbol,
      weight: asset.weight,
      startPrice,
      endPrice,
      assetReturn: Math.round(assetReturn * 100) / 100,
      weightedReturn: Math.round(weightedReturn * 100) / 100,
    };
  });
  return { totalReturn: Math.round(totalReturn * 100) / 100, assetReturns };
}

export interface IndexReturn {
  totalReturn: number;
  assetReturns: {
    symbol: string;
    weight: number;
    startPrice: number;
    endPrice: number;
    assetReturn: number;
    weightedReturn: number;
  }[];
}

export function returnToBps(returnPercentage: number): number {
  return Math.round(10000 + returnPercentage * 100);
}

export function formatPrice(price: number | undefined | null): string {
  if (price == null || isNaN(price)) return '$—';
  if (price >= 1000) {
    return price.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (price >= 1) {
    return price.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  return price.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

export function formatReturn(returnPct: number): string {
  const sign = returnPct >= 0 ? '+' : '';
  return `${sign}${returnPct.toFixed(2)}%`;
}

export function getSupportedAssets(): string[] {
  return [...SUPPORTED_SYMBOLS];
}
