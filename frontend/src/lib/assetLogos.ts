/**
 * Crypto asset logos via CDN — no local downloads.
 * Primary: CoinGecko static assets. Fallback: cryptocurrency-icons on jsDelivr.
 */

const CG = "https://assets.coingecko.com/coins/images";

/** CoinGecko small icon URLs for all game assets */
export const ASSET_LOGOS: Record<string, string> = {
  BTC:  `${CG}/1/small/bitcoin.png`,
  ETH:  `${CG}/279/small/ethereum.png`,
  SOL:  `${CG}/4128/small/solana.png`,
  SUI:  `${CG}/26375/small/sui_asset.jpeg`,
  BNB:  `${CG}/825/small/bnb-icon2_2x.png`,
  XRP:  `${CG}/44/small/xrp-symbol-white-128.png`,
  DOGE: `${CG}/5/small/dogecoin.png`,
  ADA:  `${CG}/975/small/cardano.png`,
  AVAX: `${CG}/12559/small/Avalanche_Circle_RedWhite_Trans.png`,
  LINK: `${CG}/877/small/chainlink-new-logo.png`,
  MATIC:`${CG}/4713/small/matic-token-icon.png`,
  DOT:  `${CG}/12171/small/polkadot.png`,
  UNI:  `${CG}/12504/small/uniswap-logo.png`,
  LTC:  `${CG}/2/small/litecoin.png`,
  BCH:  `${CG}/780/small/bitcoin-cash-circle.png`,
  ALGO: `${CG}/4380/small/download.png`,
  ATOM: `${CG}/1481/small/cosmos_hub.png`,
  APT:  `${CG}/26455/small/aptos_round.png`,
  ARB:  `${CG}/16547/small/photo_2023-03-29_21.47.00.jpeg`,
  FIL:  `${CG}/12817/small/filecoin.png`,
  OP:   `${CG}/25244/small/Optimism.png`,
  USDC: `${CG}/6319/small/usdc.png`,
  USDT: `${CG}/325/small/Tether.png`,
  DAI:  `${CG}/9956/small/Badge_Dai.png`,
};

/** jsDelivr slug (lowercase full name) for fallback icons */
const CRYPTOICON_SLUG: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  SUI: "sui",
  BNB: "binance-coin",
  XRP: "ripple",
  DOGE: "dogecoin",
  ADA: "cardano",
  AVAX: "avalanche",
  LINK: "chainlink",
  MATIC: "polygon",
  DOT: "polkadot",
  UNI: "uniswap",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  ALGO: "algorand",
  ATOM: "cosmos",
  APT: "aptos",
  ARB: "arbitrum",
  FIL: "filecoin",
  OP: "optimism",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
};

export interface AssetMeta {
  symbol: string;
  name: string;
  color: string;
}

/** Tokens available in the index builder (order = display order) */
export const GAME_ASSETS: AssetMeta[] = [
  { symbol: "BTC",   name: "Bitcoin",      color: "#F7931A" },
  { symbol: "ETH",   name: "Ethereum",     color: "#627EEA" },
  { symbol: "BNB",   name: "BNB",          color: "#F0B90B" },
  { symbol: "SOL",   name: "Solana",       color: "#9945FF" },
  { symbol: "XRP",   name: "XRP",          color: "#346AA9" },
  { symbol: "SUI",   name: "Sui",          color: "#4DA2FF" },
  { symbol: "DOGE",  name: "Dogecoin",     color: "#C2A633" },
  { symbol: "ADA",   name: "Cardano",      color: "#0033AD" },
  { symbol: "AVAX",  name: "Avalanche",    color: "#E84142" },
  { symbol: "LINK",  name: "Chainlink",    color: "#2A5ADA" },
  { symbol: "MATIC", name: "Polygon",      color: "#8247E5" },
  { symbol: "DOT",   name: "Polkadot",     color: "#E6007A" },
  { symbol: "UNI",   name: "Uniswap",      color: "#FF007A" },
  { symbol: "LTC",   name: "Litecoin",     color: "#BFBBBB" },
  { symbol: "BCH",   name: "Bitcoin Cash", color: "#8DC351" },
  { symbol: "ALGO",  name: "Algorand",     color: "#00D1D1" },
  { symbol: "ATOM",  name: "Cosmos",       color: "#6F7390" },
  { symbol: "APT",   name: "Aptos",        color: "#2EE7A5" },
  { symbol: "ARB",   name: "Arbitrum",     color: "#28A0F0" },
  { symbol: "FIL",   name: "Filecoin",     color: "#42C1CA" },
];

export function getAssetMeta(symbol: string): AssetMeta | undefined {
  return GAME_ASSETS.find((a) => a.symbol === symbol);
}

export function getAssetLogo(symbol: string): string {
  return ASSET_LOGOS[symbol] ?? "";
}

export function getAssetLogoFallback(symbol: string, size: 16 | 32 | 64 | 128 = 32): string {
  const slug = CRYPTOICON_SLUG[symbol];
  if (!slug) return "";
  return `https://cdn.jsdelivr.net/gh/ErikThiart/cryptocurrency-icons@master/${size}/${slug}.png`;
}

export function getAssetColor(symbol: string): string {
  return getAssetMeta(symbol)?.color ?? "#888888";
}
