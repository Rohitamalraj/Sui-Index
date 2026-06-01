"use client";

import { useEffect, useState } from "react";
import GlitchText from "@/components/GlitchText";
import FloatingCryptoLogos from "@/components/FloatingCryptoLogos";
import { getAssetLogo } from "@/lib/assetLogos";

export default function Hero() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <section className="relative flex flex-col items-center w-full bg-[#0A0A0A] py-16 px-6 md:py-[100px] md:px-[120px] overflow-hidden">
      <FloatingCryptoLogos />
      <div className="relative z-10 flex flex-col items-center w-full">
      {/* Badge */}
      <div className="flex items-center justify-center gap-[8px] h-[32px] px-[12px] md:px-[16px] bg-[#1A1A1A] border-2 border-[#FFD600]">
        <div className="w-[8px] h-[8px] bg-[#FFD600] shrink-0" />
        <span className="font-ibm-mono text-[9px] md:text-[11px] font-bold text-[#FFD600] tracking-[1px] md:tracking-[2px] whitespace-nowrap">
          [LIVE] // PREDICTION DUELS ON SUI
        </span>
      </div>

      <div className="h-8 md:h-[32px]" />

      {/* Headline */}
      <h1 className="font-grotesk text-[clamp(32px,10vw,96px)] font-bold text-[#F5F5F0] tracking-[-1px] leading-none text-center w-full max-w-[1100px]">
        <GlitchText text="BUILD YOUR INDEX." speed={45} delay={100} />
        <br />
        <GlitchText text="CHALLENGE ANYONE." speed={45} delay={400} />
      </h1>
      <h1 className="font-grotesk text-[clamp(32px,10vw,96px)] font-bold text-[#FFD600] tracking-[-1px] leading-none text-center w-full max-w-[1100px]">
        <GlitchText text="WIN THE POOL." speed={45} delay={700} />
      </h1>

      <div className="h-8 md:h-[32px]" />

      {/* Subheading */}
      <p className="font-ibm-mono text-[13px] md:text-[15px] text-[#888888] tracking-[1px] leading-[1.6] text-center w-full max-w-[800px]">
        THE SOCIAL CRYPTO PREDICTION GAME ON SUI. BUILD WEIGHTED INDEXES
        <br />
        OF YOUR FAVORITE TOKENS. DUEL FOR SUI. MAY THE BEST INDEX WIN.
      </p>

      <div className="h-10 md:h-[48px]" />

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-[16px] w-full sm:w-auto">
        <a
          href="/duels"
          className="flex items-center justify-center w-full sm:w-[220px] h-[56px] bg-[#FFD600] hover:bg-[#e6c200] transition-colors no-underline"
        >
          <span className="font-grotesk text-[12px] font-bold text-[#0A0A0A] tracking-[2px]">
            START A DUEL
          </span>
        </a>
        <button
          onClick={() => document.getElementById("howitworks")?.scrollIntoView({ behavior: "smooth" })}
          className="flex items-center justify-center w-full sm:w-[200px] h-[56px] bg-[#0A0A0A] border-2 border-[#3D3D3D] hover:border-[#888888] transition-colors cursor-pointer"
        >
          <span className="font-ibm-mono text-[12px] text-[#888888] tracking-[2px]">
            HOW IT WORKS &gt;
          </span>
        </button>
      </div>

      <div className="h-6 md:h-[24px]" />

      <p className="font-ibm-mono text-[11px] text-[#555555] tracking-[2px] text-center">
        NO MIDDLEMAN // FULLY ON-CHAIN // POWERED BY TATUM + WALRUS
      </p>

      <div className="h-12 md:h-[64px]" />

      {/* Live Duel Preview SVG */}
      <div
        className="w-full max-w-[1100px] bg-[#0F0F0F] overflow-hidden"
        style={{ border: "2px solid #2D2D2D" }}
      >
        <DuelPreviewSVG mounted={mounted} />
      </div>
      </div>
    </section>
  );
}

/* ──────────────────── Live Duel Preview SVG ──────────────────── */

const creatorIndex = [
  { token: "BTC", weight: "40%", color: "#F7931A" },
  { token: "ETH", weight: "30%", color: "#627EEA" },
  { token: "SOL", weight: "20%", color: "#9945FF" },
  { token: "SUI", weight: "10%", color: "#4DA2FF" },
];

const opponentIndex = [
  { token: "SOL", weight: "35%", color: "#9945FF" },
  { token: "AVAX", weight: "25%", color: "#E84142" },
  { token: "LINK", weight: "25%", color: "#2A5ADA" },
  { token: "SUI", weight: "15%", color: "#4DA2FF" },
];

const tickerItems: { symbol: string; change: string; up: boolean }[] = [
  { symbol: "BTC", change: "+2.4%", up: true },
  { symbol: "ETH", change: "-0.8%", up: false },
  { symbol: "SOL", change: "+5.1%", up: true },
  { symbol: "SUI", change: "+3.7%", up: true },
  { symbol: "AVAX", change: "+1.2%", up: true },
  { symbol: "LINK", change: "-1.5%", up: false },
  { symbol: "DOGE", change: "+4.2%", up: true },
  { symbol: "BNB", change: "+1.8%", up: true },
];

function DuelPreviewSVG({ mounted }: { mounted: boolean }) {
  return (
    <>
      <style>{`
        @keyframes hero-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes hero-scan { 0%{transform:translateY(-480px)} 100%{transform:translateY(480px)} }
        @keyframes hero-pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
        @keyframes hero-ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-700px)} }
        .hero-cursor { animation: hero-blink 1.1s step-end infinite; }
        .hero-scan { animation: hero-scan 4s linear infinite; }
        .hero-pulse { animation: hero-pulse 2s ease-in-out infinite; }
        .hero-ticker-track { animation: hero-ticker 14s linear infinite; }
      `}</style>

      <svg
        viewBox="0 0 1100 480"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", width: "100%", height: "auto" }}
      >
        {/* BG */}
        <rect width="1100" height="480" fill="#0F0F0F" />
        <rect className="hero-scan" x="0" y="0" width="1100" height="6" fill="rgba(255,214,0,0.03)" />

        {/* Grid dots */}
        {Array.from({ length: 22 }, (_, c) =>
          Array.from({ length: 10 }, (_, r) => (
            <circle key={`d${c}-${r}`} cx={c * 50 + 25} cy={r * 50 + 25} r="1" fill="#1A1A1A" />
          ))
        )}

        {/* ── TOP BAR ── */}
        <rect x="0" y="0" width="1100" height="36" fill="#141414" />
        <line x1="0" y1="36" x2="1100" y2="36" stroke="#2D2D2D" strokeWidth="1" />
        <circle className="hero-pulse" cx="20" cy="18" r="4" fill="#4ADE80" />
        <text x="32" y="22" fontFamily="monospace" fontSize="9" fill="#FFD600" letterSpacing={2} fontWeight="700">LIVE DUEL</text>
        <text x="160" y="22" fontFamily="monospace" fontSize="8" fill="#555" letterSpacing={1}>ID: 0x7a3f...e912</text>
        <text x="380" y="22" fontFamily="monospace" fontSize="8" fill="#555" letterSpacing={1}>ENTRY: 10 SUI</text>
        <text x="560" y="22" fontFamily="monospace" fontSize="8" fill="#555" letterSpacing={1}>DURATION: 24H</text>
        <text x="780" y="22" fontFamily="monospace" fontSize="8" fill="#4ADE80" letterSpacing={1}>STATUS: ACTIVE</text>
        <text x="980" y="22" fontFamily="monospace" fontSize="8" fill="#444" letterSpacing={1}>12:47:32</text>

        {/* ── VS DIVIDER ── */}
        <line x1="550" y1="36" x2="550" y2="415" stroke="#2D2D2D" strokeWidth="1" strokeDasharray="4 2" />
        <rect x="525" y="210" width="50" height="28" fill="#FFD600" />
        <text x="537" y="228" fontFamily="monospace" fontSize="10" fill="#0A0A0A" fontWeight="700" letterSpacing={2}>VS</text>

        {/* ── CREATOR SIDE ── */}
        <text x="40" y="68" fontFamily="monospace" fontSize="10" fill="#FFD600" letterSpacing={2} fontWeight="700">PLAYER 1 // CREATOR</text>
        <text x="40" y="86" fontFamily="monospace" fontSize="8" fill="#555" letterSpacing={1}>0xAb5c...3F91</text>

        {/* Creator Index */}
        <rect x="40" y="100" width="470" height="180" fill="#111111" stroke="#2D2D2D" strokeWidth="1" />
        <rect x="40" y="100" width="470" height="28" fill="#161616" />
        <text x="52" y="118" fontFamily="monospace" fontSize="9" fill="#FFD600" letterSpacing={2} fontWeight="700">INDEX COMPOSITION</text>

        {creatorIndex.map((item, i) => {
          const y = 140 + i * 36;
          const barWidth = parseInt(item.weight) * 3.5;
          return (
            <g key={`c${i}`} style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateX(0)" : "translateX(-10px)",
              transition: `opacity 0.5s ease ${i * 0.12}s, transform 0.5s ease ${i * 0.12}s`,
            }}>
              <image href={getAssetLogo(item.token)} x="60" y={y} width="14" height="14" />
              <text x="82" y={y + 10} fontFamily="monospace" fontSize="9" fill="#F5F5F0" letterSpacing={1} fontWeight="700">{item.token}</text>
              <rect x="140" y={y + 2} width={barWidth} height="8" fill={item.color} opacity="0.6" />
              <text x={155 + barWidth} y={y + 10} fontFamily="monospace" fontSize="9" fill="#888" letterSpacing={1}>{item.weight}</text>
            </g>
          );
        })}

        {/* Creator return */}
        <rect x="40" y="290" width="470" height="36" fill="#0D1F0D" stroke="#4ADE80" strokeWidth="1" />
        <text x="52" y="312" fontFamily="monospace" fontSize="10" fill="#4ADE80" letterSpacing={1} fontWeight="700">RETURN: +5.24%</text>
        <text x="380" y="312" fontFamily="monospace" fontSize="9" fill="#4ADE80" letterSpacing={1}>▲ WINNING</text>

        {/* ── OPPONENT SIDE ── */}
        <text x="590" y="68" fontFamily="monospace" fontSize="10" fill="#FF6B35" letterSpacing={2} fontWeight="700">PLAYER 2 // CHALLENGER</text>
        <text x="590" y="86" fontFamily="monospace" fontSize="8" fill="#555" letterSpacing={1}>0x92Fd...8C12</text>

        {/* Opponent Index */}
        <rect x="590" y="100" width="470" height="180" fill="#111111" stroke="#2D2D2D" strokeWidth="1" />
        <rect x="590" y="100" width="470" height="28" fill="#161616" />
        <text x="602" y="118" fontFamily="monospace" fontSize="9" fill="#FF6B35" letterSpacing={2} fontWeight="700">INDEX COMPOSITION</text>

        {opponentIndex.map((item, i) => {
          const y = 140 + i * 36;
          const barWidth = parseInt(item.weight) * 3.5;
          return (
            <g key={`o${i}`} style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateX(0)" : "translateX(10px)",
              transition: `opacity 0.5s ease ${i * 0.12 + 0.3}s, transform 0.5s ease ${i * 0.12 + 0.3}s`,
            }}>
              <image href={getAssetLogo(item.token)} x="610" y={y} width="14" height="14" />
              <text x="632" y={y + 10} fontFamily="monospace" fontSize="9" fill="#F5F5F0" letterSpacing={1} fontWeight="700">{item.token}</text>
              <rect x="690" y={y + 2} width={barWidth} height="8" fill={item.color} opacity="0.6" />
              <text x={705 + barWidth} y={y + 10} fontFamily="monospace" fontSize="9" fill="#888" letterSpacing={1}>{item.weight}</text>
            </g>
          );
        })}

        {/* Opponent return */}
        <rect x="590" y="290" width="470" height="36" fill="#1F0D0D" stroke="#FF5F57" strokeWidth="1" />
        <text x="602" y="312" fontFamily="monospace" fontSize="10" fill="#FF5F57" letterSpacing={1} fontWeight="700">RETURN: +2.87%</text>
        <text x="930" y="312" fontFamily="monospace" fontSize="9" fill="#FF5F57" letterSpacing={1}>▼ LOSING</text>

        {/* ── POOL INFO BAR ── */}
        <rect x="0" y="340" width="1100" height="36" fill="#161616" />
        <line x1="0" y1="340" x2="1100" y2="340" stroke="#2D2D2D" strokeWidth="1" />
        <text x="40" y="362" fontFamily="monospace" fontSize="9" fill="#FFD600" letterSpacing={2} fontWeight="700">POOL</text>
        <text x="100" y="362" fontFamily="monospace" fontSize="9" fill="#F5F5F0" letterSpacing={1}>20 SUI</text>
        <text x="220" y="362" fontFamily="monospace" fontSize="9" fill="#555" letterSpacing={1}>FEE: 2%</text>
        <text x="340" y="362" fontFamily="monospace" fontSize="9" fill="#555" letterSpacing={1}>WINNER TAKES: 19.6 SUI</text>
        <text x="600" y="362" fontFamily="monospace" fontSize="9" fill="#555" letterSpacing={1}>PRICES BY PYTH // DATA VIA TATUM // STORED ON WALRUS</text>

        {/* ── TICKER ── */}
        <line x1="0" y1="390" x2="1100" y2="390" stroke="#2D2D2D" strokeWidth="1" />
        <rect x="0" y="391" width="1100" height="32" fill="#0F0F0F" />
        <clipPath id="tickerClip">
          <rect x="0" y="391" width="1100" height="32" />
        </clipPath>
        <g clipPath="url(#tickerClip)">
          <g className="hero-ticker-track">
            {[...tickerItems, ...tickerItems].map((item, i) => {
              const x = 16 + i * 108;
              const color = item.up ? "#4ADE80" : "#FF5F57";
              return (
                <g key={`t${i}`}>
                  <image href={getAssetLogo(item.symbol)} x={x} y="398" width="14" height="14" />
                  <text x={x + 20} y="407" fontFamily="monospace" fontSize="8" fill="#F5F5F0" letterSpacing={1} fontWeight="700">{item.symbol}</text>
                  <text x={x + 52} y="407" fontFamily="monospace" fontSize="8" fill={color} letterSpacing={1}>{item.change}</text>
                </g>
              );
            })}
          </g>
        </g>

        {/* Status bar */}
        <line x1="0" y1="423" x2="1100" y2="423" stroke="#222" strokeWidth="1" />
        <rect x="0" y="424" width="1100" height="56" fill="#0D0D0D" />
        <circle className="hero-pulse" cx="20" cy="450" r="4" fill="#4ADE80" />
        <text x="32" y="454" fontFamily="monospace" fontSize="8" fill="#555" letterSpacing={1}>CONNECTED TO SUI TESTNET VIA TATUM</text>
        <text x="400" y="454" fontFamily="monospace" fontSize="8" fill="#333" letterSpacing={1}>WALRUS EPOCH: 142</text>
        <text x="600" y="454" fontFamily="monospace" fontSize="8" fill="#333" letterSpacing={1}>PYTH: REAL-TIME</text>
        <text x="800" y="454" fontFamily="monospace" fontSize="8" fill="#333" letterSpacing={1}>BLOCK: 14,287,391</text>
        <text x="1000" y="454" fontFamily="monospace" fontSize="8" fill="#333" letterSpacing={1}>v1.0</text>

        {/* Corner accents */}
        <rect x="0" y="424" width="6" height="6" fill="#FFD600" opacity="0.5" />
        <rect x="1094" y="424" width="6" height="6" fill="#FF6B35" opacity="0.4" />
      </svg>
    </>
  );
}
