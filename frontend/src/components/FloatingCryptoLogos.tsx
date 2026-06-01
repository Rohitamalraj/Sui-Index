"use client";

import CryptoLogo from "@/components/CryptoLogo";
import { getAssetColor } from "@/lib/assetLogos";

/** Coins that drift across the hero — paths inspired by CollabCursors */
const FLOATING_COINS = [
  {
    symbol: "BTC",
    size: 56,
    opacity: 0.2,
    animName: "float-coin-btc",
    duration: "22s",
    keyframes: `@keyframes float-coin-btc {
      0%   { transform: translate(6vw, 12vh) rotate(-6deg); }
      20%  { transform: translate(14vw, 22vh) rotate(4deg); }
      45%  { transform: translate(10vw, 18vh) rotate(-2deg); }
      70%  { transform: translate(18vw, 28vh) rotate(6deg); }
      100% { transform: translate(6vw, 12vh) rotate(-6deg); }
    }`,
  },
  {
    symbol: "ETH",
    size: 48,
    opacity: 0.18,
    animName: "float-coin-eth",
    duration: "26s",
    keyframes: `@keyframes float-coin-eth {
      0%   { transform: translate(78vw, 8vh) rotate(8deg); }
      25%  { transform: translate(72vw, 20vh) rotate(-4deg); }
      50%  { transform: translate(82vw, 14vh) rotate(5deg); }
      75%  { transform: translate(76vw, 26vh) rotate(-8deg); }
      100% { transform: translate(78vw, 8vh) rotate(8deg); }
    }`,
  },
  {
    symbol: "SOL",
    size: 44,
    opacity: 0.22,
    animName: "float-coin-sol",
    duration: "20s",
    keyframes: `@keyframes float-coin-sol {
      0%   { transform: translate(82vw, 52vh) rotate(5deg); }
      30%  { transform: translate(88vw, 42vh) rotate(-6deg); }
      55%  { transform: translate(80vw, 48vh) rotate(3deg); }
      80%  { transform: translate(86vw, 58vh) rotate(-4deg); }
      100% { transform: translate(82vw, 52vh) rotate(5deg); }
    }`,
  },
  {
    symbol: "SUI",
    size: 50,
    opacity: 0.24,
    animName: "float-coin-sui",
    duration: "24s",
    keyframes: `@keyframes float-coin-sui {
      0%   { transform: translate(4vw, 55vh) rotate(-5deg); }
      22%  { transform: translate(12vw, 48vh) rotate(7deg); }
      48%  { transform: translate(8vw, 62vh) rotate(-3deg); }
      72%  { transform: translate(16vw, 52vh) rotate(4deg); }
      100% { transform: translate(4vw, 55vh) rotate(-5deg); }
    }`,
  },
  {
    symbol: "AVAX",
    size: 40,
    opacity: 0.16,
    animName: "float-coin-avax",
    duration: "28s",
    keyframes: `@keyframes float-coin-avax {
      0%   { transform: translate(22vw, 68vh) rotate(6deg); }
      35%  { transform: translate(28vw, 58vh) rotate(-5deg); }
      60%  { transform: translate(18vw, 64vh) rotate(4deg); }
      85%  { transform: translate(26vw, 72vh) rotate(-7deg); }
      100% { transform: translate(22vw, 68vh) rotate(6deg); }
    }`,
  },
  {
    symbol: "LINK",
    size: 42,
    opacity: 0.17,
    animName: "float-coin-link",
    duration: "30s",
    keyframes: `@keyframes float-coin-link {
      0%   { transform: translate(68vw, 62vh) rotate(-4deg); }
      18%  { transform: translate(62vw, 52vh) rotate(8deg); }
      42%  { transform: translate(74vw, 56vh) rotate(-6deg); }
      68%  { transform: translate(66vw, 68vh) rotate(5deg); }
      100% { transform: translate(68vw, 62vh) rotate(-4deg); }
    }`,
  },
  {
    symbol: "DOGE",
    size: 38,
    opacity: 0.15,
    animName: "float-coin-doge",
    duration: "19s",
    keyframes: `@keyframes float-coin-doge {
      0%   { transform: translate(48vw, 6vh) rotate(4deg); }
      28%  { transform: translate(52vw, 14vh) rotate(-8deg); }
      55%  { transform: translate(44vw, 10vh) rotate(6deg); }
      82%  { transform: translate(50vw, 18vh) rotate(-3deg); }
      100% { transform: translate(48vw, 6vh) rotate(4deg); }
    }`,
  },
  {
    symbol: "BNB",
    size: 46,
    opacity: 0.19,
    animName: "float-coin-bnb",
    duration: "25s",
    keyframes: `@keyframes float-coin-bnb {
      0%   { transform: translate(38vw, 38vh) rotate(-7deg); }
      25%  { transform: translate(44vw, 32vh) rotate(5deg); }
      50%  { transform: translate(36vw, 42vh) rotate(-4deg); }
      75%  { transform: translate(42vw, 36vh) rotate(8deg); }
      100% { transform: translate(38vw, 38vh) rotate(-7deg); }
    }`,
  },
];

/**
 * Ambient floating crypto logos on the landing hero (like template CollabCursors).
 */
export default function FloatingCryptoLogos() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none hidden md:block"
      style={{ zIndex: 0 }}
      aria-hidden
    >
      <style>{FLOATING_COINS.map((c) => c.keyframes).join("\n")}</style>

      {FLOATING_COINS.map((coin) => {
        const color = getAssetColor(coin.symbol);
        return (
          <div
            key={coin.symbol}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              animation: `${coin.animName} ${coin.duration} cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite`,
              willChange: "transform",
              opacity: coin.opacity,
            }}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: coin.size + 16,
                height: coin.size + 16,
                backgroundColor: `${color}12`,
                border: `1px solid ${color}35`,
                boxShadow: `0 8px 32px ${color}20, 0 0 0 1px rgba(0,0,0,0.4)`,
                backdropFilter: "blur(4px)",
              }}
            >
              <CryptoLogo symbol={coin.symbol} size={coin.size} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
