"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { fetchDuelSettledEvents, fetchDuelCreatedEvents, fetchDuelJoinedEvents, shortAddr } from "@/lib/sui";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PlayerStats {
  address: string;
  wins:       number;
  losses:     number;
  bestReturn: number;
  earnings:   number;
}

type Period = "WEEKLY" | "ALL TIME";

// ── Build leaderboard from on-chain settled events ────────────────────────────
async function buildLeaderboard(): Promise<PlayerStats[]> {
  const [created, joined, settled] = await Promise.all([
    fetchDuelCreatedEvents(100),
    fetchDuelJoinedEvents(100),
    fetchDuelSettledEvents(100),
  ]);

  const creatorMap  = new Map(created.map((e) => [e.duelId, { creator: e.creator, entryAmount: e.entryAmount }]));
  const opponentMap = new Map(joined.map((e) => [e.duelId, e.opponent]));
  const map         = new Map<string, PlayerStats>();

  const get = (addr: string): PlayerStats => {
    if (!map.has(addr)) map.set(addr, { address: addr, wins: 0, losses: 0, bestReturn: 0, earnings: 0 });
    return map.get(addr)!;
  };

  for (const s of settled) {
    const meta     = creatorMap.get(s.duelId);
    const creator  = meta?.creator  ?? "";
    const opponent = opponentMap.get(s.duelId) ?? "";
    const winner   = s.winner;

    if (!creator || !opponent) continue;

    const creatorReturn  = (s.creatorReturnBps  - 10000) / 100;
    const opponentReturn = (s.opponentReturnBps - 10000) / 100;
    const pool           = (meta?.entryAmount ?? 0) * 2 * 0.98;

    const cStats = get(creator);
    const oStats = get(opponent);

    if (winner === creator) {
      cStats.wins++;    cStats.earnings += pool;
      oStats.losses++;
    } else {
      oStats.wins++;    oStats.earnings += pool;
      cStats.losses++;
    }

    cStats.bestReturn = Math.max(cStats.bestReturn, creatorReturn);
    oStats.bestReturn = Math.max(oStats.bestReturn, opponentReturn);
  }

  return Array.from(map.values())
    .sort((a, b) => b.wins - a.wins || b.earnings - a.earnings);
}

// ── Hook ──────────────────────────────────────────────────────────────────────
function useLeaderboard() {
  const [data, setData]       = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await buildLeaderboard();
      setData(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function rankColor(rank: number) {
  if (rank === 1) return "#FFD600";
  if (rank === 2) return "#C0C0C0";
  if (rank === 3) return "#CD7F32";
  return "#444";
}

function rankBg(rank: number) {
  if (rank === 1) return "#FFD60008";
  if (rank === 2) return "#C0C0C008";
  if (rank === 3) return "#CD7F3208";
  return "transparent";
}

function winRate(p: PlayerStats) {
  const total = p.wins + p.losses;
  return total === 0 ? 0 : Math.round((p.wins / total) * 100);
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("ALL TIME");
  const { data, loading, error, reload } = useLeaderboard();

  const totalDuels   = data.reduce((acc, r) => acc + r.wins + r.losses, 0) / 2;
  const totalEarned  = data.reduce((acc, r) => acc + r.earnings, 0);
  const avgWR        = data.length
    ? Math.round(data.reduce((acc, r) => acc + winRate(r), 0) / data.length)
    : 0;

  return (
    <main className="flex flex-col w-full min-h-screen bg-[#0A0A0A]">
      <Navbar />

      {/* Page header */}
      <div className="flex flex-col w-full pt-[60px] bg-[#050505] border-b border-[#1A1A1A]">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 px-6 md:px-[48px] max-w-[1400px] mx-auto w-full py-10 md:py-14">
          <div className="flex flex-col gap-2">
            <span className="font-ibm-mono text-[10px] text-[#555] tracking-[3px]">// GLOBAL RANKINGS</span>
            <h1 className="font-grotesk text-[40px] md:text-[56px] font-bold text-[#F5F5F0] tracking-[-2px] leading-none">
              LEADERBOARD
            </h1>
            <p className="font-ibm-mono text-[12px] text-[#555] tracking-[1px] mt-1">
              TOP INDEX BUILDERS RANKED BY WINS, RETURNS, AND EARNINGS.
            </p>
          </div>

          {/* Period toggle */}
          <div className="flex items-center gap-[2px]">
            {(["WEEKLY", "ALL TIME"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="flex items-center justify-center h-[40px] px-[20px] transition-colors border-none cursor-pointer"
                style={{
                  backgroundColor: period === p ? "#FFD600" : "#111111",
                  border: period === p ? "none" : "1px solid #2D2D2D",
                }}
              >
                <span className="font-ibm-mono text-[10px] font-bold tracking-[1.5px]"
                  style={{ color: period === p ? "#0A0A0A" : "#555" }}>
                  {p}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-0 border-t border-[#1A1A1A] px-6 md:px-[48px] max-w-[1400px] mx-auto w-full">
          {[
            { label: "TOTAL PLAYERS", value: loading ? "—" : String(data.length)                   },
            { label: "TOTAL DUELS",   value: loading ? "—" : String(Math.round(totalDuels))        },
            { label: "AVG WIN RATE",  value: loading ? "—" : `${avgWR}%`                           },
            { label: "TOTAL EARNED",  value: loading ? "—" : `${totalEarned.toFixed(2)} SUI`       },
          ].map(({ label, value }, i) => (
            <div
              key={label}
              className={`flex flex-col gap-1 py-5 pr-8 ${i > 0 ? "pl-8 border-l border-[#1A1A1A]" : ""}`}
            >
              <span className="font-ibm-mono text-[8px] text-[#444] tracking-[2px]">{label}</span>
              <span className="font-grotesk text-[22px] font-bold text-[#F5F5F0] tracking-[-1px] leading-none">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 w-full max-w-[1400px] mx-auto px-6 md:px-[48px] py-10 md:py-14 gap-4">

        {/* Status badge */}
        <div className="flex items-center gap-2">
          {!loading && !error && (
            <span className="font-ibm-mono text-[9px] text-[#4ADE80] tracking-[1px] bg-[#4ADE8010] px-2 py-[3px] border border-[#4ADE8030]">
              ● LIVE ON-CHAIN
            </span>
          )}
          <span className="font-ibm-mono text-[9px] text-[#555] tracking-[1px]">
            DERIVED FROM SETTLED DUEL EVENTS · TATUM RPC
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-[200px] bg-[#111111] border border-[#1E1E1E]">
            <div className="flex items-center gap-3">
              <div className="w-[16px] h-[16px] border-2 border-[#FFD600] border-t-transparent animate-spin" />
              <span className="font-ibm-mono text-[11px] text-[#555] tracking-[2px]">LOADING RANKINGS...</span>
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center h-[200px] bg-[#111111] border border-[#1E1E1E] gap-3">
            <span className="font-ibm-mono text-[10px] text-[#FF5F57] tracking-[2px]">FAILED TO LOAD</span>
            <span className="font-ibm-mono text-[9px] text-[#444] tracking-[1px]">{error}</span>
            <button onClick={reload}
              className="font-ibm-mono text-[9px] text-[#FFD600] tracking-[2px] underline bg-transparent border-none cursor-pointer">
              RETRY →
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && data.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[280px] bg-[#111111] border border-[#1E1E1E] gap-4">
            <div className="flex flex-col items-center gap-2">
              <span className="font-ibm-mono text-[11px] text-[#444] tracking-[2px]">NO SETTLED DUELS YET</span>
              <span className="font-ibm-mono text-[9px] text-[#333] tracking-[1px]">
                RANKINGS APPEAR AFTER THE FIRST DUEL SETTLES
              </span>
            </div>
            <Link
              href="/create"
              className="flex items-center justify-center h-[40px] px-[24px] bg-[#FFD600] hover:bg-[#e6c200] transition-colors no-underline"
            >
              <span className="font-grotesk text-[11px] font-bold text-[#0A0A0A] tracking-[2px]">+ CREATE DUEL</span>
            </Link>
          </div>
        )}

        {/* Desktop table */}
        {!loading && !error && data.length > 0 && (
          <div className="hidden md:flex flex-col w-full">
            <div className="flex w-full h-[42px] bg-[#0D0D0D] border border-[#1E1E1E]">
              {[
                { label: "RANK",        cls: "w-[80px]"  },
                { label: "PLAYER",      cls: "flex-[2]"  },
                { label: "W / L",       cls: "w-[100px]" },
                { label: "WIN RATE",    cls: "w-[130px]" },
                { label: "BEST RETURN", cls: "w-[150px]" },
                { label: "EARNINGS",    cls: "w-[150px]" },
              ].map(({ label, cls }, i, arr) => (
                <div key={label} className={`flex items-center px-[20px] ${cls} ${i < arr.length - 1 ? "border-r border-r-[#1E1E1E]" : ""}`}>
                  <span className="font-ibm-mono text-[9px] font-bold text-[#444] tracking-[2px]">{label}</span>
                </div>
              ))}
            </div>

            {data.map((row, i) => {
              const rank = i + 1;
              const wr   = winRate(row);
              return (
                <div
                  key={row.address}
                  className="flex w-full border border-t-0 border-[#1E1E1E] hover:border-[#333] transition-all"
                  style={{ backgroundColor: rankBg(rank) }}
                >
                  <div className="flex items-center justify-center w-[80px] border-r border-r-[#1E1E1E] py-[18px]">
                    <span className="font-grotesk text-[22px] font-bold" style={{ color: rankColor(rank) }}>
                      {String(rank).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="flex items-center flex-[2] px-[20px] border-r border-r-[#1E1E1E]">
                    <div className="flex items-center gap-3">
                      <div className="w-[28px] h-[28px] flex items-center justify-center"
                        style={{ backgroundColor: `${rankColor(rank)}20`, border: `1px solid ${rankColor(rank)}40` }}>
                        <span className="font-ibm-mono text-[8px] font-bold" style={{ color: rankColor(rank) }}>
                          {row.address.slice(2, 4).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-ibm-mono text-[12px] text-[#F5F5F0] tracking-[1px]">
                        {shortAddr(row.address)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center w-[100px] px-[20px] border-r border-r-[#1E1E1E]">
                    <span className="font-ibm-mono text-[12px] tracking-[1px]">
                      <span className="text-[#4ADE80]">{row.wins}</span>
                      <span className="text-[#333] mx-[3px]">/</span>
                      <span className="text-[#FF5F57]">{row.losses}</span>
                    </span>
                  </div>

                  <div className="flex flex-col justify-center w-[130px] px-[20px] border-r border-r-[#1E1E1E] gap-[6px]">
                    <span className="font-ibm-mono text-[12px] text-[#FFD600] font-bold tracking-[1px]">{wr}%</span>
                    <div className="h-[2px] bg-[#1E1E1E] w-full">
                      <div className="h-full bg-[#FFD600]" style={{ width: `${wr}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center w-[150px] px-[20px] border-r border-r-[#1E1E1E]">
                    <span className="font-ibm-mono text-[13px] font-bold tracking-[1px]"
                      style={{ color: row.bestReturn >= 0 ? "#4ADE80" : "#FF5F57" }}>
                      {row.bestReturn >= 0 ? "+" : ""}{row.bestReturn.toFixed(2)}%
                    </span>
                  </div>

                  <div className="flex items-center w-[150px] px-[20px]">
                    <span className="font-ibm-mono text-[13px] font-bold text-[#F5F5F0] tracking-[1px]">
                      {row.earnings.toFixed(2)} SUI
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Mobile cards */}
        {!loading && !error && data.length > 0 && (
          <div className="flex flex-col md:hidden w-full gap-[2px]">
            {data.map((row, i) => {
              const rank = i + 1;
              const wr   = winRate(row);
              return (
                <div key={row.address} className="flex flex-col gap-3 p-5 border border-[#1E1E1E]"
                  style={{ backgroundColor: rankBg(rank) }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-grotesk text-[28px] font-bold leading-none" style={{ color: rankColor(rank) }}>
                        {String(rank).padStart(2, "0")}
                      </span>
                      <span className="font-ibm-mono text-[12px] text-[#F5F5F0] tracking-[1px]">{shortAddr(row.address)}</span>
                    </div>
                    <span className="font-ibm-mono text-[12px] text-[#FFD600] font-bold">{wr}%</span>
                  </div>
                  <div className="flex items-center gap-5 flex-wrap">
                    <span className="font-ibm-mono text-[10px] tracking-[1px]">
                      W/L: <span className="text-[#4ADE80]">{row.wins}</span>/<span className="text-[#FF5F57]">{row.losses}</span>
                    </span>
                    <span className="font-ibm-mono text-[10px] tracking-[1px]"
                      style={{ color: row.bestReturn >= 0 ? "#4ADE80" : "#FF5F57" }}>
                      BEST: {row.bestReturn >= 0 ? "+" : ""}{row.bestReturn.toFixed(2)}%
                    </span>
                    <span className="font-ibm-mono text-[10px] text-[#F5F5F0] font-bold tracking-[1px]">
                      {row.earnings.toFixed(2)} SUI
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-[#1A1A1A] mt-2">
          <span className="font-ibm-mono text-[10px] text-[#444] tracking-[1px]">
            COMPETE TO CLIMB THE RANKS. BEST INDEX WINS.
          </span>
          <Link
            href="/create"
            className="flex items-center justify-center h-[44px] px-[28px] bg-[#FFD600] hover:bg-[#e6c200] transition-colors no-underline"
          >
            <span className="font-grotesk text-[11px] font-bold text-[#0A0A0A] tracking-[2px]">+ CREATE DUEL</span>
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  );
}
