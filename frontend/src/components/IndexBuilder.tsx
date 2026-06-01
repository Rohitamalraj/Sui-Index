"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAllPrices, formatPrice, type PriceData } from "@/lib/pyth";
import { GAME_ASSETS } from "@/lib/assetLogos";
import CryptoLogo from "@/components/CryptoLogo";

interface IndexAsset {
  symbol: string;
  weight: number;
}

interface IndexBuilderProps {
  onSubmit?: (assets: IndexAsset[]) => void;
  onClose?: () => void;
}

export default function IndexBuilder({ onSubmit, onClose }: IndexBuilderProps) {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<IndexAsset[]>([]);

  /* ── Fetch live prices ── */
  useEffect(() => {
    let mounted = true;
    async function load() {
      console.log('[IndexBuilder] Fetching prices...');
      try {
        const p = await fetchAllPrices();
        console.log('[IndexBuilder] Prices loaded:', Object.keys(p).length, 'assets', p);
        if (mounted) setPrices(p);
      } catch (e) {
        console.error('[IndexBuilder] fetchAllPrices threw (should not happen):', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  /* ── Toggle asset selection ── */
  const toggleAsset = useCallback((symbol: string) => {
    setSelected((prev) => {
      const exists = prev.find((a) => a.symbol === symbol);
      if (exists) {
        return prev.filter((a) => a.symbol !== symbol);
      }
      if (prev.length >= 6) return prev; // max 6 assets
      return [...prev, { symbol, weight: 0 }];
    });
  }, []);

  /* ── Update weight ── */
  const updateWeight = useCallback((symbol: string, weight: number) => {
    setSelected((prev) =>
      prev.map((a) => (a.symbol === symbol ? { ...a, weight } : a))
    );
  }, []);

  /* ── Auto-distribute weights equally ── */
  const distributeEvenly = useCallback(() => {
    if (selected.length === 0) return;
    const w = Math.floor(100 / selected.length);
    const remainder = 100 - w * selected.length;
    setSelected((prev) =>
      prev.map((a, i) => ({ ...a, weight: w + (i === 0 ? remainder : 0) }))
    );
  }, [selected.length]);

  const totalWeight = selected.reduce((sum, a) => sum + a.weight, 0);
  const isValid = selected.length >= 2 && totalWeight === 100;

  return (
    <div className="flex flex-col w-full gap-[2px]">
      {/* Header */}
      <div className="flex items-center justify-between p-6 md:p-8 bg-[#111111] border border-[#2D2D2D]">
        <div className="flex flex-col gap-1">
          <span className="font-ibm-mono text-[10px] font-bold text-[#FFD600] tracking-[2px]">
            [INDEX BUILDER]
          </span>
          <h3 className="font-grotesk text-[20px] md:text-[24px] font-bold text-[#F5F5F0] tracking-[-1px]">
            BUILD YOUR INDEX
          </h3>
          <p className="font-ibm-mono text-[11px] text-[#555] tracking-[1px]">
            SELECT 2-6 TOKENS. SET WEIGHTS. TOTAL MUST EQUAL 100%.
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center justify-center w-[36px] h-[36px] bg-[#1A1A1A] border border-[#2D2D2D] hover:border-[#888] transition-colors cursor-pointer"
          >
            <span className="font-grotesk text-[16px] text-[#888]">×</span>
          </button>
        )}
      </div>

      {/* Token Grid */}
      <div className="p-6 md:p-8 bg-[#0D0D0D] border border-[#2D2D2D]">
        <span className="font-ibm-mono text-[10px] font-bold text-[#555] tracking-[2px] mb-4 block">
          SELECT TOKENS ({selected.length}/6)
        </span>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-[2px] mt-3">
          {GAME_ASSETS.map((token) => {
            const isSelected = selected.some((a) => a.symbol === token.symbol);
            const price = prices[token.symbol];
            return (
              <button
                key={token.symbol}
                onClick={() => toggleAsset(token.symbol)}
                className="flex flex-col items-center gap-2 p-4 transition-all cursor-pointer border-none"
                style={{
                  backgroundColor: isSelected ? `${token.color}15` : "#111111",
                  border: isSelected ? `2px solid ${token.color}` : "2px solid #2D2D2D",
                }}
              >
                <CryptoLogo symbol={token.symbol} size={36} />
                <span className="font-grotesk text-[11px] font-bold text-[#F5F5F0] tracking-[0.5px]">
                  {token.symbol}
                </span>
                <span className="font-ibm-mono text-[9px] text-[#555] tracking-[0.5px]">
                  {loading ? "..." : price ? formatPrice(price.price) : "N/A"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Weight Allocation */}
      {selected.length > 0 && (
        <div className="p-6 md:p-8 bg-[#111111] border border-[#2D2D2D]">
          <div className="flex items-center justify-between mb-4">
            <span className="font-ibm-mono text-[10px] font-bold text-[#FFD600] tracking-[2px]">
              SET WEIGHTS
            </span>
            <button
              onClick={distributeEvenly}
              className="flex items-center justify-center h-[28px] px-[12px] bg-[#1A1A1A] border border-[#FFD600] cursor-pointer transition-colors hover:bg-[#FFD60015]"
            >
              <span className="font-ibm-mono text-[10px] font-bold text-[#FFD600] tracking-[1px]">
                DISTRIBUTE EVENLY
              </span>
            </button>
          </div>

          <div className="flex flex-col gap-[2px]">
            {selected.map((asset) => {
              const token = GAME_ASSETS.find((t) => t.symbol === asset.symbol)!;
              return (
                <div
                  key={asset.symbol}
                  className="flex items-center gap-4 p-4 bg-[#0D0D0D] border border-[#1D1D1D]"
                >
                  <CryptoLogo symbol={asset.symbol} size={28} />

                  <span className="font-grotesk text-[13px] font-bold text-[#F5F5F0] tracking-[0.5px] w-[60px]">
                    {asset.symbol}
                  </span>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={asset.weight}
                    onChange={(e) => updateWeight(asset.symbol, Number(e.target.value))}
                    className="flex-1 h-[4px] appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${token.color} ${asset.weight}%, #2D2D2D ${asset.weight}%)`,
                      accentColor: token.color,
                    }}
                  />

                  <span className="font-ibm-mono text-[14px] font-bold tracking-[1px] w-[48px] text-right" style={{ color: token.color }}>
                    {asset.weight}%
                  </span>

                  <button
                    onClick={() => toggleAsset(asset.symbol)}
                    className="flex items-center justify-center w-[24px] h-[24px] bg-transparent border border-[#2D2D2D] hover:border-[#FF5F57] transition-colors cursor-pointer shrink-0"
                  >
                    <span className="font-grotesk text-[12px] text-[#555] hover:text-[#FF5F57]">×</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Visual bar chart */}
          <div className="flex w-full h-[8px] mt-4 gap-[1px]">
            {selected.map((asset) => {
              const token = GAME_ASSETS.find((t) => t.symbol === asset.symbol)!;
              return (
                <div
                  key={asset.symbol}
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${asset.weight}%`,
                    backgroundColor: token.color,
                    opacity: asset.weight > 0 ? 0.8 : 0.1,
                  }}
                />
              );
            })}
            {totalWeight < 100 && (
              <div
                className="h-full bg-[#2D2D2D]"
                style={{ width: `${100 - totalWeight}%` }}
              />
            )}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between mt-4 p-4 border" style={{
            borderColor: totalWeight === 100 ? "#4ADE80" : totalWeight > 100 ? "#FF5F57" : "#FFD600",
            backgroundColor: totalWeight === 100 ? "#4ADE8010" : totalWeight > 100 ? "#FF5F5710" : "#FFD60010",
          }}>
            <span className="font-ibm-mono text-[11px] text-[#888] tracking-[2px]">TOTAL WEIGHT</span>
            <span className="font-grotesk text-[20px] font-bold tracking-[-1px]" style={{
              color: totalWeight === 100 ? "#4ADE80" : totalWeight > 100 ? "#FF5F57" : "#FFD600",
            }}>
              {totalWeight}%
            </span>
          </div>
        </div>
      )}

      {/* Submit */}
      {selected.length >= 2 && (
        <div className="p-6 md:p-8 bg-[#0A0A0A] border border-[#2D2D2D]">
          <button
            onClick={() => isValid && onSubmit?.(selected)}
            disabled={!isValid}
            className="flex items-center justify-center w-full h-[56px] transition-colors border-none cursor-pointer"
            style={{
              backgroundColor: isValid ? "#FFD600" : "#2D2D2D",
              cursor: isValid ? "pointer" : "not-allowed",
            }}
          >
            <span className="font-grotesk text-[12px] font-bold tracking-[2px]" style={{
              color: isValid ? "#0A0A0A" : "#555",
            }}>
              {!isValid && totalWeight !== 100
                ? `ADJUST WEIGHTS (${totalWeight}% / 100%)`
                : !isValid && selected.length < 2
                ? "SELECT AT LEAST 2 TOKENS"
                : "LOCK INDEX & PROCEED →"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
