/**
 * Tatum RPC + Data API client for Sui-Index.
 * All Sui blockchain interactions flow through Tatum's gateway.
 * 
 * @mysten/sui SDK v2 uses CoreClient.
 * For the frontend, we primarily use fetch-based RPC calls through Tatum.
 */

// ============ Configuration ============

const TATUM_API_KEY = process.env.NEXT_PUBLIC_TATUM_API_KEY || '';
const SUI_NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet') as 'testnet' | 'mainnet' | 'devnet';

const TATUM_RPC_URLS: Record<string, string> = {
  mainnet: 'https://sui-mainnet.gateway.tatum.io',
  testnet: 'https://sui-testnet.gateway.tatum.io',
  devnet: 'https://sui-devnet.gateway.tatum.io',
};

const PUBLIC_RPC_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
};

// Optional CORS-enabled RPC override (e.g. a proxy you control). Matches Providers.tsx.
const RPC_OVERRIDE: Record<string, string | undefined> = {
  testnet: process.env.NEXT_PUBLIC_SUI_RPC_TESTNET,
  mainnet: process.env.NEXT_PUBLIC_SUI_RPC_MAINNET,
};

/**
 * Get the Sui RPC URL for browser use.
 *
 * The Tatum gateway authenticates via an x-api-key header, which triggers a
 * CORS preflight the gateway does not satisfy from the browser — so reads and
 * (especially) transaction submission fail with "Failed to fetch". For browser
 * use we default to the public fullnode (CORS-enabled). Tatum is still used
 * server-side in the backend. Override with NEXT_PUBLIC_SUI_RPC_* if you have a
 * CORS-enabled endpoint.
 */
export function getTatumRpcUrl(): string {
  return RPC_OVERRIDE[SUI_NETWORK] || PUBLIC_RPC_URLS[SUI_NETWORK];
}

/** True when the active RPC URL is the Tatum gateway (needs the API key header). */
function isTatumUrl(url: string): boolean {
  return url.includes('gateway.tatum.io');
}

/**
 * Make a JSON-RPC call to the Sui fullnode (public by default, CORS-safe).
 */
export async function suiRpcCall(method: string, params: unknown[] = []): Promise<unknown> {
  const url = getTatumRpcUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (TATUM_API_KEY && isTatumUrl(url)) {
    headers['x-api-key'] = TATUM_API_KEY;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`RPC Error: ${data.error.message}`);
  }
  return data.result;
}

// ============ Data API Helpers ============

/**
 * Fetch wallet SUI balance using Sui RPC via Tatum.
 */
export async function getWalletBalance(address: string): Promise<{
  balance: string;
  balanceFormatted: number;
}> {
  const result = await suiRpcCall('suix_getBalance', [address, '0x2::sui::SUI']) as {
    totalBalance: string;
  };

  return {
    balance: result.totalBalance,
    balanceFormatted: Number(result.totalBalance) / 1e9,
  };
}

/**
 * Fetch an on-chain object by ID.
 */
export async function getObject(objectId: string): Promise<unknown> {
  return suiRpcCall('sui_getObject', [
    objectId,
    { showContent: true, showType: true },
  ]);
}

/**
 * Query events for a specific module.
 */
export async function queryEvents(
  packageId: string,
  module: string,
  eventType: string,
  limit: number = 50
): Promise<unknown[]> {
  const result = await suiRpcCall('suix_queryEvents', [
    { MoveEventType: `${packageId}::${module}::${eventType}` },
    null,
    limit,
    true, // descending
  ]) as { data: unknown[] };

  return result.data;
}

// ============ Contract Addresses ============

export const CONTRACT_CONFIG = {
  packageId: process.env.NEXT_PUBLIC_PACKAGE_ID || '0x0',
  registryId: process.env.NEXT_PUBLIC_REGISTRY_ID || '0x0',
  duelRegistryId: process.env.NEXT_PUBLIC_DUEL_REGISTRY_ID || '0x0',
  adminCapId: process.env.NEXT_PUBLIC_ADMIN_CAP_ID || '0x0',
};

// ============ Network Info ============

export function getNetworkName(): string {
  return SUI_NETWORK;
}

export function getExplorerUrl(type: 'object' | 'tx' | 'address', id: string): string {
  // Mainnet: https://suivision.xyz/txblock/{digest}
  // Testnet: https://testnet.suivision.xyz/txblock/{digest}  (subdomain, not /testnet/ path)
  const base =
    SUI_NETWORK === 'mainnet'
      ? 'https://suivision.xyz'
      : SUI_NETWORK === 'devnet'
        ? 'https://devnet.suivision.xyz'
        : 'https://testnet.suivision.xyz';

  const pathMap = {
    object: 'object',
    tx: 'txblock',
    address: 'account',
  };

  return `${base}/${pathMap[type]}/${id}`;
}
