"use client";

import { useState, useRef } from "react";
import { storeBlob, getBlobUrl } from "@/lib/walrus";

interface IndexAsset {
  symbol: string;
  weight: number;
  color?: string;
}

interface IndexCardShareProps {
  playerAddress: string;
  assets: IndexAsset[];
  returnPct?: number;
  isWinner?: boolean;
  duelId?: string;
  onClose?: () => void;
}

const TOKEN_COLORS: Record<string, string> = {
  BTC: "#F7931A", ETH: "#627EEA", SOL: "#9945FF", SUI: "#4DA2FF",
  AVAX: "#E84142", LINK: "#2A5ADA", DOT: "#E6007A", DOGE: "#C2A633",
  UNI: "#FF007A", MATIC: "#8247E5", ADA: "#0033AD", ATOM: "#2E3148",
};

export default function IndexCardShare({
  playerAddress,
  assets,
  returnPct,
  isWinner,
  duelId,
  onClose,
}: IndexCardShareProps) {
  const [blobId, setBlobId] = useState<string | null>(null);
  const [storing, setStoring] = useState(false);
  const [copied, setCopied] = useState(false);

  const shortAddr = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "—";

  const cardData = {
    playerAddress,
    assets,
    returnPct,
    isWinner,
    duelId,
    generatedAt: Date.now(),
    platform: "sui-index",
  };

  const handleStoreOnWalrus = async () => {
    setStoring(true);
    try {
      const id = await storeBlob(JSON.stringify(cardData));
      setBlobId(id);
    } catch (err) {
      console.error("Failed to store card on Walrus:", err);
    } finally {
      setStoring(false);
    }
  };

  const handleCopyShare = async () => {
    const text = buildShareText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const buildShareText = () => {
    const indexStr = assets.map((a) => `${a.symbol} ${a.weight}%`).join(" | ");
    const returnStr = returnPct !== undefined
      ? (returnPct >= 0 ? `+${returnPct.toFixed(2)}%` : `${returnPct.toFixed(2)}%`)
      : "";
    const winnerStr = isWinner ? "🏆 WON" : returnPct !== undefined ? "⚔ COMPETED" : "";

    return [
      `${winnerStr} on Sui-Index`,
      ``,
      `My index: ${indexStr}`,
      returnStr ? `Return: ${returnStr}` : "",
      ``,
      `Build. Duel. Win. 🎯`,
      `@Tatum_io @WalrusFoundation @SuiNetwork`,
      blobId ? `\nResult stored on Walrus: ${getBlobUrl(blobId)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const hasReturn = returnPct !== undefined;

  return (
    <div className="flex flex-col gap-[2px]">
      {/* ── The card itself ── */}
      <div
        className="relative w-full bg-[#0D0D0D] overflow-hidden"
        style={{ border: `2px solid ${isWinner ? "#FFD600" : "#2D2D2D"}` }}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ backgroundColor: isWinner ? "#FFD60015" : "#111111" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-[8px] h-[8px]"
              style={{ backgroundColor: isWinner ? "#FFD600" : "#555" }}
            />
            <span className="font-ibm-mono text-[9px] font-bold tracking-[2px]" style={{ color: isWinner ? "#FFD600" : "#888" }}>
              SUI-INDEX
            </span>
          </div>
          <span className="font-ibm-mono text-[9px] text-[#555] tracking-[1px]">
            POWERED BY WALRUS + TATUM
          </span>
        </div>

        {/* Player */}
        <div className="px-5 pt-4 pb-2">
          <span className="font-ibm-mono text-[10px] text-[#555] tracking-[2px]">PLAYER</span>
          <div className="font-grotesk text-[18px] font-bold text-[#F5F5F0] tracking-[-0.5px] mt-1">
            {shortAddr(playerAddress)}
          </div>
        </div>

        {/* Index composition */}
        <div className="px-5 py-3">
          <span className="font-ibm-mono text-[10px] text-[#555] tracking-[2px] mb-3 block">INDEX</span>

          {/* Bar chart */}
          <div className="flex w-full h-[12px] gap-[1px] mb-3">
            {assets.map((a) => (
              <div
                key={a.symbol}
                className="h-full"
                style={{
                  width: `${a.weight}%`,
                  backgroundColor: a.color || TOKEN_COLORS[a.symbol] || "#888",
                }}
              />
            ))}
          </div>

          {/* Asset labels */}
          <div className="flex flex-wrap gap-2">
            {assets.map((a) => {
              const color = a.color || TOKEN_COLORS[a.symbol] || "#888";
              return (
                <div
                  key={a.symbol}
                  className="flex items-center gap-[6px] px-2 py-[4px]"
                  style={{ backgroundColor: `${color}15`, border: `1px solid ${color}40` }}
                >
                  <span className="font-grotesk text-[11px] font-bold" style={{ color }}>
                    {a.symbol}
                  </span>
                  <span className="font-ibm-mono text-[10px] text-[#888]">{a.weight}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Result (if available) */}
        {hasReturn && (
          <div
            className="flex items-center justify-between px-5 py-4 mx-5 mb-4 border"
            style={{
              borderColor: isWinner ? "#FFD600" : returnPct! >= 0 ? "#4ADE80" : "#FF5F57",
              backgroundColor: isWinner ? "#FFD60008" : returnPct! >= 0 ? "#4ADE8008" : "#FF5F5708",
            }}
          >
            <div className="flex flex-col gap-1">
              <span className="font-ibm-mono text-[9px] text-[#555] tracking-[2px]">RETURN</span>
              <span
                className="font-grotesk text-[28px] font-bold tracking-[-1px]"
                style={{ color: isWinner ? "#FFD600" : returnPct! >= 0 ? "#4ADE80" : "#FF5F57" }}
              >
                {returnPct! >= 0 ? "+" : ""}{returnPct!.toFixed(2)}%
              </span>
            </div>
            {isWinner && (
              <div className="flex flex-col items-center gap-1">
                <span className="font-grotesk text-[32px]">🏆</span>
                <span className="font-ibm-mono text-[9px] font-bold text-[#FFD600] tracking-[2px]">WINNER</span>
              </div>
            )}
          </div>
        )}

        {/* Walrus badge */}
        {blobId && (
          <div className="px-5 pb-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-[#4ADE8010] border border-[#4ADE8030]">
              <div className="w-[6px] h-[6px] bg-[#4ADE80]" />
              <span className="font-ibm-mono text-[9px] text-[#4ADE80] tracking-[1px]">
                STORED ON WALRUS // {blobId.slice(0, 16)}...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-[2px]">
        {!blobId ? (
          <button
            onClick={handleStoreOnWalrus}
            disabled={storing}
            className="flex items-center justify-center flex-1 h-[44px] transition-colors border-none cursor-pointer"
            style={{ backgroundColor: storing ? "#1A1A1A" : "#4ADE80" }}
          >
            {storing ? (
              <div className="flex items-center gap-2">
                <div className="w-[14px] h-[14px] border-2 border-[#4ADE80] border-t-transparent animate-spin" />
                <span className="font-ibm-mono text-[10px] text-[#4ADE80] tracking-[2px]">STORING...</span>
              </div>
            ) : (
              <span className="font-grotesk text-[10px] font-bold text-[#0A0A0A] tracking-[2px]">
                STORE ON WALRUS
              </span>
            )}
          </button>
        ) : (
          <a
            href={getBlobUrl(blobId)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center flex-1 h-[44px] bg-[#4ADE8020] border border-[#4ADE8040] hover:bg-[#4ADE8030] transition-colors no-underline"
          >
            <span className="font-ibm-mono text-[10px] text-[#4ADE80] tracking-[2px]">VIEW ON WALRUS →</span>
          </a>
        )}

        <button
          onClick={handleCopyShare}
          className="flex items-center justify-center flex-1 h-[44px] bg-[#1A1A1A] border border-[#2D2D2D] hover:border-[#FFD600] transition-colors cursor-pointer"
        >
          <span
            className="font-ibm-mono text-[10px] tracking-[2px] transition-colors"
            style={{ color: copied ? "#FFD600" : "#888" }}
          >
            {copied ? "COPIED ✓" : "COPY & SHARE"}
          </span>
        </button>

        {/* Twitter/X share */}
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(buildShareText())}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-[44px] h-[44px] bg-[#1A1A1A] border border-[#2D2D2D] hover:border-[#1DA1F2] transition-colors no-underline"
          title="Share on X"
        >
          <span className="font-grotesk text-[13px] text-[#888]">𝕏</span>
        </a>

        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center justify-center w-[44px] h-[44px] bg-[#1A1A1A] border border-[#2D2D2D] hover:border-[#888] transition-colors cursor-pointer"
          >
            <span className="text-[#555] text-[16px]">×</span>
          </button>
        )}
      </div>
    </div>
  );
}
