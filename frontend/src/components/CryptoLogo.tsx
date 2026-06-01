"use client";

import { useState } from "react";
import {
  getAssetLogo,
  getAssetLogoFallback,
  getAssetColor,
} from "@/lib/assetLogos";

interface CryptoLogoProps {
  symbol: string;
  size?: number;
  className?: string;
  /** Show colored letter fallback if all CDN sources fail */
  showLetterFallback?: boolean;
}

/**
 * Renders a crypto logo from CoinGecko CDN with jsDelivr fallback.
 */
export default function CryptoLogo({
  symbol,
  size = 32,
  className = "",
  showLetterFallback = true,
}: CryptoLogoProps) {
  const primary = getAssetLogo(symbol);
  const [src, setSrc] = useState(primary || getAssetLogoFallback(symbol));
  const [exhausted, setExhausted] = useState(!primary && !getAssetLogoFallback(symbol));

  const color = getAssetColor(symbol);

  if (exhausted || !src) {
    if (!showLetterFallback) return null;
    return (
      <div
        className={`flex items-center justify-center shrink-0 overflow-hidden ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: `${color}25`,
          border: `1px solid ${color}40`,
        }}
        title={symbol}
      >
        <span
          className="font-ibm-mono font-bold"
          style={{ color, fontSize: Math.max(7, Math.round(size * 0.28)) }}
        >
          {symbol.slice(0, 3)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${symbol} logo`}
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: "#1A1A1A",
      }}
      loading="lazy"
      decoding="async"
      onError={() => {
        const fallback = getAssetLogoFallback(symbol);
        if (fallback && src !== fallback) {
          setSrc(fallback);
          return;
        }
        setExhausted(true);
      }}
    />
  );
}
