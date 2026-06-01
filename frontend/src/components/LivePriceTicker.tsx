"use client";

import { useEffect, useState } from "react";
import { fetchAllPrices, formatPrice, type PriceData } from "@/lib/pyth";
import { GAME_ASSETS } from "@/lib/assetLogos";
import CryptoLogo from "@/components/CryptoLogo";

export default function LivePriceTicker() {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const p = await fetchAllPrices();
        if (mounted) {
          setPrevPrices((old) => {
            const prev: Record<string, number> = {};
            for (const [sym, data] of Object.entries(prices)) {
              prev[sym] = data.price;
            }
            return Object.keys(prev).length > 0 ? prev : old;
          });
          setPrices(p);
        }
      } catch (e) {
        console.error("Failed to fetch prices:", e);
      }
    }

    load();
    const interval = setInterval(load, 15000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const symbols = GAME_ASSETS.map((a) => a.symbol).filter((sym) => prices[sym]);
  if (symbols.length === 0) return null;

  const items = symbols.map((sym) => {
    const current = prices[sym].price;
    const prev = prevPrices[sym] || current;
    const change = prev > 0 ? ((current - prev) / prev) * 100 : 0;
    const isUp = change >= 0;
    return { sym, current, change, isUp };
  });

  const doubled = [...items, ...items];

  return (
    <div className="w-full bg-[#0D0D0D] border-y border-y-[#1D1D1D] overflow-hidden h-[44px]">
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track { animation: ticker-scroll 40s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
      `}</style>
      <div className="ticker-track flex items-center h-full whitespace-nowrap">
        {doubled.map((item, i) => (
          <div key={`${item.sym}-${i}`} className="flex items-center gap-2.5 px-6 shrink-0">
            <CryptoLogo symbol={item.sym} size={22} />
            <div
              className="w-[5px] h-[5px] shrink-0"
              style={{ backgroundColor: item.isUp ? "#4ADE80" : "#FF5F57" }}
            />
            <span className="font-ibm-mono text-[11px] font-bold text-[#F5F5F0] tracking-[1px]">
              {item.sym}
            </span>
            <span className="font-ibm-mono text-[11px] text-[#888] tracking-[0.5px]">
              {formatPrice(item.current)}
            </span>
            <span
              className="font-ibm-mono text-[10px] tracking-[0.5px]"
              style={{ color: item.isUp ? "#4ADE80" : "#FF5F57" }}
            >
              {item.isUp ? "▲" : "▼"} {Math.abs(item.change).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
