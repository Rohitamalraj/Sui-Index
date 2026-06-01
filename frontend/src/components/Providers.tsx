"use client";

import { SuiClientProvider, WalletProvider, createNetworkConfig } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@mysten/dapp-kit/dist/index.css";

// Browser RPC uses the public Sui fullnode — it supports CORS and signed
// transaction submission directly from the browser. Tatum's gateway is used
// server-side (backend) where header-based auth works; its query-param auth
// fails CORS for executeTransactionBlock POSTs from the browser.
// Override via NEXT_PUBLIC_SUI_RPC_TESTNET / _MAINNET if you have a CORS-enabled RPC.
const RPC_URLS: Record<"testnet" | "mainnet", string> = {
  testnet: process.env.NEXT_PUBLIC_SUI_RPC_TESTNET || "https://fullnode.testnet.sui.io:443",
  mainnet: process.env.NEXT_PUBLIC_SUI_RPC_MAINNET || "https://fullnode.mainnet.sui.io:443",
};

const { networkConfig } = createNetworkConfig({
  testnet: { url: RPC_URLS.testnet, network: "testnet" },
  mainnet: { url: RPC_URLS.mainnet, network: "mainnet" },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 2,
    },
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
