"use client";

import SectionHeader from "./SectionHeader";

const leaderboardData = [
  { rank: 1, address: "0xAb5c...3F91", wins: 24, losses: 6, winRate: "80%", bestReturn: "+18.4%", earnings: "142.5 SUI" },
  { rank: 2, address: "0x92Fd...8C12", wins: 19, losses: 5, winRate: "79%", bestReturn: "+15.2%", earnings: "118.0 SUI" },
  { rank: 3, address: "0x3E7a...D4F2", wins: 17, losses: 8, winRate: "68%", bestReturn: "+22.1%", earnings: "95.3 SUI" },
  { rank: 4, address: "0xF1c8...9A23", wins: 15, losses: 7, winRate: "68%", bestReturn: "+12.8%", earnings: "84.7 SUI" },
  { rank: 5, address: "0x7B2d...E5C1", wins: 13, losses: 9, winRate: "59%", bestReturn: "+19.5%", earnings: "62.1 SUI" },
];

function rankColor(rank: number) {
  if (rank === 1) return "#FFD600";
  if (rank === 2) return "#C0C0C0";
  if (rank === 3) return "#CD7F32";
  return "#555555";
}

export default function Leaderboard() {
  return (
    <section id="leaderboard" className="flex flex-col w-full bg-[#050505] py-16 px-6 md:py-[100px] md:px-[120px] gap-12 md:gap-[48px]">
      <div className="flex items-end justify-between">
        <SectionHeader
          label="[07] // LEADERBOARD"
          title={"TOP BUILDERS.\nTOP RETURNS."}
          titleWidth="w-full max-w-[600px]"
        />
        <div className="hidden md:flex items-center gap-[8px]">
          <div className="flex items-center justify-center h-[32px] px-[16px] bg-[#FFD600]">
            <span className="font-ibm-mono text-[10px] font-bold text-[#0A0A0A] tracking-[2px]">WEEKLY</span>
          </div>
          <div className="flex items-center justify-center h-[32px] px-[16px] bg-[#111111] border border-[#2D2D2D]">
            <span className="font-ibm-mono text-[10px] font-bold text-[#555] tracking-[2px]">ALL TIME</span>
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:flex flex-col w-full border border-[#2D2D2D]">
        <div className="flex w-full h-[48px] bg-[#111111] border-b border-b-[#2D2D2D]">
          {["RANK", "PLAYER", "W/L", "WIN RATE", "BEST RETURN", "EARNINGS"].map((h, i) => (
            <div
              key={h}
              className={`flex items-center px-[24px] ${i === 0 ? "w-[80px]" : i === 1 ? "flex-[2]" : "flex-1"} ${i < 5 ? "border-r border-r-[#2D2D2D]" : ""}`}
            >
              <span className="font-ibm-mono text-[10px] font-bold text-[#555] tracking-[2px]">{h}</span>
            </div>
          ))}
        </div>

        {leaderboardData.map((row, i) => (
          <div
            key={row.rank}
            className={`flex w-full h-[56px] ${i < leaderboardData.length - 1 ? "border-b border-b-[#1D1D1D]" : ""} hover:bg-[#111111] transition-colors`}
          >
            <div className="flex items-center justify-center w-[80px] border-r border-r-[#2D2D2D]">
              <span className="font-grotesk text-[18px] font-bold" style={{ color: rankColor(row.rank) }}>
                {String(row.rank).padStart(2, "0")}
              </span>
            </div>
            <div className="flex items-center flex-[2] px-[24px] border-r border-r-[#2D2D2D]">
              <span className="font-ibm-mono text-[12px] text-[#F5F5F0] tracking-[1px]">{row.address}</span>
            </div>
            <div className="flex items-center flex-1 px-[24px] border-r border-r-[#2D2D2D]">
              <span className="font-ibm-mono text-[12px] text-[#888] tracking-[1px]">
                <span className="text-[#4ADE80]">{row.wins}</span> / <span className="text-[#FF5F57]">{row.losses}</span>
              </span>
            </div>
            <div className="flex items-center flex-1 px-[24px] border-r border-r-[#2D2D2D]">
              <span className="font-ibm-mono text-[12px] text-[#FFD600] font-bold tracking-[1px]">{row.winRate}</span>
            </div>
            <div className="flex items-center flex-1 px-[24px] border-r border-r-[#2D2D2D]">
              <span className="font-ibm-mono text-[12px] text-[#4ADE80] tracking-[1px]">{row.bestReturn}</span>
            </div>
            <div className="flex items-center flex-1 px-[24px]">
              <span className="font-ibm-mono text-[12px] text-[#F5F5F0] font-bold tracking-[1px]">{row.earnings}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col md:hidden w-full gap-[2px]">
        {leaderboardData.map((row) => (
          <div key={row.rank} className="flex flex-col gap-3 p-5 bg-[#111111] border border-[#2D2D2D]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-grotesk text-[24px] font-bold" style={{ color: rankColor(row.rank) }}>
                  {String(row.rank).padStart(2, "0")}
                </span>
                <span className="font-ibm-mono text-[11px] text-[#F5F5F0] tracking-[1px]">{row.address}</span>
              </div>
              <span className="font-ibm-mono text-[11px] text-[#FFD600] font-bold tracking-[1px]">{row.winRate}</span>
            </div>
            <div className="flex items-center gap-6">
              <span className="font-ibm-mono text-[10px] text-[#888] tracking-[1px]">W/L: <span className="text-[#4ADE80]">{row.wins}</span>/<span className="text-[#FF5F57]">{row.losses}</span></span>
              <span className="font-ibm-mono text-[10px] text-[#4ADE80] tracking-[1px]">BEST: {row.bestReturn}</span>
              <span className="font-ibm-mono text-[10px] text-[#F5F5F0] tracking-[1px]">{row.earnings}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="font-ibm-mono text-[11px] text-[#444444] tracking-[2px]">
          SNAPSHOTS STORED ON WALRUS // UPDATED WEEKLY
        </span>
        <span className="font-ibm-mono text-[11px] text-[#FFD600] tracking-[2px] cursor-pointer hover:underline">
          VIEW ALL &gt;
        </span>
      </div>
    </section>
  );
}
