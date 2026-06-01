"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DuelChart, { type ChartPoint } from "@/components/DuelChart";
import CryptoLogo from "@/components/CryptoLogo";
import {
  fetchDuel,
  type OnChainDuel,
  DUEL_STATUS,
  statusLabel,
  statusColor,
  shortAddr,
  formatDuration,
} from "@/lib/sui";
import { getExplorerUrl } from "@/lib/tatum";
import {
  readIndex,
  readPriceSnapshot,
  readDuelResult,
  loadDuelStartPrices,
  saveDuelStartPrices,
  type IndexComposition,
  type DuelResult,
} from "@/lib/walrus";
import { fetchPrices, calculateIndexReturn, formatPrice } from "@/lib/pyth";

const CREATOR_COLOR = "#FFD600";
const OPPONENT_COLOR = "#FF6B35";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000000000000000000000000000";


interface SeriesStore { creator: ChartPoint[]; opponent: ChartPoint[]; }

function sanitizeSeries(points: ChartPoint[], durationMs: number): ChartPoint[] {
  if (durationMs <= 0) return points;
  const byT = new Map<number, ChartPoint>();
  for (const p of points) {
    if (p.t < 0 || p.t > durationMs + 2_000) continue;
    byT.set(p.t, p);
  }
  return Array.from(byT.values()).sort((a, b) => a.t - b.t);
}

function loadSeries(id: string, durationMs: number): SeriesStore {
  if (typeof window === "undefined") return { creator: [], opponent: [] };
  try {
    const raw = localStorage.getItem(`duel-chart-${id}`);
    if (raw) {
      const parsed = JSON.parse(raw) as SeriesStore;
      return {
        creator: sanitizeSeries(parsed.creator ?? [], durationMs),
        opponent: sanitizeSeries(parsed.opponent ?? [], durationMs),
      };
    }
  } catch { /* ignore */ }
  return { creator: [], opponent: [] };
}

function saveSeries(id: string, s: SeriesStore, durationMs: number) {
  const clean = {
    creator: sanitizeSeries(s.creator, durationMs),
    opponent: sanitizeSeries(s.opponent, durationMs),
  };
  try { localStorage.setItem(`duel-chart-${id}`, JSON.stringify(clean)); } catch { /* ignore */ }
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "ENDED";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DuelDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [duel, setDuel] = useState<OnChainDuel | null>(null);
  const [creatorIndex, setCreatorIndex] = useState<IndexComposition | null>(null);
  const [opponentIndex, setOpponentIndex] = useState<IndexComposition | null>(null);
  const [startPrices, setStartPrices] = useState<Record<string, number> | null>(null);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
  const [result, setResult] = useState<DuelResult | null>(null);
  const [series, setSeries] = useState<SeriesStore>({ creator: [], opponent: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [chartTick, setChartTick] = useState(0);
  const lastChartSampleRef = useRef(0);

  // ── Load duel + indexes + start prices + result ──
  const loadDuel = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const d = await fetchDuel(id);
      if (!d) { setError("Duel not found on-chain."); return; }
      setDuel(d);
      setSeries(loadSeries(id, d.durationMs));
      lastChartSampleRef.current = 0;

      let creatorIdx: IndexComposition | null = null;
      let opponentIdx: IndexComposition | null = null;
      if (d.creatorBlobId) {
        try {
          creatorIdx = await readIndex(d.creatorBlobId);
          setCreatorIndex(creatorIdx);
        } catch (err) {
          console.warn("[Duel] Creator index read failed:", err);
        }
      }
      if (d.opponentBlobId) {
        try {
          opponentIdx = await readIndex(d.opponentBlobId);
          setOpponentIndex(opponentIdx);
        } catch (err) {
          console.warn("[Duel] Opponent index read failed:", err);
        }
      }

      let prices: Record<string, number> | null = null;
      if (d.startPricesBlobId) {
        try {
          const snap = await readPriceSnapshot(d.startPricesBlobId);
          prices = snap.prices;
          saveDuelStartPrices(id, snap.prices);
        } catch (err) {
          console.warn("[Duel] Start price snapshot read failed:", err);
        }
      }
      if (!prices) {
        prices = loadDuelStartPrices(id);
      }

      if (d.status === DUEL_STATUS.SETTLED && d.resultBlobId) {
        try {
          const r = await readDuelResult(d.resultBlobId);
          setResult(r);
          if (!prices && r.startPrices) prices = r.startPrices;
        } catch { /* ignore */ }
      }

      if (prices) setStartPrices(prices);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load duel");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadDuel(); }, [loadDuel]);

  // ── Live price polling (every 5s) ──
  const symbols = useMemo(() => {
    const s = new Set<string>();
    creatorIndex?.assets.forEach((a) => s.add(a.symbol));
    opponentIndex?.assets.forEach((a) => s.add(a.symbol));
    return Array.from(s);
  }, [creatorIndex, opponentIndex]);

  const refreshPrices = useCallback(async () => {
    if (symbols.length === 0) return;
    const p = await fetchPrices(symbols);
    if (Object.keys(p).length === 0) return;
    const map: Record<string, number> = {};
    for (const [sym, data] of Object.entries(p)) map[sym] = data.price;
    setCurrentPrices((prev) => ({ ...prev, ...map }));
    setChartTick((n) => n + 1);
  }, [symbols]);

  useEffect(() => {
    if (symbols.length === 0) return;
    refreshPrices();
    const t = setInterval(refreshPrices, 2_500);
    return () => clearInterval(t);
  }, [symbols, refreshPrices]);

  // ── 1s clock for countdown ──
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Compute live returns ──
  const creatorReturn = useMemo(() => {
    if (!creatorIndex || !startPrices || Object.keys(currentPrices).length === 0) return null;
    return calculateIndexReturn(creatorIndex.assets, startPrices, currentPrices).totalReturn;
  }, [creatorIndex, startPrices, currentPrices]);

  const opponentReturn = useMemo(() => {
    if (!opponentIndex || !startPrices || Object.keys(currentPrices).length === 0) return null;
    return calculateIndexReturn(opponentIndex.assets, startPrices, currentPrices).totalReturn;
  }, [opponentIndex, startPrices, currentPrices]);

  // ── Append chart points while ACTIVE (~2.5s, aligned with price poll) ──
  useEffect(() => {
    if (!duel || duel.status !== DUEL_STATUS.ACTIVE || !duel.startTime) return;
    if (creatorReturn == null && opponentReturn == null) return;
    const nowMs = Date.now();
    if (nowMs - lastChartSampleRef.current < 2_500) return;
    lastChartSampleRef.current = nowMs;

    const t = Math.min(duel.durationMs, Math.max(0, nowMs - duel.startTime));
    setSeries((prev) => {
      const next: SeriesStore = {
        creator: creatorReturn != null
          ? sanitizeSeries(
              [...(prev.creator.length ? prev.creator : [{ t: 0, value: 0 }]), { t, value: Math.round(creatorReturn * 100) / 100 }],
              duel.durationMs
            ).slice(-600)
          : prev.creator,
        opponent: opponentReturn != null
          ? sanitizeSeries(
              [...(prev.opponent.length ? prev.opponent : [{ t: 0, value: 0 }]), { t, value: Math.round(opponentReturn * 100) / 100 }],
              duel.durationMs
            ).slice(-600)
          : prev.opponent,
      };
      saveSeries(id, next, duel.durationMs);
      return next;
    });
  }, [creatorReturn, opponentReturn, duel, id, chartTick]);

  // ── Derived display values ──
  const entry = duel?.entryAmount ?? 0;
  const feeBps = duel?.platformFeeBps ?? 200;
  const pool = entry * 2;
  const winnerTakes = pool * (1 - feeBps / 10000);
  const noOpponent = !duel?.opponent || duel.opponent === ZERO_ADDR;

  const progress = useMemo(() => {
    if (!duel) return 0;
    if (duel.status === DUEL_STATUS.SETTLED) return 1;
    if (duel.status !== DUEL_STATUS.ACTIVE || !duel.startTime) return 0;
    return Math.min(1, Math.max(0, (now - duel.startTime) / duel.durationMs));
  }, [duel, now]);

  const timeLeftMs = duel && duel.endTime ? duel.endTime - now : 0;

  // For settled duels, prefer authoritative result-blob returns and synthesize a line if no live history.
  const chartSeries: SeriesStore = useMemo(() => {
    const dur = duel?.durationMs ?? 0;
    const base = {
      creator: sanitizeSeries(series.creator, dur),
      opponent: sanitizeSeries(series.opponent, dur),
    };
    if (duel?.status === DUEL_STATUS.SETTLED && result) {
      const synth = (final: number): ChartPoint[] => [{ t: 0, value: 0 }, { t: duel.durationMs, value: Math.round(final * 100) / 100 }];
      return {
        creator: base.creator.length > 1 ? base.creator : synth(result.creatorReturn),
        opponent: base.opponent.length > 1 ? base.opponent : synth(result.opponentReturn),
      };
    }
    return base;
  }, [duel, result, series]);

  // Final returns for settled display
  const finalCreator = result?.creatorReturn ?? creatorReturn;
  const finalOpponent = result?.opponentReturn ?? opponentReturn;

  const leader = useMemo(() => {
    const c = finalCreator, o = finalOpponent;
    if (c == null || o == null) return null;
    if (c === o) return "TIE";
    return c > o ? "CREATOR" : "OPPONENT";
  }, [finalCreator, finalOpponent]);

  // ── Render ──
  return (
    <main className="flex flex-col w-full min-h-screen bg-[#0A0A0A]">
      <Navbar />

      <div className="flex flex-col w-full pt-[60px] bg-[#050505] border-b border-[#1A1A1A]">
        <div className="flex flex-col gap-3 px-6 md:px-[48px] max-w-[1200px] mx-auto w-full py-8">
          <div className="flex items-center gap-2">
            <Link href="/duels" className="font-ibm-mono text-[10px] text-[#555] tracking-[1px] hover:text-[#888] transition-colors no-underline">← ARENA</Link>
            <span className="font-ibm-mono text-[10px] text-[#333]">/</span>
            <span className="font-ibm-mono text-[10px] text-[#888] tracking-[1px]">DUEL {shortAddr(id)}</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex items-center gap-4">
              {duel && (
                <div className="flex items-center justify-center h-[26px] px-[12px] border" style={{ borderColor: statusColor(duel.status), backgroundColor: `${statusColor(duel.status)}18` }}>
                  <span className="font-ibm-mono text-[9px] font-bold tracking-[2px]" style={{ color: statusColor(duel.status) }}>{statusLabel(duel.status)}</span>
                </div>
              )}
              <h1 className="font-grotesk text-[28px] md:text-[36px] font-bold text-[#F5F5F0] tracking-[-1.5px] leading-none">INDEX DUEL</h1>
            </div>
            {duel?.status === DUEL_STATUS.ACTIVE && (
              <div className="flex flex-col md:items-end">
                <span className="font-ibm-mono text-[9px] text-[#555] tracking-[2px]">TIME REMAINING</span>
                <span className="font-grotesk text-[28px] font-bold tracking-[-1px]" style={{ color: timeLeftMs > 0 ? "#4ADE80" : "#FF5F57" }}>
                  {fmtCountdown(timeLeftMs)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 w-full max-w-[1200px] mx-auto px-6 md:px-[48px] py-8 md:py-12 gap-6">

        {loading && (
          <div className="flex items-center justify-center h-[200px] bg-[#111111] border border-[#1E1E1E]">
            <div className="flex items-center gap-3">
              <div className="w-[16px] h-[16px] border-2 border-[#FFD600] border-t-transparent animate-spin" />
              <span className="font-ibm-mono text-[11px] text-[#555] tracking-[2px]">LOADING DUEL...</span>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center h-[200px] bg-[#111111] border border-[#1E1E1E] gap-3">
            <span className="font-ibm-mono text-[11px] text-[#FF5F57] tracking-[2px]">{error}</span>
            <Link href="/duels" className="font-ibm-mono text-[10px] text-[#FFD600] tracking-[2px] underline">← BACK TO ARENA</Link>
          </div>
        )}

        {!loading && !error && duel && (
          <>
            {/* ── Stats row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-[2px]">
              <StatBox label="ENTRY" value={`${entry} SUI`} color="#FFD600" />
              <StatBox label="PRIZE POOL" value={`${pool.toFixed(2)} SUI`} />
              <StatBox label="WINNER TAKES" value={`${winnerTakes.toFixed(2)} SUI`} color="#4ADE80" />
              <StatBox label="DURATION" value={formatDuration(duel.durationMs)} />
            </div>

            {/* ── Settled banner ── */}
            {duel.status === DUEL_STATUS.SETTLED && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-5 bg-[#0D0D0D] border-2 border-[#4ADE80]">
                <div className="flex items-center gap-3">
                  <span className="font-grotesk text-[20px] font-bold text-[#4ADE80] tracking-[-1px]">WINNER</span>
                  <span className="font-ibm-mono text-[13px] text-[#F5F5F0] tracking-[1px]">{shortAddr(duel.winner)}</span>
                </div>
                {duel.resultBlobId && (
                  <span className="font-ibm-mono text-[9px] text-[#555] tracking-[1px]">RESULT ON WALRUS // {duel.resultBlobId.slice(0, 18)}...</span>
                )}
              </div>
            )}

            {/* ── Waiting for opponent ── */}
            {duel.status === DUEL_STATUS.OPEN && (
              <div className="flex flex-col items-center justify-center gap-3 p-8 bg-[#0D0D0D] border border-[#FFD60040]">
                <span className="font-grotesk text-[18px] font-bold text-[#FFD600] tracking-[-0.5px]">WAITING FOR AN OPPONENT</span>
                <span className="font-ibm-mono text-[10px] text-[#555] tracking-[1px] text-center">
                  THE LIVE COMPETITION CHART STARTS ONCE SOMEONE JOINS THIS DUEL.
                </span>
                <Link href="/duels" className="mt-1 font-ibm-mono text-[10px] text-[#FFD600] tracking-[2px] underline">BROWSE ARENA →</Link>
              </div>
            )}

            {/* ── Ended, awaiting auto-settlement ── */}
            {duel.status === DUEL_STATUS.ACTIVE && timeLeftMs <= 0 && (
              <div className="flex items-center gap-4 p-5 bg-[#0D0D0D] border border-[#4ADE8040]">
                <div className="w-[8px] h-[8px] rounded-full bg-[#4ADE80] animate-pulse shrink-0" />
                <div className="flex flex-col gap-[3px]">
                  <span className="font-grotesk text-[15px] font-bold text-[#4ADE80] tracking-[-0.5px]">DUEL ENDED — SETTLING</span>
                  <span className="font-ibm-mono text-[10px] text-[#555] tracking-[1px]">
                    THE WINNER WILL RECEIVE {winnerTakes.toFixed(2)} SUI. AUTO-SETTLEMENT COMPLETES WITHIN ~30S.
                  </span>
                </div>
              </div>
            )}

            {/* ── Competition chart ── */}
            {(duel.status === DUEL_STATUS.ACTIVE || duel.status === DUEL_STATUS.SETTLED) && (
              <div className="flex flex-col gap-3 p-5 md:p-6 bg-[#111111] border border-[#1E1E1E]">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-ibm-mono text-[10px] font-bold text-[#888] tracking-[2px]">INDEX RETURN — HEAD TO HEAD</span>
                  <div className="flex items-center gap-2">
                    {duel.status === DUEL_STATUS.ACTIVE && (
                      <span className="font-ibm-mono text-[9px] text-[#4ADE80] tracking-[1px] bg-[#4ADE8010] px-2 py-[3px] border border-[#4ADE8030]">● LIVE // 3S</span>
                    )}
                  </div>
                </div>
                {startPrices ? (
                  <DuelChart
                    creatorSeries={chartSeries.creator}
                    opponentSeries={chartSeries.opponent}
                    durationMs={duel.durationMs}
                    creatorLabel={`CREATOR ${finalCreator != null ? `(${finalCreator >= 0 ? "+" : ""}${finalCreator.toFixed(2)}%)` : ""}`}
                    opponentLabel={`OPPONENT ${finalOpponent != null ? `(${finalOpponent >= 0 ? "+" : ""}${finalOpponent.toFixed(2)}%)` : ""}`}
                    progress={progress}
                    creatorColor={CREATOR_COLOR}
                    opponentColor={OPPONENT_COLOR}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-[200px] gap-3">
                    <div className="w-[16px] h-[16px] border-2 border-[#FFD600] border-t-transparent animate-spin" />
                    <span className="font-ibm-mono text-[10px] text-[#555] tracking-[1px] text-center">
                      {creatorIndex || opponentIndex
                        ? "LOADING START PRICES..."
                        : "LOADING INDEX DATA..."}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── Two index panels ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[2px]">
              <IndexPanel
                title="CREATOR"
                address={duel.creator}
                color={CREATOR_COLOR}
                index={creatorIndex}
                blobId={duel.creatorBlobId}
                totalReturn={finalCreator}
                startPrices={startPrices}
                currentPrices={currentPrices}
                isLeader={leader === "CREATOR"}
                settled={duel.status === DUEL_STATUS.SETTLED}
              />
              {noOpponent ? (
                <div className="flex flex-col items-center justify-center gap-2 p-8 bg-[#0D0D0D] border border-[#1E1E1E]">
                  <span className="font-grotesk text-[16px] font-bold text-[#333] tracking-[-0.5px]">NO OPPONENT YET</span>
                  <span className="font-ibm-mono text-[9px] text-[#444] tracking-[1px]">SLOT OPEN</span>
                </div>
              ) : (
                <IndexPanel
                  title="OPPONENT"
                  address={duel.opponent}
                  color={OPPONENT_COLOR}
                  index={opponentIndex}
                  blobId={duel.opponentBlobId}
                  totalReturn={finalOpponent}
                  startPrices={startPrices}
                  currentPrices={currentPrices}
                  isLeader={leader === "OPPONENT"}
                  settled={duel.status === DUEL_STATUS.SETTLED}
                />
              )}
            </div>

            {/* ── On-chain refs ── */}
            <div className="flex flex-col gap-[2px] p-5 bg-[#0D0D0D] border border-[#1E1E1E]">
              <span className="font-ibm-mono text-[9px] text-[#555] tracking-[2px] mb-2">ON-CHAIN REFERENCES</span>
              <RefRow label="DUEL OBJECT" value={id} href={getExplorerUrl("object", id)} />
              <RefRow label="CREATOR" value={duel.creator} href={getExplorerUrl("address", duel.creator)} />
              {!noOpponent && <RefRow label="OPPONENT" value={duel.opponent} href={getExplorerUrl("address", duel.opponent)} />}
            </div>
          </>
        )}
      </div>

      <Footer />
    </main>
  );
}

// ── Subcomponents ──

function StatBox({ label, value, color = "#F5F5F0" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1 p-4 bg-[#111111] border border-[#1E1E1E]">
      <span className="font-ibm-mono text-[9px] text-[#555] tracking-[2px]">{label}</span>
      <span className="font-grotesk text-[20px] font-bold tracking-[-1px]" style={{ color }}>{value}</span>
    </div>
  );
}

function IndexPanel({
  title, address, color, index, blobId, totalReturn, startPrices, currentPrices, isLeader, settled,
}: {
  title: string;
  address: string;
  color: string;
  index: IndexComposition | null;
  blobId: string;
  totalReturn: number | null;
  startPrices: Record<string, number> | null;
  currentPrices: Record<string, number>;
  isLeader: boolean;
  settled: boolean;
}) {
  const retColor = totalReturn == null ? "#555" : totalReturn >= 0 ? "#4ADE80" : "#FF5F57";
  return (
    <div className="flex flex-col gap-4 p-5 md:p-6 bg-[#111111] border" style={{ borderColor: isLeader ? color : "#1E1E1E" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block w-[10px] h-[10px]" style={{ backgroundColor: color }} />
          <span className="font-ibm-mono text-[11px] font-bold tracking-[2px]" style={{ color }}>{title}</span>
          {isLeader && (
            <span className="font-ibm-mono text-[8px] tracking-[1px] px-[6px] py-[2px]" style={{ color: "#0A0A0A", backgroundColor: color }}>
              {settled ? "WON" : "LEADING"}
            </span>
          )}
        </div>
        <span className="font-ibm-mono text-[10px] text-[#555] tracking-[1px]">{shortAddr(address)}</span>
      </div>

      {/* Return */}
      <div className="flex flex-col">
        <span className="font-ibm-mono text-[9px] text-[#555] tracking-[2px]">{settled ? "FINAL RETURN" : "LIVE RETURN"}</span>
        <span className="font-grotesk text-[32px] font-bold tracking-[-1.5px] leading-none" style={{ color: retColor }}>
          {totalReturn == null ? "—" : `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`}
        </span>
      </div>

      {/* Composition */}
      {index ? (
        <div className="flex flex-col gap-[2px]">
          <span className="font-ibm-mono text-[9px] text-[#555] tracking-[2px] mb-1">COMPOSITION ({index.assets.length})</span>
          {index.assets.map((a) => {
            const sp = startPrices?.[a.symbol];
            const cp = currentPrices[a.symbol];
            const assetRet = sp && cp ? ((cp - sp) / sp) * 100 : null;
            return (
              <div key={a.symbol} className="flex items-center gap-3 py-[6px] border-b border-[#1A1A1A] last:border-b-0">
                <CryptoLogo symbol={a.symbol} size={18} />
                <span className="font-grotesk text-[13px] font-bold text-[#F5F5F0] w-[52px]">{a.symbol}</span>
                <span className="font-ibm-mono text-[11px] tracking-[1px]" style={{ color }}>{a.weight}%</span>
                <span className="font-ibm-mono text-[10px] text-[#555] tracking-[1px] flex-1 text-right">
                  {cp != null ? formatPrice(cp) : "—"}
                </span>
                {assetRet != null && (
                  <span className="font-ibm-mono text-[10px] tracking-[1px] w-[64px] text-right" style={{ color: assetRet >= 0 ? "#4ADE80" : "#FF5F57" }}>
                    {assetRet >= 0 ? "+" : ""}{assetRet.toFixed(2)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <span className="font-ibm-mono text-[10px] text-[#555] tracking-[1px]">
          {blobId ? "LOADING INDEX FROM WALRUS..." : "INDEX NOT AVAILABLE"}
        </span>
      )}
    </div>
  );
}

function RefRow({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-[5px] border-b border-[#1A1A1A] last:border-b-0">
      <span className="font-ibm-mono text-[10px] text-[#555] tracking-[1.5px] shrink-0">{label}</span>
      <a href={href} target="_blank" rel="noopener noreferrer" className="font-ibm-mono text-[10px] text-[#FFD600] tracking-[1px] break-all text-right hover:underline">
        {value}
      </a>
    </div>
  );
}
