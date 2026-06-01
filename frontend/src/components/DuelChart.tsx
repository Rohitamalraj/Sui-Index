"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

export interface ChartPoint {
  /** Elapsed time from duel start, in ms */
  t: number;
  /** Weighted index return at this time, in % */
  value: number;
}

interface DuelChartProps {
  creatorSeries: ChartPoint[];
  opponentSeries: ChartPoint[];
  durationMs: number;
  creatorLabel: string;
  opponentLabel: string;
  /** 0..1 progress through the duel. 1 = ended. */
  progress: number;
  creatorColor?: string;
  opponentColor?: string;
}

interface MergedPoint {
  t: number;
  creator: number | null;
  opponent: number | null;
}

function fmtTime(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#0D0D0D",
        border: "1px solid #222",
        borderRadius: 2,
        padding: "10px 14px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-ibm-mono, monospace)",
          fontSize: 9,
          color: "#555",
          marginBottom: 8,
          letterSpacing: 2,
        }}
      >
        T + {fmtTime(label ?? 0)}
      </p>
      {payload.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) =>
          p.value != null && (
            <div
              key={p.dataKey}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 20,
                marginBottom: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 2.5,
                    backgroundColor: p.color,
                    borderRadius: 1,
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-ibm-mono, monospace)",
                    fontSize: 9,
                    color: "#888",
                    letterSpacing: 1,
                  }}
                >
                  {p.name?.split(" ")[0]}
                </span>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-ibm-mono, monospace)",
                  fontSize: 11,
                  fontWeight: "bold",
                  color: p.value >= 0 ? p.color : p.color,
                  letterSpacing: 0.5,
                }}
              >
                {p.value >= 0 ? "+" : ""}
                {(p.value as number).toFixed(2)}%
              </span>
            </div>
          )
      )}
    </div>
  );
}

export default function DuelChart({
  creatorSeries,
  opponentSeries,
  durationMs,
  creatorLabel,
  opponentLabel,
  progress,
  creatorColor = "#FFD600",
  opponentColor = "#FF6B35",
}: DuelChartProps) {
  const data = useMemo((): MergedPoint[] => {
    const byT = new Map<number, MergedPoint>();
    const add = (pts: ChartPoint[], key: "creator" | "opponent") => {
      for (const p of pts) {
        if (p.t < 0 || p.t > durationMs + 1_000) continue;
        const row = byT.get(p.t) ?? { t: p.t, creator: null, opponent: null };
        row[key] = p.value;
        byT.set(p.t, row);
      }
    };
    add(creatorSeries, "creator");
    add(opponentSeries, "opponent");
    const merged = Array.from(byT.values()).sort((a, b) => a.t - b.t);
    if (merged.length === 0) return [{ t: 0, creator: 0, opponent: 0 }];
    return merged;
  }, [creatorSeries, opponentSeries, durationMs]);

  const nowT = Math.round(progress * durationMs);

  // Determine y-axis domain — symmetric, at least ±2%
  const allVals = data.flatMap((p) =>
    [p.creator, p.opponent].filter((v): v is number => v != null)
  );
  const maxAbs = Math.max(2, ...allVals.map(Math.abs));
  const yExtent = Math.ceil(maxAbs * 1.25);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) =>
    Math.round(f * durationMs)
  );
  const yTicks = [-yExtent, -yExtent / 2, 0, yExtent / 2, yExtent];

  return (
    <div style={{ width: "100%" }}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
          {/* Grid */}
          <CartesianGrid
            stroke="#1A1A1A"
            strokeDasharray="3 6"
            vertical={false}
          />

          {/* Axes */}
          <XAxis
            dataKey="t"
            type="number"
            domain={[0, durationMs]}
            ticks={xTicks}
            tickFormatter={fmtTime}
            tick={{
              fontFamily: "var(--font-ibm-mono, monospace)",
              fontSize: 9,
              fill: "#444",
              letterSpacing: 1,
            }}
            axisLine={{ stroke: "#222" }}
            tickLine={false}
            scale="linear"
          />
          <YAxis
            domain={[-yExtent, yExtent]}
            ticks={yTicks}
            tickFormatter={(v: number) =>
              `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`
            }
            tick={{
              fontFamily: "var(--font-ibm-mono, monospace)",
              fontSize: 9,
              fill: "#444",
            }}
            axisLine={false}
            tickLine={false}
            width={44}
          />

          {/* Zero baseline */}
          <ReferenceLine y={0} stroke="#2A2A2A" strokeWidth={1} />

          {/* "Now" cursor for live duels */}
          {progress < 1 && (
            <ReferenceLine
              x={nowT}
              stroke="#4ADE80"
              strokeDasharray="4 4"
              strokeOpacity={0.55}
              strokeWidth={1}
            />
          )}

          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "#333", strokeDasharray: "3 3" }}
          />

          {/* Creator line */}
          <Line
            type="monotone"
            dataKey="creator"
            name={creatorLabel}
            stroke={creatorColor}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: creatorColor, strokeWidth: 0 }}
            connectNulls
          />

          {/* Opponent line */}
          <Line
            type="monotone"
            dataKey="opponent"
            name={opponentLabel}
            stroke={opponentColor}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: opponentColor, strokeWidth: 0 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Custom legend */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 28,
          marginTop: 10,
        }}
      >
        {[
          { label: creatorLabel, color: creatorColor },
          { label: opponentLabel, color: opponentColor },
        ].map((l) => (
          <div
            key={l.label}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <span
              style={{
                display: "inline-block",
                width: 16,
                height: 2.5,
                backgroundColor: l.color,
                borderRadius: 1,
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-ibm-mono, monospace)",
                fontSize: 10,
                color: l.color,
                letterSpacing: 1,
              }}
            >
              {l.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
