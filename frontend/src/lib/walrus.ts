/**
 * Walrus blob storage client for Sui-Index.
 * Handles storing and reading index compositions, duel results,
 * and leaderboard data on Walrus decentralized storage.
 */

// ============ Configuration ============

const WALRUS_PUBLISHER = process.env.NEXT_PUBLIC_WALRUS_PUBLISHER
  || 'https://publisher.walrus-testnet.walrus.space';
const WALRUS_AGGREGATOR = process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR
  || 'https://aggregator.walrus-testnet.walrus.space';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const DEFAULT_EPOCHS = 5;
const BLOB_CACHE_PREFIX = 'walrus-blob-';

// ============ Types ============

/** A single asset weight in an index */
export interface IndexAsset {
  symbol: string;
  weight: number; // Percentage (0-100), all must sum to 100
}

/** Full index composition stored on Walrus */
export interface IndexComposition {
  assets: IndexAsset[];
  creator: string; // Wallet address
  timestamp: number;
  version: number;
}

/** Duel result stored on Walrus after settlement */
export interface DuelResult {
  duelId: string;
  creator: string;
  opponent: string;
  creatorIndex: IndexComposition;
  opponentIndex: IndexComposition;
  startPrices: Record<string, number>;
  endPrices: Record<string, number>;
  creatorReturn: number; // Percentage return
  opponentReturn: number;
  winner: string;
  settledAt: number;
}

/** Leaderboard entry */
export interface LeaderboardEntry {
  address: string;
  wins: number;
  losses: number;
  totalDuels: number;
  winRate: number;
  bestReturn: number;
  totalEarnings: number;
}

/** Walrus store response */
interface WalrusNewlyCreated {
  newlyCreated: {
    blobObject: {
      id: string;
      blobId: string;
      size: number;
      encodingType: string;
    };
    cost: number;
  };
}

interface WalrusAlreadyCertified {
  alreadyCertified: {
    blobId: string;
    endEpoch: number;
  };
}

type WalrusStoreResponse = WalrusNewlyCreated | WalrusAlreadyCertified;

// ============ Core Functions ============

/** SHA-256 of data as a hex string — used as a stable fallback blob ID. */
async function sha256hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function cacheBlobLocal(blobId: string, data: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BLOB_CACHE_PREFIX + blobId, data);
  } catch { /* quota */ }
}

function readBlobLocal(blobId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(BLOB_CACHE_PREFIX + blobId);
  } catch {
    return null;
  }
}

/** Sync blob content to backend in-memory cache (for content-hash fallbacks). */
export async function cacheBlobOnBackend(blobId: string, data: string): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/walrus/cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blobId, data }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    console.warn('[Walrus] Backend cache sync failed:', err instanceof Error ? err.message : err);
  }
}

/** Persist duel start prices keyed by duel object ID (duel detail fallback). */
export function saveDuelStartPrices(duelId: string, prices: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`duel-start-prices-${duelId}`, JSON.stringify(prices));
  } catch { /* ignore */ }
}

export function loadDuelStartPrices(duelId: string): Record<string, number> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`duel-start-prices-${duelId}`);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return null;
  }
}

/**
 * Store a blob on Walrus.
 * Returns the blob ID that can be used to retrieve it later.
 * Falls back to a content-hash ID when the publisher is unreachable.
 */
export async function storeBlob(
  data: string,
  epochs: number = DEFAULT_EPOCHS
): Promise<string> {
  console.log('[Walrus] storeBlob — size:', data.length, 'bytes');

  // 1. Try backend proxy (avoids browser CORS on Walrus publisher)
  try {
    const res = await fetch(`${BACKEND_URL}/api/walrus/store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Backend Walrus store HTTP ${res.status}`);
    const result = await res.json() as { success: boolean; blobId: string };
    if (!result.success || !result.blobId) throw new Error('Backend returned no blobId');
    persistBlob(result.blobId, data);
    console.log('[Walrus] Stored via backend ✓ blobId:', result.blobId);
    return result.blobId;
  } catch (err) {
    console.warn('[Walrus] Backend store failed, trying direct Walrus:', err instanceof Error ? err.message : err);
  }

  // 2. Try Walrus publisher directly
  const url = `${WALRUS_PUBLISHER}/v1/blobs?epochs=${epochs}`;
  console.log('[Walrus] Trying direct →', url);
  try {
    const response = await fetch(url, {
      method: 'PUT',
      body: data,
      headers: { 'Content-Type': 'application/octet-stream' },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`Walrus HTTP ${response.status} ${response.statusText}`);
    const result: WalrusStoreResponse = await response.json();
    let blobId: string;
    if ('newlyCreated' in result) {
      blobId = result.newlyCreated.blobObject.blobId;
    } else if ('alreadyCertified' in result) {
      blobId = result.alreadyCertified.blobId;
    } else {
      throw new Error('Unexpected Walrus response format');
    }
    persistBlob(blobId, data);
    console.log('[Walrus] Stored direct ✓ blobId:', blobId);
    return blobId;
  } catch (err) {
    console.warn('[Walrus] Direct store failed:', err instanceof Error ? err.message : err);
  }

  // 3. Content-hash fallback — Walrus testnet is down/slow.
  const hash = await sha256hex(data);
  cacheBlobLocal(hash, data);
  void cacheBlobOnBackend(hash, data);
  console.warn('[Walrus] Testnet unreachable — using content-hash blob ID:', hash.slice(0, 16) + '...');
  return hash;
}

/** After storeBlob, keep content retrievable via local + backend cache. */
function persistBlob(blobId: string, data: string): void {
  cacheBlobLocal(blobId, data);
  void cacheBlobOnBackend(blobId, data);
}

/**
 * Read a blob from Walrus by blob ID (direct aggregator).
 */
export async function readBlob(blobId: string): Promise<string> {
  const response = await fetch(
    `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`,
    { signal: AbortSignal.timeout(8000) }
  );

  if (!response.ok) {
    throw new Error(`Walrus read failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

/** True when blob ID is a SHA-256 content hash (not a Walrus aggregator ID). */
function isContentHashBlobId(blobId: string): boolean {
  return /^[a-f0-9]{64}$/i.test(blobId);
}

/**
 * Read and parse a JSON blob from Walrus.
 * Order: local cache → backend cache → Walrus aggregator (real blob IDs only).
 */
export async function readJsonBlob<T>(blobId: string): Promise<T> {
  // 0. Browser local cache (same device that stored the blob)
  const local = readBlobLocal(blobId);
  if (local) {
    console.log('[Walrus] Read from local cache ✓', blobId.slice(0, 16) + '...');
    return JSON.parse(local) as T;
  }

  // 1. Backend proxy — server cache + Walrus
  try {
    const res = await fetch(`${BACKEND_URL}/api/walrus/${encodeURIComponent(blobId)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const result = await res.json() as { success: boolean; data: T };
      if (result.success && result.data != null) {
        cacheBlobLocal(blobId, JSON.stringify(result.data));
        console.log('[Walrus] Read via backend ✓', blobId.slice(0, 16) + '...');
        return result.data;
      }
    }
  } catch (err) {
    console.warn('[Walrus] Backend read failed:', err instanceof Error ? err.message : err);
  }

  // Content-hash IDs are never on Walrus — skip aggregator (avoids HTTP 400 noise)
  if (isContentHashBlobId(blobId)) {
    throw new Error(`Blob ${blobId.slice(0, 16)}... not in cache (Walrus unavailable at store time)`);
  }

  // 2. Direct aggregator (real Walrus blob IDs only)
  const text = await readBlob(blobId);
  cacheBlobLocal(blobId, text);
  console.log('[Walrus] Read direct ✓', blobId.slice(0, 16) + '...');
  return JSON.parse(text) as T;
}

// ============ High-Level Functions ============

/**
 * Store an index composition on Walrus.
 * Called when a player locks in their index for a duel.
 */
export async function storeIndex(
  assets: IndexAsset[],
  creator: string
): Promise<string> {
  const composition: IndexComposition = {
    assets,
    creator,
    timestamp: Date.now(),
    version: 1,
  };

  return storeBlob(JSON.stringify(composition));
}

/**
 * Read an index composition from Walrus.
 */
export async function readIndex(blobId: string): Promise<IndexComposition> {
  return readJsonBlob<IndexComposition>(blobId);
}

/**
 * Store a duel result on Walrus.
 * Called after settlement to create a permanent record.
 */
export async function storeDuelResult(result: DuelResult): Promise<string> {
  return storeBlob(JSON.stringify(result));
}

/**
 * Read a duel result from Walrus.
 */
export async function readDuelResult(blobId: string): Promise<DuelResult> {
  return readJsonBlob<DuelResult>(blobId);
}

/**
 * Store a price snapshot on Walrus.
 * Used at duel start to record starting prices.
 */
export async function storePriceSnapshot(
  prices: Record<string, number>
): Promise<string> {
  const snapshot = {
    prices,
    timestamp: Date.now(),
  };
  return storeBlob(JSON.stringify(snapshot));
}

/**
 * Read a price snapshot from Walrus.
 */
export async function readPriceSnapshot(
  blobId: string
): Promise<{ prices: Record<string, number>; timestamp: number }> {
  const raw = await readJsonBlob<unknown>(blobId);
  if (raw && typeof raw === "object" && raw !== null) {
    if ("prices" in raw) {
      const snap = raw as { prices: Record<string, number>; timestamp?: number };
      if (snap.prices && typeof snap.prices === "object") {
        return { prices: snap.prices, timestamp: snap.timestamp ?? Date.now() };
      }
    }
    if (!("assets" in raw)) {
      return { prices: raw as Record<string, number>, timestamp: Date.now() };
    }
  }
  throw new Error("Invalid price snapshot format");
}

/**
 * Store a leaderboard snapshot on Walrus.
 */
export async function storeLeaderboard(
  entries: LeaderboardEntry[]
): Promise<string> {
  const snapshot = {
    entries,
    timestamp: Date.now(),
    type: 'leaderboard',
  };
  return storeBlob(JSON.stringify(snapshot));
}

// ============ Utilities ============

/**
 * Get the Walrus aggregator URL for a blob.
 * Useful for displaying direct links to stored data.
 */
export function getBlobUrl(blobId: string): string {
  return `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
}
