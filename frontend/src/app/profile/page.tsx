"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  fetchDuelCreatedEvents,
  fetchDuelJoinedEvents,
  fetchDuelSettledEvents,
  shortAddr,
  type DuelCreatedEvent,
  type DuelJoinedEvent,
  type DuelSettledEvent,
} from "@/lib/sui";
import { getExplorerUrl } from "@/lib/tatum";

const FEE_BPS = 200;

// For a win: receives 2*entry*(1-fee) → net = +entry*(1-2*fee/10000)
function winNet(entry: number) {
  return entry * (2 * (1 - FEE_BPS / 10_000) - 1);
}

interface DuelRow {
  duelId: string;
  role: "CREATOR" | "OPPONENT";
  entryAmount: number;
  status: "WON" | "LOST" | "PENDING";
  net: number; // SUI net
  creatorReturn: number | null;
  opponentReturn: number | null;
  timestampMs: number;
}

// ── Stat tile ──────────────────────────────────────────────────────────
function StatTile({
  label,
  value,
  sub,
  color = "#F5F5F0",
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1 p-5 bg-[#111111] border"
      style={{ borderColor: accent ? color : "#1E1E1E" }}
    >
      <span className="font-ibm-mono text-[9px] text-[#555] tracking-[2px]">
        {label}
      </span>
      <span
        className="font-grotesk text-[28px] font-bold tracking-[-1.5px] leading-none"
        style={{ color }}
      >
        {value}
      </span>
      {sub && (
        <span className="font-ibm-mono text-[10px] text-[#444] tracking-[1px] mt-[2px]">
          {sub}
        </span>
      )}
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PnLTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val: number = payload[0]?.value ?? 0;
  return (
    <div
      style={{
        background: "#0D0D0D",
        border: "1px solid #222",
        padding: "8px 12px",
        fontFamily: "var(--font-ibm-mono, monospace)",
      }}
    >
      <p style={{ fontSize: 9, color: "#555", marginBottom: 4, letterSpacing: 2 }}>
        {label}
      </p>
      <p
        style={{
          fontSize: 13,
          fontWeight: "bold",
          color: val >= 0 ? "#4ADE80" : "#FF5F57",
          letterSpacing: 0.5,
        }}
      >
        {val >= 0 ? "+" : ""}
        {val.toFixed(3)} SUI
      </p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, value }: any) {
  if (!value) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#0A0A0A"
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fontFamily: "var(--font-grotesk, sans-serif)", fontSize: 13, fontWeight: "bold" }}
    >
      {name[0]} {value}
    </text>
  );
}

export default function ProfilePage() {
  const account = useCurrentAccount();
  const address = account?.address ?? null;

  const [rows, setRows] = useState<DuelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [created, joined, settled]: [
          DuelCreatedEvent[],
          DuelJoinedEvent[],
          DuelSettledEvent[]
        ] = await Promise.all([
          fetchDuelCreatedEvents(50),
          fetchDuelJoinedEvents(50),
          fetchDuelSettledEvents(50),
        ]);

        const settledMap = new Map<string, DuelSettledEvent>();
        for (const s of settled) settledMap.set(s.duelId, s);

        const createdMap = new Map<string, DuelCreatedEvent>();
        for (const c of created) createdMap.set(c.duelId, c);

        const result: DuelRow[] = [];

        // Duels I created
        for (const ev of created) {
          if (ev.creator.toLowerCase() !== address.toLowerCase()) continue;
          const s = settledMap.get(ev.duelId);
          if (s) {
            const won = s.winner.toLowerCase() === address.toLowerCase();
            result.push({
              duelId: ev.duelId,
              role: "CREATOR",
              entryAmount: ev.entryAmount,
              status: won ? "WON" : "LOST",
              net: won ? winNet(ev.entryAmount) : -ev.entryAmount,
              creatorReturn: s.creatorReturnBps / 100,
              opponentReturn: s.opponentReturnBps / 100,
              timestampMs: ev.timestampMs,
            });
          } else {
            result.push({
              duelId: ev.duelId,
              role: "CREATOR",
              entryAmount: ev.entryAmount,
              status: "PENDING",
              net: 0,
              creatorReturn: null,
              opponentReturn: null,
              timestampMs: ev.timestampMs,
            });
          }
        }

        // Duels I joined as opponent
        for (const jEv of joined) {
          if (jEv.opponent.toLowerCase() !== address.toLowerCase()) continue;
          // Avoid double-counting if I created and joined my own duel (shouldn't happen but guard it)
          if (result.find((r) => r.duelId === jEv.duelId)) continue;
          const s = settledMap.get(jEv.duelId);
          const cEv = createdMap.get(jEv.duelId);
          const entry = cEv?.entryAmount ?? 0;
          if (s) {
            const won = s.winner.toLowerCase() === address.toLowerCase();
            result.push({
              duelId: jEv.duelId,
              role: "OPPONENT",
              entryAmount: entry,
              status: won ? "WON" : "LOST",
              net: won ? winNet(entry) : -entry,
              creatorReturn: s.creatorReturnBps / 100,
              opponentReturn: s.opponentReturnBps / 100,
              timestampMs: jEv.startTime,
            });
          } else {
            result.push({
              duelId: jEv.duelId,
              role: "OPPONENT",
              entryAmount: entry,
              status: "PENDING",
              net: 0,
              creatorReturn: null,
              opponentReturn: null,
              timestampMs: jEv.startTime,
            });
          }
        }

        result.sort((a, b) => a.timestampMs - b.timestampMs);
        setRows(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [address]);

  // ── Derived stats ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    const settled = rows.filter((r) => r.status !== "PENDING");
    const wins = settled.filter((r) => r.status === "WON").length;
    const losses = settled.filter((r) => r.status === "LOST").length;
    const pending = rows.filter((r) => r.status === "PENDING").length;
    const totalPnl = settled.reduce((acc, r) => acc + r.net, 0);
    const winRate = settled.length > 0 ? (wins / settled.length) * 100 : 0;
    const bestWin = Math.max(0, ...settled.filter((r) => r.status === "WON").map((r) => r.net));
    const worstLoss = Math.min(0, ...settled.filter((r) => r.status === "LOST").map((r) => r.net));
    return { total: rows.length, wins, losses, pending, totalPnl, winRate, bestWin, worstLoss };
  }, [rows]);

  // ── Chart data ─────────────────────────────────────────────────────
  const pnlChartData = useMemo(() => {
    let cumulative = 0;
    return rows
      .filter((r) => r.status !== "PENDING")
      .map((r, i) => {
        cumulative += r.net;
        return {
          label: `D${i + 1}`,
          net: Math.round(r.net * 1000) / 1000,
          cumulative: Math.round(cumulative * 1000) / 1000,
          won: r.status === "WON",
        };
      });
  }, [rows]);

  const pieData = useMemo(
    () => [
      { name: "Wins", value: stats.wins, color: "#4ADE80" },
      { name: "Losses", value: stats.losses, color: "#FF5F57" },
      { name: "Pending", value: stats.pending, color: "#444" },
    ].filter((d) => d.value > 0),
    [stats]
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <main className="flex flex-col w-full min-h-screen bg-[#0A0A0A]">
      <Navbar />

      {/* Header */}
      <div className="flex flex-col w-full pt-[60px] bg-[#050505] border-b border-[#1A1A1A]">
        <div className="flex flex-col gap-3 px-6 md:px-[48px] max-w-[1200px] mx-auto w-full py-8">
          <div className="flex items-center gap-2">
            <span className="font-ibm-mono text-[10px] text-[#555] tracking-[1px]">
              PROFILE
            </span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h1 className="font-grotesk text-[28px] md:text-[36px] font-bold text-[#F5F5F0] tracking-[-1.5px] leading-none">
                PLAYER STATS
              </h1>
              {address && (
                <a
                  href={getExplorerUrl("address", address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-ibm-mono text-[11px] text-[#FFD600] tracking-[1px] hover:underline"
                >
                  {shortAddr(address)}
                </a>
              )}
            </div>
            {!address && (
              <span className="font-ibm-mono text-[11px] text-[#555] tracking-[1px]">
                Connect your wallet to view stats
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 w-full max-w-[1200px] mx-auto px-6 md:px-[48px] py-8 md:py-12 gap-8">
        {!address && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 bg-[#111111] border border-[#1E1E1E]">
            <div className="w-[32px] h-[32px] border border-[#FFD600] flex items-center justify-center">
              <span className="font-grotesk text-[16px] font-bold text-[#FFD600]">?</span>
            </div>
            <span className="font-ibm-mono text-[11px] text-[#555] tracking-[2px]">
              CONNECT WALLET TO SEE YOUR STATS
            </span>
          </div>
        )}

        {address && loading && (
          <div className="flex items-center justify-center h-[200px] bg-[#111111] border border-[#1E1E1E]">
            <div className="flex items-center gap-3">
              <div className="w-[16px] h-[16px] border-2 border-[#FFD600] border-t-transparent animate-spin" />
              <span className="font-ibm-mono text-[11px] text-[#555] tracking-[2px]">
                LOADING STATS...
              </span>
            </div>
          </div>
        )}

        {address && error && (
          <div className="p-5 bg-[#1F0D0D] border border-[#FF5F57]">
            <span className="font-ibm-mono text-[10px] text-[#FF5F57] tracking-[1px]">
              {error}
            </span>
          </div>
        )}

        {address && !loading && !error && (
          <>
            {/* ── Stat tiles ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[2px]">
              <StatTile label="TOTAL DUELS" value={String(stats.total)} />
              <StatTile
                label="WINS"
                value={String(stats.wins)}
                color="#4ADE80"
                accent={stats.wins > 0}
              />
              <StatTile
                label="LOSSES"
                value={String(stats.losses)}
                color="#FF5F57"
              />
              <StatTile
                label="WIN RATE"
                value={`${stats.winRate.toFixed(0)}%`}
                color={stats.winRate >= 50 ? "#4ADE80" : "#F5F5F0"}
              />
              <StatTile
                label="TOTAL P&L"
                value={`${stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(3)}`}
                sub="SUI"
                color={stats.totalPnl >= 0 ? "#4ADE80" : "#FF5F57"}
                accent={stats.totalPnl !== 0}
              />
              <StatTile
                label="PENDING"
                value={String(stats.pending)}
                color="#FFD600"
              />
            </div>

            {/* ── No duels yet ── */}
            {rows.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 py-16 bg-[#111111] border border-[#1E1E1E]">
                <span className="font-grotesk text-[20px] font-bold text-[#333] tracking-[-0.5px]">
                  NO DUELS YET
                </span>
                <span className="font-ibm-mono text-[10px] text-[#444] tracking-[1px]">
                  HEAD TO THE ARENA TO START COMPETING
                </span>
                <Link
                  href="/create"
                  className="mt-2 flex items-center justify-center h-[40px] px-[24px] bg-[#FFD600] no-underline"
                >
                  <span className="font-grotesk text-[11px] font-bold text-[#0A0A0A] tracking-[1.5px]">
                    + CREATE DUEL
                  </span>
                </Link>
              </div>
            )}

            {rows.length > 0 && (
              <>
                {/* ── Charts row ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-[2px]">
                  {/* Cumulative P&L — takes 2 cols */}
                  <div className="lg:col-span-2 flex flex-col gap-4 p-5 md:p-6 bg-[#111111] border border-[#1E1E1E]">
                    <div className="flex items-center justify-between">
                      <span className="font-ibm-mono text-[10px] font-bold text-[#888] tracking-[2px]">
                        CUMULATIVE P&amp;L
                      </span>
                      <span className="font-ibm-mono text-[9px] text-[#555] tracking-[1px]">
                        PER SETTLED DUEL
                      </span>
                    </div>
                    {pnlChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart
                          data={pnlChartData}
                          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                        >
                          <defs>
                            <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop
                                offset="5%"
                                stopColor={stats.totalPnl >= 0 ? "#4ADE80" : "#FF5F57"}
                                stopOpacity={0.18}
                              />
                              <stop
                                offset="95%"
                                stopColor={stats.totalPnl >= 0 ? "#4ADE80" : "#FF5F57"}
                                stopOpacity={0.01}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            stroke="#1A1A1A"
                            strokeDasharray="3 6"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="label"
                            tick={{
                              fontFamily: "var(--font-ibm-mono, monospace)",
                              fontSize: 9,
                              fill: "#444",
                            }}
                            axisLine={{ stroke: "#222" }}
                            tickLine={false}
                          />
                          <YAxis
                            tickFormatter={(v: number) =>
                              `${v >= 0 ? "+" : ""}${v.toFixed(2)}`
                            }
                            tick={{
                              fontFamily: "var(--font-ibm-mono, monospace)",
                              fontSize: 9,
                              fill: "#444",
                            }}
                            axisLine={false}
                            tickLine={false}
                            width={48}
                          />
                          <Tooltip content={<PnLTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="cumulative"
                            name="Cumulative P&L"
                            stroke={stats.totalPnl >= 0 ? "#4ADE80" : "#FF5F57"}
                            strokeWidth={2.5}
                            fill="url(#pnlGrad)"
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[220px]">
                        <span className="font-ibm-mono text-[10px] text-[#444] tracking-[1px]">
                          SETTLE A DUEL TO SEE YOUR P&amp;L CHART
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Win/Loss Pie */}
                  <div className="flex flex-col gap-4 p-5 md:p-6 bg-[#111111] border border-[#1E1E1E]">
                    <span className="font-ibm-mono text-[10px] font-bold text-[#888] tracking-[2px]">
                      OUTCOME BREAKDOWN
                    </span>
                    {pieData.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={46}
                              outerRadius={74}
                              dataKey="value"
                              labelLine={false}
                              label={PieLabel}
                            >
                              {pieData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-col gap-[6px]">
                          {pieData.map((d) => (
                            <div
                              key={d.name}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block w-[8px] h-[8px] rounded-sm"
                                  style={{ backgroundColor: d.color }}
                                />
                                <span className="font-ibm-mono text-[9px] text-[#888] tracking-[1px]">
                                  {d.name.toUpperCase()}
                                </span>
                              </div>
                              <span
                                className="font-grotesk text-[15px] font-bold"
                                style={{ color: d.color }}
                              >
                                {d.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center flex-1">
                        <span className="font-ibm-mono text-[10px] text-[#444] tracking-[1px]">
                          NO DATA YET
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Per-duel net bar chart ── */}
                {pnlChartData.length > 0 && (
                  <div className="flex flex-col gap-4 p-5 md:p-6 bg-[#111111] border border-[#1E1E1E]">
                    <span className="font-ibm-mono text-[10px] font-bold text-[#888] tracking-[2px]">
                      PER-DUEL RESULT
                    </span>
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart
                        data={pnlChartData}
                        margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid
                          stroke="#1A1A1A"
                          strokeDasharray="3 6"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{
                            fontFamily: "var(--font-ibm-mono, monospace)",
                            fontSize: 9,
                            fill: "#444",
                          }}
                          axisLine={{ stroke: "#222" }}
                          tickLine={false}
                        />
                        <YAxis
                          tickFormatter={(v: number) =>
                            `${v >= 0 ? "+" : ""}${v.toFixed(2)}`
                          }
                          tick={{
                            fontFamily: "var(--font-ibm-mono, monospace)",
                            fontSize: 9,
                            fill: "#444",
                          }}
                          axisLine={false}
                          tickLine={false}
                          width={48}
                        />
                        <Tooltip content={<PnLTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="net"
                          stroke="#FFD600"
                          strokeWidth={2}
                          dot={(props) => {
                            const { cx, cy, payload } = props as {
                              cx: number;
                              cy: number;
                              payload: { won: boolean };
                            };
                            return (
                              <circle
                                key={`dot-${cx}-${cy}`}
                                cx={cx}
                                cy={cy}
                                r={4}
                                fill={payload.won ? "#4ADE80" : "#FF5F57"}
                                strokeWidth={0}
                              />
                            );
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* ── Duel history table ── */}
                <div className="flex flex-col gap-0 bg-[#111111] border border-[#1E1E1E]">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-[#1A1A1A]">
                    <span className="font-ibm-mono text-[10px] font-bold text-[#888] tracking-[2px]">
                      DUEL HISTORY ({rows.length})
                    </span>
                  </div>

                  {/* Header row */}
                  <div className="hidden md:grid grid-cols-[1fr_80px_80px_80px_120px_100px] gap-4 px-5 py-3 border-b border-[#141414]">
                    {["DUEL", "ROLE", "ENTRY", "STATUS", "RETURN", "NET P&L"].map(
                      (h) => (
                        <span
                          key={h}
                          className="font-ibm-mono text-[8px] text-[#444] tracking-[2px]"
                        >
                          {h}
                        </span>
                      )
                    )}
                  </div>

                  {rows
                    .slice()
                    .reverse()
                    .map((row) => {
                      const statusColor =
                        row.status === "WON"
                          ? "#4ADE80"
                          : row.status === "LOST"
                          ? "#FF5F57"
                          : "#FFD600";
                      const myReturn =
                        row.role === "CREATOR"
                          ? row.creatorReturn
                          : row.opponentReturn;
                      return (
                        <Link
                          href={`/duels/${row.duelId}`}
                          key={row.duelId}
                          className="no-underline block border-b border-[#0F0F0F] hover:bg-[#141414] transition-colors"
                        >
                          <div className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_80px_80px_80px_120px_100px] gap-4 items-center px-5 py-4">
                            {/* Duel ID */}
                            <span className="font-ibm-mono text-[10px] text-[#FFD600] tracking-[1px]">
                              {shortAddr(row.duelId)}
                            </span>
                            {/* Role */}
                            <span
                              className="font-ibm-mono text-[9px] tracking-[1px]"
                              style={{
                                color:
                                  row.role === "CREATOR" ? "#FFD600" : "#FF6B35",
                              }}
                            >
                              {row.role}
                            </span>
                            {/* Entry */}
                            <span className="hidden md:block font-ibm-mono text-[10px] text-[#888] tracking-[1px]">
                              {row.entryAmount} SUI
                            </span>
                            {/* Status badge */}
                            <div className="hidden md:flex">
                              <span
                                className="font-ibm-mono text-[8px] tracking-[1.5px] px-[8px] py-[3px] border"
                                style={{
                                  color: statusColor,
                                  borderColor: `${statusColor}40`,
                                  backgroundColor: `${statusColor}10`,
                                }}
                              >
                                {row.status}
                              </span>
                            </div>
                            {/* Return */}
                            <span
                              className="hidden md:block font-ibm-mono text-[10px] tracking-[1px]"
                              style={{
                                color:
                                  myReturn == null
                                    ? "#555"
                                    : myReturn >= 0
                                    ? "#4ADE80"
                                    : "#FF5F57",
                              }}
                            >
                              {myReturn == null
                                ? "—"
                                : `${myReturn >= 0 ? "+" : ""}${myReturn.toFixed(2)}%`}
                            </span>
                            {/* Net */}
                            <span
                              className="font-grotesk text-[14px] font-bold tracking-[-0.5px]"
                              style={{
                                color:
                                  row.status === "PENDING"
                                    ? "#555"
                                    : row.net >= 0
                                    ? "#4ADE80"
                                    : "#FF5F57",
                              }}
                            >
                              {row.status === "PENDING"
                                ? "—"
                                : `${row.net >= 0 ? "+" : ""}${row.net.toFixed(3)}`}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <Footer />
    </main>
  );
}
