/**
 * Sui transaction builders for Sui-Index smart contracts.
 * Uses @mysten/sui Transaction API for all on-chain calls.
 * All RPC calls route through Tatum gateway (see tatum.ts).
 */

import { Transaction } from "@mysten/sui/transactions";
import { CONTRACT_CONFIG, queryEvents, suiRpcCall } from "./tatum";

// Re-export for convenience so components only need to import from sui.ts
export { CONTRACT_CONFIG } from "./tatum";

// ============ MIST helpers ============

/** 1 SUI = 10^9 MIST */
export const MIST_PER_SUI = 1_000_000_000n;

export function suiToMist(sui: number): bigint {
  return BigInt(Math.round(sui * 1_000_000_000));
}

export function mistToSui(mist: bigint | string): number {
  return Number(BigInt(mist)) / 1_000_000_000;
}

// ============ Transaction: create_duel ============

/**
 * Build a Transaction for `index_duel::create_duel`.
 * The caller must sign and execute this transaction.
 *
 * @param entryAmountSui - Entry amount in SUI (e.g. 5.0)
 * @param durationHours  - Duel duration in hours (converted to ms on-chain)
 * @param creatorBlobId  - Walrus blob ID for the creator's index composition
 * @param platformFeeBps - Platform fee in basis points (default 200 = 2%)
 */
export function buildCreateDuelTx(
  entryAmountSui: number,
  durationHours: number,
  creatorBlobId: string,
  platformFeeBps: number = 200
): Transaction {
  const tx = new Transaction();
  const entryMist = suiToMist(entryAmountSui);
  const durationMs = durationHours * 60 * 60 * 1000;

  // Split the exact entry amount from gas coin
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(entryMist)]);

  tx.moveCall({
    target: `${CONTRACT_CONFIG.packageId}::index_duel::create_duel`,
    arguments: [
      coin,
      tx.pure.u64(entryMist),
      tx.pure.u64(durationMs),
      tx.pure.string(creatorBlobId),
      tx.pure.u64(platformFeeBps),
      tx.object("0x6"), // Sui clock object
    ],
  });

  return tx;
}

// ============ Transaction: join_duel ============

/**
 * Build a Transaction for `index_duel::join_duel`.
 *
 * @param duelObjectId       - On-chain Duel object ID
 * @param entryAmountSui     - Must match the duel's entry_amount
 * @param opponentBlobId     - Walrus blob ID for the opponent's index composition
 * @param startPricesBlobId  - Walrus blob ID for the starting price snapshot
 */
export function buildJoinDuelTx(
  duelObjectId: string,
  entryAmountSui: number,
  opponentBlobId: string,
  startPricesBlobId: string
): Transaction {
  const tx = new Transaction();
  const entryMist = suiToMist(entryAmountSui);

  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(entryMist)]);

  tx.moveCall({
    target: `${CONTRACT_CONFIG.packageId}::index_duel::join_duel`,
    arguments: [
      tx.object(duelObjectId),
      coin,
      tx.pure.string(opponentBlobId),
      tx.pure.string(startPricesBlobId),
      tx.object("0x6"), // Sui clock object
    ],
  });

  return tx;
}

// ============ Transaction: cancel_duel ============

/**
 * Build a Transaction for `index_duel::cancel_duel`.
 * Only the creator can cancel an OPEN duel.
 */
export function buildCancelDuelTx(duelObjectId: string): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${CONTRACT_CONFIG.packageId}::index_duel::cancel_duel`,
    arguments: [tx.object(duelObjectId)],
  });

  return tx;
}

// ============ Transaction: register_duel (factory) ============

/**
 * Build a Transaction to register a newly created duel in the DuelFactory.
 * Call this right after create_duel succeeds.
 */
export function buildRegisterDuelTx(
  duelObjectId: string,
  creator: string,
  entryAmountSui: number,
  durationHours: number,
  creatorBlobId: string
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${CONTRACT_CONFIG.packageId}::duel_factory::register_duel`,
    arguments: [
      tx.object(CONTRACT_CONFIG.registryId),
      tx.pure.id(duelObjectId),
      tx.pure.address(creator),
      tx.pure.u64(suiToMist(entryAmountSui)),
      tx.pure.u64(durationHours * 60 * 60 * 1000),
      tx.pure.string(creatorBlobId),
      tx.object("0x6"), // clock
    ],
  });

  return tx;
}

// ============ On-chain Query Helpers ============

export interface OnChainDuel {
  objectId: string;
  creator: string;
  opponent: string;
  entryAmount: number;      // in SUI
  durationMs: number;
  status: number;
  creatorBlobId: string;
  opponentBlobId: string;
  startPricesBlobId: string;
  startTime: number;
  endTime: number;
  escrowValue: number;      // in SUI
  winner: string;
  resultBlobId: string;
  platformFeeBps: number;
}

/**
 * Fetch a single Duel object from chain and parse its fields.
 */
export async function fetchDuel(duelObjectId: string): Promise<OnChainDuel | null> {
  try {
    // Use raw JSON-RPC (public fullnode, CORS-safe) instead of CoreClient,
    // whose v2 getObject API/return shape is inconsistent in the browser.
    const result = await suiRpcCall("sui_getObject", [
      duelObjectId,
      { showContent: true, showType: true },
    ]) as {
      data?: { content?: { dataType?: string; fields?: Record<string, unknown> } };
    };

    const content = result?.data?.content;
    if (!content || content.dataType !== "moveObject" || !content.fields) {
      console.warn("[sui] fetchDuel: no moveObject content for", duelObjectId);
      return null;
    }

    return parseOnChainDuel(duelObjectId, content.fields);
  } catch (err) {
    console.warn("[sui] fetchDuel failed for", duelObjectId, err);
    return null;
  }
}

/** Escrow may be a plain u64 string or a nested Balance object depending on RPC shape. */
function parseEscrow(escrow: unknown): string {
  if (escrow == null) return "0";
  if (typeof escrow === "string" || typeof escrow === "number") return String(escrow);
  const nested = (escrow as { fields?: { value?: string } })?.fields?.value;
  return nested != null ? String(nested) : "0";
}

/** Parse Move u64 fields from JSON-RPC (string, number, or nested). */
function parseU64(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (o.fields != null) return parseU64(o.fields);
    if (o.value != null) return parseU64(o.value);
  }
  return 0;
}

/** Sui clock timestamps are ms; normalize if RPC returns seconds. */
function normalizeMs(ts: number): number {
  if (ts <= 0) return 0;
  if (ts < 1e12) return ts * 1000;
  return ts;
}

function parseOnChainDuel(
  objectId: string,
  fields: Record<string, unknown>
): OnChainDuel {
  return {
    objectId,
    creator: String(fields.creator ?? ""),
    opponent: String(fields.opponent ?? "0x0"),
    entryAmount: mistToSui(String(fields.entry_amount ?? "0")),
    durationMs: parseU64(fields.duration_ms),
    status: parseU64(fields.status),
    creatorBlobId: String(fields.creator_blob_id ?? ""),
    opponentBlobId: String(fields.opponent_blob_id ?? ""),
    startPricesBlobId: String(fields.start_prices_blob_id ?? ""),
    startTime: normalizeMs(parseU64(fields.start_time)),
    endTime: normalizeMs(parseU64(fields.end_time)),
    escrowValue: mistToSui(String(parseEscrow(fields.escrow))),
    winner: String(fields.winner ?? "0x0"),
    resultBlobId: String(fields.result_blob_id ?? ""),
    platformFeeBps: parseU64(fields.platform_fee_bps) || 200,
  };
}

// ============ Event Querying ============

export interface DuelCreatedEvent {
  duelId: string;
  creator: string;
  entryAmount: number;    // SUI
  durationMs: number;
  creatorBlobId: string;
  txDigest: string;
  timestampMs: number;
}

export interface DuelJoinedEvent {
  duelId: string;
  opponent: string;
  opponentBlobId: string;
  startTime: number;
  endTime: number;
}

export interface DuelSettledEvent {
  duelId: string;
  winner: string;
  creatorReturnBps: number;
  opponentReturnBps: number;
  resultBlobId: string;
}

/**
 * Fetch recent DuelCreated events from the chain via Tatum RPC.
 */
export async function fetchDuelCreatedEvents(
  limit: number = 20
): Promise<DuelCreatedEvent[]> {
  if (CONTRACT_CONFIG.packageId === "0x0") return [];

  try {
    const raw = await queryEvents(
      CONTRACT_CONFIG.packageId,
      "index_duel",
      "DuelCreated",
      limit
    ) as Array<{
      id: { txDigest: string };
      parsedJson: {
        duel_id: string;
        creator: string;
        entry_amount: string;
        duration_ms: string;
        creator_blob_id: string;
      };
      timestampMs: string;
    }>;

    return raw.map((e) => ({
      duelId: e.parsedJson.duel_id,
      creator: e.parsedJson.creator,
      entryAmount: mistToSui(e.parsedJson.entry_amount),
      durationMs: Number(e.parsedJson.duration_ms),
      creatorBlobId: e.parsedJson.creator_blob_id,
      txDigest: e.id.txDigest,
      timestampMs: Number(e.timestampMs),
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch recent DuelJoined events.
 */
export async function fetchDuelJoinedEvents(
  limit: number = 20
): Promise<DuelJoinedEvent[]> {
  if (CONTRACT_CONFIG.packageId === "0x0") return [];

  try {
    const raw = await queryEvents(
      CONTRACT_CONFIG.packageId,
      "index_duel",
      "DuelJoined",
      limit
    ) as Array<{
      parsedJson: {
        duel_id: string;
        opponent: string;
        opponent_blob_id: string;
        start_time: string;
        end_time: string;
      };
    }>;

    return raw.map((e) => ({
      duelId: e.parsedJson.duel_id,
      opponent: e.parsedJson.opponent,
      opponentBlobId: e.parsedJson.opponent_blob_id,
      startTime: Number(e.parsedJson.start_time),
      endTime: Number(e.parsedJson.end_time),
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch recent DuelSettled events.
 */
export async function fetchDuelSettledEvents(
  limit: number = 20
): Promise<DuelSettledEvent[]> {
  if (CONTRACT_CONFIG.packageId === "0x0") return [];

  try {
    const raw = await queryEvents(
      CONTRACT_CONFIG.packageId,
      "index_duel",
      "DuelSettled",
      limit
    ) as Array<{
      parsedJson: {
        duel_id: string;
        winner: string;
        creator_return_bps: string;
        opponent_return_bps: string;
        result_blob_id: string;
      };
    }>;

    return raw.map((e) => ({
      duelId: e.parsedJson.duel_id,
      winner: e.parsedJson.winner,
      creatorReturnBps: Number(e.parsedJson.creator_return_bps),
      opponentReturnBps: Number(e.parsedJson.opponent_return_bps),
      resultBlobId: e.parsedJson.result_blob_id,
    }));
  } catch {
    return [];
  }
}

// ============ Status Helpers ============

export const DUEL_STATUS = {
  OPEN: 0,
  ACTIVE: 1,
  SETTLED: 2,
  CANCELLED: 3,
} as const;

export function statusLabel(status: number): string {
  switch (status) {
    case 0: return "OPEN";
    case 1: return "ACTIVE";
    case 2: return "SETTLED";
    case 3: return "CANCELLED";
    default: return "UNKNOWN";
  }
}

export function statusColor(status: number): string {
  switch (status) {
    case 0: return "#FFD600";
    case 1: return "#4ADE80";
    case 2: return "#888888";
    case 3: return "#FF5F57";
    default: return "#555555";
  }
}

/** Format a duration in ms to a human-readable string. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin}M`;
  const hours = Math.round(ms / 3_600_000);
  if (hours >= 24) return `${Math.round(hours / 24)}D`;
  return `${hours}H`;
}

/** Compute time remaining from an end timestamp. Returns "HH:MM:SS" or "EXPIRED". */
export function timeRemaining(endTimeMs: number): string {
  const remaining = endTimeMs - Date.now();
  if (remaining <= 0) return "EXPIRED";
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1_000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Shorten an address for display. */
export function shortAddr(address: string): string {
  if (!address || address === "0x0000000000000000000000000000000000000000000000000000000000000000") return "—";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Return percentage from basis points. 10000 bps = 0%, 11000 bps = +10% */
export function bpsToReturn(bps: number): number {
  return (bps - 10000) / 100;
}
