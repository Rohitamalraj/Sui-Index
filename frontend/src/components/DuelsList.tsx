"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JoinDuelModal from "./JoinDuelModal";
import {
  fetchDuelCreatedEvents,
  fetchDuelJoinedEvents,
  fetchDuelSettledEvents,
  fetchDuel,
  statusLabel,
  statusColor,
  shortAddr,
  formatDuration,
  timeRemaining,
  bpsToReturn,
  CONTRACT_CONFIG,
  DUEL_STATUS,
  type OnChainDuel,
} from "@/lib/sui";

// ── Types ─────────────────────────────────────────────────────────────────────
type FilterTab = "ALL" | "OPEN" | "ACTIVE" | "SETTLED";

interface DisplayDuel extends OnChainDuel {
  creatorReturnBps: number;
  opponentReturnBps: number;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
function useOnChainDuels() {
  const [duels, setDuels] = useState<DisplayDuel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [created, , settled] = await Promise.all([
        fetchDuelCreatedEvents(50),
        fetchDuelJoinedEvents(50),
        fetchDuelSettledEvents(50),
      ]);
      const settledMap = new Map(settled.map((e) => [e.duelId, e]));
      const duelObjects = await Promise.all(created.map((e) => fetchDuel(e.duelId)));
      const display: DisplayDuel[] = duelObjects
        .filter((d): d is OnChainDuel => d !== null)
        .map((d) => ({
          ...d,
          creatorReturnBps:  settledMap.get(d.objectId)?.creatorReturnBps  ?? 0,
          opponentReturnBps: settledMap.get(d.objectId)?.opponentReturnBps ?? 0,
        }));
      setDuels(display);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load duels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  return { duels, loading, error, reload: load };
}

// ── Live countdown ─────────────────────────────────────────────────────────────
function Countdown({ endTime }: { endTime: number }) {
  const [label, setLabel] = useState(timeRemaining(endTime));
  useEffect(() => {
    const t = setInterval(() => setLabel(timeRemaining(endTime)), 1000);
    return () => clearInterval(t);
  }, [endTime]);
  return <span className="font-ibm-mono text-[14px] text-[#4ADE80] font-bold tracking-[1px]">{label}</span>;
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
function FilterTabs({ active, onChange, counts }: {
  active: FilterTab;
  onChange: (f: FilterTab) => void;
  counts: Record<FilterTab, number>;
}) {
  const tabs: FilterTab[] = ["ALL", "OPEN", "ACTIVE", "SETTLED"];
  const colors: Record<FilterTab, string> = { ALL: "#F5F5F0", OPEN: "#FFD600", ACTIVE: "#4ADE80", SETTLED: "#888" };
  return (
    <div className="flex items-center gap-[2px]">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className="flex items-center gap-[6px] h-[36px] px-[14px] transition-colors border-none cursor-pointer"
          style={{
            backgroundColor: active === t ? "#1A1A1A" : "transparent",
            borderBottom:     active === t ? `1.5px solid ${colors[t]}` : "1.5px solid transparent",
          }}
        >
          <span className="font-ibm-mono text-[10px] tracking-[1.5px]" style={{ color: active === t ? colors[t] : "#555" }}>
            {t}
          </span>
          <span
            className="font-ibm-mono text-[9px] px-[5px] py-[1px]"
            style={{ color: active === t ? colors[t] : "#333", backgroundColor: active === t ? `${colors[t]}18` : "transparent" }}
          >
            {counts[t]}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DuelsList() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [joinTarget, setJoinTarget] = useState<DisplayDuel | null>(null);
  const { duels, loading, error, reload } = useOnChainDuels();

  const counts: Record<FilterTab, number> = {
    ALL:     duels.length,
    OPEN:    duels.filter((d) => d.status === DUEL_STATUS.OPEN).length,
    ACTIVE:  duels.filter((d) => d.status === DUEL_STATUS.ACTIVE).length,
    SETTLED: duels.filter((d) => d.status === DUEL_STATUS.SETTLED).length,
  };

  const filtered = filter === "ALL" ? duels : duels.filter((d) => {
    if (filter === "OPEN")    return d.status === DUEL_STATUS.OPEN;
    if (filter === "ACTIVE")  return d.status === DUEL_STATUS.ACTIVE;
    if (filter === "SETTLED") return d.status === DUEL_STATUS.SETTLED;
    return true;
  });

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <FilterTabs active={filter} onChange={setFilter} counts={counts} />
          {!loading && !error && (
            <span className="hidden md:inline font-ibm-mono text-[9px] text-[#4ADE80] tracking-[1px] bg-[#4ADE8010] px-2 py-[3px] border border-[#4ADE8030]">
              ● LIVE
            </span>
          )}
        </div>
        <Link
          href="/create"
          className="hidden md:flex items-center justify-center h-[42px] px-[24px] bg-[#FFD600] hover:bg-[#e6c200] transition-colors no-underline"
        >
          <span className="font-grotesk text-[11px] font-bold text-[#0A0A0A] tracking-[2px]">+ CREATE DUEL</span>
        </Link>
      </div>

      {/* ── Table header ── */}
      <div className="hidden md:flex w-full h-[40px] bg-[#0D0D0D] border border-[#1E1E1E] mb-[2px]">
        {["STATUS / ID", "ENTRY", "DURATION", "PLAYERS", "ACTION / RESULT"].map((h, i) => (
          <div
            key={h}
            className={`flex items-center px-[20px] ${
              i === 0 ? "w-[220px]" : i === 1 ? "w-[120px]" : i === 2 ? "w-[120px]" : i === 3 ? "flex-1" : "w-[200px]"
            } ${i < 4 ? "border-r border-r-[#1E1E1E]" : ""}`}
          >
            <span className="font-ibm-mono text-[9px] font-bold text-[#444] tracking-[2px]">{h}</span>
          </div>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex flex-col w-full gap-[2px]">

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-[160px] bg-[#111111] border border-[#1E1E1E]">
            <div className="flex items-center gap-3">
              <div className="w-[16px] h-[16px] border-2 border-[#FFD600] border-t-transparent animate-spin" />
              <span className="font-ibm-mono text-[11px] text-[#555] tracking-[2px]">LOADING DUELS...</span>
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center h-[160px] bg-[#111111] border border-[#1E1E1E] gap-3">
            <span className="font-ibm-mono text-[10px] text-[#FF5F57] tracking-[2px]">FAILED TO LOAD</span>
            <span className="font-ibm-mono text-[9px] text-[#444] tracking-[1px]">{error}</span>
            <button
              onClick={reload}
              className="font-ibm-mono text-[9px] text-[#FFD600] tracking-[2px] underline bg-transparent border-none cursor-pointer"
            >
              RETRY →
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[240px] bg-[#111111] border border-[#1E1E1E] gap-4">
            <div className="flex flex-col items-center gap-2">
              <span className="font-ibm-mono text-[11px] text-[#444] tracking-[2px]">
                {filter === "ALL" ? "NO DUELS ON-CHAIN YET" : `NO ${filter} DUELS`}
              </span>
              {filter === "ALL" && (
                <span className="font-ibm-mono text-[9px] text-[#333] tracking-[1px]">
                  BE THE FIRST TO CREATE ONE
                </span>
              )}
            </div>
            {filter === "ALL" && (
              <Link
                href="/create"
                className="flex items-center justify-center h-[40px] px-[24px] bg-[#FFD600] hover:bg-[#e6c200] transition-colors no-underline"
              >
                <span className="font-grotesk text-[11px] font-bold text-[#0A0A0A] tracking-[2px]">+ CREATE DUEL</span>
              </Link>
            )}
          </div>
        )}

        {/* Rows */}
        {!loading && !error && filtered.map((duel) => {
          const sl = statusLabel(duel.status);
          const sc = statusColor(duel.status);
          const isOpen    = duel.status === DUEL_STATUS.OPEN;
          const isActive  = duel.status === DUEL_STATUS.ACTIVE;
          const isSettled = duel.status === DUEL_STATUS.SETTLED;
          const creatorReturn  = bpsToReturn(duel.creatorReturnBps);
          const opponentReturn = bpsToReturn(duel.opponentReturnBps);
          const noOpponent = !duel.opponent || duel.opponent === "0x0000000000000000000000000000000000000000000000000000000000000000";

          return (
            <div
              key={duel.objectId}
              onClick={() => router.push(`/duels/${duel.objectId}`)}
              className="flex flex-col md:flex-row md:items-center gap-4 md:gap-0 p-5 md:p-0 bg-[#111111] border border-[#1E1E1E] hover:border-[#333] hover:bg-[#141414] transition-all cursor-pointer"
            >
              {/* Status + ID */}
              <div className="flex items-center gap-4 md:w-[220px] md:px-[20px] md:py-[18px] md:border-r md:border-r-[#1E1E1E]">
                <div className="flex items-center justify-center h-[22px] px-[10px] border"
                  style={{ borderColor: sc, backgroundColor: `${sc}18` }}>
                  <span className="font-ibm-mono text-[8px] font-bold tracking-[2px]" style={{ color: sc }}>{sl}</span>
                </div>
                <span className="font-ibm-mono text-[10px] text-[#444] tracking-[1px]">{shortAddr(duel.objectId)}</span>
              </div>

              {/* Entry */}
              <div className="flex flex-col md:w-[120px] md:px-[20px] md:border-r md:border-r-[#1E1E1E]">
                <span className="font-ibm-mono text-[8px] text-[#444] tracking-[2px] md:hidden">ENTRY</span>
                <span className="font-grotesk text-[18px] font-bold text-[#F5F5F0] tracking-[-1px] leading-none">
                  {duel.entryAmount}
                  <span className="font-ibm-mono text-[10px] text-[#555] ml-1 font-normal">SUI</span>
                </span>
              </div>

              {/* Duration */}
              <div className="flex flex-col md:w-[120px] md:px-[20px] md:border-r md:border-r-[#1E1E1E]">
                <span className="font-ibm-mono text-[8px] text-[#444] tracking-[2px] md:hidden">DURATION</span>
                <span className="font-ibm-mono text-[12px] text-[#888] tracking-[1px]">{formatDuration(duel.durationMs)}</span>
              </div>

              {/* Players */}
              <div className="flex items-center gap-3 md:flex-1 md:px-[20px] md:border-r md:border-r-[#1E1E1E]">
                <span className="font-ibm-mono text-[11px] text-[#FFD600] tracking-[1px]">{shortAddr(duel.creator)}</span>
                <span className="font-grotesk text-[9px] font-bold text-[#333]">VS</span>
                <span className="font-ibm-mono text-[11px] tracking-[1px]"
                  style={{ color: noOpponent ? "#333" : "#FF6B35" }}>
                  {noOpponent ? "WAITING..." : shortAddr(duel.opponent!)}
                </span>
              </div>

              {/* Action / Result */}
              <div className="flex items-center md:w-[200px] md:px-[20px]">
                {isOpen && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setJoinTarget(duel); }}
                    className="flex items-center justify-center h-[36px] px-[20px] bg-[#FF6B35] hover:bg-[#e5612e] transition-colors border-none cursor-pointer w-full md:w-auto"
                  >
                    <span className="font-grotesk text-[10px] font-bold text-[#0A0A0A] tracking-[2px]">JOIN DUEL</span>
                  </button>
                )}
                {isActive && (
                  <div className="flex flex-col">
                    <span className="font-ibm-mono text-[8px] text-[#444] tracking-[2px]">TIME LEFT</span>
                    <Countdown endTime={duel.endTime} />
                  </div>
                )}
                {isSettled && (
                  <div className="flex flex-col gap-1">
                    <span className="font-ibm-mono text-[8px] text-[#444] tracking-[2px]">RESULT</span>
                    <div className="flex items-center gap-2">
                      <span className="font-ibm-mono text-[11px] text-[#4ADE80] tracking-[1px]">
                        {creatorReturn >= 0 ? "+" : ""}{creatorReturn.toFixed(2)}%
                      </span>
                      <span className="font-ibm-mono text-[8px] text-[#333]">vs</span>
                      <span className="font-ibm-mono text-[11px] text-[#FF5F57] tracking-[1px]">
                        {opponentReturn >= 0 ? "+" : ""}{opponentReturn.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Stats footer ── */}
      {!loading && !error && duels.length > 0 && (
        <div className="flex flex-wrap items-center gap-6 pt-6 mt-2 border-t border-[#1A1A1A]">
          <StatChip label="TOTAL"   value={String(counts.ALL)}     />
          <StatChip label="OPEN"    value={String(counts.OPEN)}    color="#FFD600" />
          <StatChip label="ACTIVE"  value={String(counts.ACTIVE)}  color="#4ADE80" />
          <StatChip label="SETTLED" value={String(counts.SETTLED)} color="#888"    />
          <span className="font-ibm-mono text-[9px] text-[#333] tracking-[1px] md:ml-auto">
            TATUM RPC // AUTO-REFRESH 30S
          </span>
        </div>
      )}

      {/* ── Mobile CTA ── */}
      <Link
        href="/create"
        className="md:hidden flex items-center justify-center w-full h-[52px] bg-[#FFD600] hover:bg-[#e6c200] transition-colors no-underline mt-6"
      >
        <span className="font-grotesk text-[12px] font-bold text-[#0A0A0A] tracking-[2px]">+ CREATE DUEL</span>
      </Link>

      {/* ── Join modal ── */}
      {joinTarget && (
        <JoinDuelModal
          isOpen={true}
          duel={joinTarget}
          onClose={() => setJoinTarget(null)}
          onJoined={() => { setJoinTarget(null); setTimeout(reload, 3000); }}
        />
      )}
    </>
  );
}

function StatChip({ label, value, color = "#F5F5F0" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-ibm-mono text-[9px] text-[#444] tracking-[2px]">{label}</span>
      <span className="font-grotesk text-[18px] font-bold tracking-[-1px]" style={{ color }}>{value}</span>
    </div>
  );
}
