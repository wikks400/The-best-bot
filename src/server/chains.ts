import { FreeProviderComparison, NetworkConfig } from '../types/index.ts';

// Known obsolete, restricted, or rate-limited endpoints that require auth keys, block getLogs, or are defunct
export const DEFUNCT_PUBLIC_RPCS = new Set([
  'https://cloudflare-eth.com',
  'https://rpc.ankr.com/eth',
  'https://rpc.ankr.com/polygon',
  'https://polygon-rpc.com',
  'https://polygon.llamarpc.com',
  'https://eth.llamarpc.com',
  'https://base.llamarpc.com',
  'https://mainnet.base.org',
  'https://avalanche.public-rpc.com',
  'https://binance.llamarpc.com',
  'https://arbitrum.llamarpc.com',
  'https://optimism.llamarpc.com',
]);

/**
 * Checks if an RPC endpoint is known to be defunct, requiring auth, or restricting getLogs.
 * Automatically flags allnodes publicnode endpoints which require an address filter.
 */
export function isDefunctRpc(url?: string): boolean {
  if (!url) return true;
  const clean = url.trim().replace(/\/+$/, '');
  if (DEFUNCT_PUBLIC_RPCS.has(clean) || DEFUNCT_PUBLIC_RPCS.has(url.trim())) return true;
  if (clean.includes('.publicnode.com')) return true;
  if (clean.includes('.llamarpc.com')) return true;
  return false;
}

/**
 * Safely sanitizes an RPC URL for logging, stripping API keys or auth tokens.
 */
export function sanitizeRpcUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.length > 20) {
      parsed.pathname = parsed.pathname.replace(/\/([a-zA-Z0-9_-]{16,})/g, '/[REDACTED]');
    }
    if (parsed.search) {
      parsed.search = '?[REDACTED]';
    }
    return parsed.toString();
  } catch {
    return url.replace(/([a-zA-Z0-9]{20,})/g, '[REDACTED]');
  }
}

export const FREE_PROVIDER_COMPARISONS: FreeProviderComparison[] = [
  {
    blockchain: 'Ethereum',
    recommendedProvider: 'Tenderly Public Gateway / MEV Blocker',
    rpcUrl: 'https://gateway.tenderly.co/public/mainnet',
    apiKeyRequired: false,
    paymentCardRequired: false,
    freeTierLimitations: 'High-speed public RPC with zero rate-limit blocks on blockNumber & getLogs queries.',
    mintDetection: 'Reliable',
    purchaseDetection: 'Reliable',
    historicalDataLimitations: 'Recent blocks accessible with full logs without requiring an API key.',
    alternativeProviders: [
      'https://rpc.mevblocker.io',
      'https://1rpc.io/eth',
    ],
  },
  {
    blockchain: 'Polygon PoS',
    recommendedProvider: 'Tenderly Public Gateway / 1RPC',
    rpcUrl: 'https://polygon.gateway.tenderly.co',
    apiKeyRequired: false,
    paymentCardRequired: false,
    freeTierLimitations: 'High throughput, zero auth required, support for standard getLogs.',
    mintDetection: 'Reliable',
    purchaseDetection: 'Reliable',
    historicalDataLimitations: 'Recent blocks queryable without restrictions.',
    alternativeProviders: [
      'https://1rpc.io/matic',
      'https://polygon.drpc.org',
    ],
  },
  {
    blockchain: 'Base',
    recommendedProvider: 'Tenderly Public Gateway / 1RPC',
    rpcUrl: 'https://base.gateway.tenderly.co',
    apiKeyRequired: false,
    paymentCardRequired: false,
    freeTierLimitations: 'High throughput, fast block intervals; unrestricted getLogs queries supported.',
    mintDetection: 'Reliable',
    purchaseDetection: 'Reliable',
    historicalDataLimitations: 'Full recent block logs accessible.',
    alternativeProviders: ['https://1rpc.io/base', 'https://base.drpc.org'],
  },
  {
    blockchain: 'Ink',
    recommendedProvider: 'Kraken / Gelato Official Ink RPC',
    rpcUrl: 'https://rpc-gel.inkonchain.com',
    apiKeyRequired: false,
    paymentCardRequired: false,
    freeTierLimitations: 'Superchain L2. Standard RPC rate limits apply (approx. 30 req/min free burst).',
    mintDetection: 'Reliable',
    purchaseDetection: 'Reliable',
    historicalDataLimitations: 'Recent chain launch means archive depth is compact; full transaction logs accessible.',
    alternativeProviders: ['https://rpc.inkonchain.com'],
  },
  {
    blockchain: 'Arbitrum One',
    recommendedProvider: 'Tenderly Public Gateway / Offchain Labs',
    rpcUrl: 'https://arbitrum.gateway.tenderly.co',
    apiKeyRequired: false,
    paymentCardRequired: false,
    freeTierLimitations: 'High speed L2. Soft rate limit ~100 req/min. Batch requests supported.',
    mintDetection: 'Reliable',
    purchaseDetection: 'Reliable',
    historicalDataLimitations: 'Full access to state; getLogs capped at 10,000 log events per call.',
    alternativeProviders: ['https://arb1.arbitrum.io/rpc', 'https://1rpc.io/arb'],
  },
  {
    blockchain: 'Optimism',
    recommendedProvider: 'Tenderly Public Gateway / OP Labs',
    rpcUrl: 'https://optimism.gateway.tenderly.co',
    apiKeyRequired: false,
    paymentCardRequired: false,
    freeTierLimitations: 'OP Stack endpoint. Free public access without card or API key.',
    mintDetection: 'Reliable',
    purchaseDetection: 'Reliable',
    historicalDataLimitations: 'Last 10,000 blocks freely queryable with eth_getLogs.',
    alternativeProviders: ['https://mainnet.optimism.io', 'https://1rpc.io/op'],
  },
  {
    blockchain: 'BNB Smart Chain',
    recommendedProvider: 'BlockRazor / Binance Dataseed',
    rpcUrl: 'https://bsc.blockrazor.xyz',
    apiKeyRequired: false,
    paymentCardRequired: false,
    freeTierLimitations: 'High block creation speed (3s). Multi-dataseed failover active.',
    mintDetection: 'Reliable',
    purchaseDetection: 'Reliable',
    historicalDataLimitations: 'Recent blocks queryable with eth_getLogs.',
    alternativeProviders: ['https://bsc-dataseed.binance.org'],
  },
  {
    blockchain: 'Avalanche C-Chain',
    recommendedProvider: 'Ava Labs Official C-Chain RPC / 1RPC',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    apiKeyRequired: false,
    paymentCardRequired: false,
    freeTierLimitations: 'Fast finality (~1-2s). Official public endpoint with unrestricted getLogs.',
    mintDetection: 'Reliable',
    purchaseDetection: 'Reliable',
    historicalDataLimitations: 'Recent blocks fully queryable.',
    alternativeProviders: ['https://1rpc.io/avax/c'],
  },
  {
    blockchain: 'Robinhood Chain',
    recommendedProvider: 'Robinhood Official Mainnet L2 RPC',
    rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
    apiKeyRequired: false,
    paymentCardRequired: false,
    freeTierLimitations: 'Arbitrum Orbit Layer 2 mainnet (Chain ID 4663). Direct public JSON-RPC access without API keys or credit cards.',
    mintDetection: 'Reliable',
    purchaseDetection: 'Reliable',
    historicalDataLimitations: 'Full recent block logs accessible with eth_getLogs.',
    alternativeProviders: ['https://rpc.chain.robinhood.com'],
  },
];

/**
 * Resolves the primary RPC and fallback endpoints for a given chain.
 * Prioritizes environment variables (e.g. ETHEREUM_RPC_URL, POLYGON_RPC_URL, ALCHEMY_API_KEY, INFURA_API_KEY)
 * and falls back to verified public endpoints while eliminating defunct/broken URLs.
 */
export function resolveNetworkRpcs(
  networkId: string,
  chainId: number,
  existingRpcUrl?: string,
  existingFallbacks?: string[]
): { rpcUrl: string; fallbackRpcs: string[] } {
  const normId = networkId.toLowerCase();

  // 1. Check environment variables (filtering out any defunct/restricted endpoints)
  const envCandidates: (string | undefined)[] = [];

  if (normId === 'ethereum' || chainId === 1) {
    envCandidates.push(
      process.env.ETHEREUM_RPC_URL,
      process.env.RPC_URL_ETHEREUM,
      process.env.ETH_RPC_URL,
      process.env.RPC_URL,
      process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined,
      process.env.INFURA_API_KEY ? `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}` : undefined,
      process.env.ANKR_API_KEY ? `https://rpc.ankr.com/eth/${process.env.ANKR_API_KEY}` : undefined
    );
  } else if (normId === 'polygon' || chainId === 137) {
    envCandidates.push(
      process.env.POLYGON_RPC_URL,
      process.env.RPC_URL_POLYGON,
      process.env.MATIC_RPC_URL,
      process.env.ALCHEMY_API_KEY ? `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined,
      process.env.INFURA_API_KEY ? `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}` : undefined,
      process.env.ANKR_API_KEY ? `https://rpc.ankr.com/polygon/${process.env.ANKR_API_KEY}` : undefined
    );
  } else if (normId === 'base' || chainId === 8453) {
    envCandidates.push(process.env.BASE_RPC_URL, process.env.RPC_URL_BASE);
  } else if (normId === 'arbitrum' || chainId === 42161) {
    envCandidates.push(process.env.ARBITRUM_RPC_URL, process.env.RPC_URL_ARBITRUM);
  } else if (normId === 'optimism' || chainId === 10) {
    envCandidates.push(process.env.OPTIMISM_RPC_URL, process.env.RPC_URL_OPTIMISM);
  } else if (normId === 'ink' || chainId === 57073) {
    envCandidates.push(process.env.INK_RPC_URL, process.env.RPC_URL_INK);
  } else if (normId === 'bsc' || chainId === 56) {
    envCandidates.push(process.env.BSC_RPC_URL, process.env.BNB_CHAIN_RPC_URL, process.env.RPC_URL_BSC);
  } else if (normId === 'avalanche' || chainId === 43114) {
    envCandidates.push(process.env.RPC_URL_AVALANCHE, process.env.AVALANCHE_RPC_URL, process.env.AVAX_RPC_URL);
  } else if (normId === 'robinhood' || chainId === 4663) {
    envCandidates.push(process.env.ROBINHOOD_RPC_URL, process.env.RPC_URL_ROBINHOOD);
  }

  let envRpc: string | undefined;
  for (const c of envCandidates) {
    if (c && c.trim() && !isDefunctRpc(c.trim())) {
      envRpc = c.trim();
      break;
    }
  }

  // 2. Curated safe public endpoints by network
  let safeDefault = 'https://gateway.tenderly.co/public/mainnet';
  let safeFallbacks: string[] = [];

  if (normId === 'ethereum' || chainId === 1) {
    safeDefault = 'https://gateway.tenderly.co/public/mainnet';
    safeFallbacks = [
      'https://rpc.mevblocker.io',
      'https://1rpc.io/eth',
    ];
  } else if (normId === 'polygon' || chainId === 137) {
    safeDefault = 'https://polygon.gateway.tenderly.co';
    safeFallbacks = [
      'https://1rpc.io/matic',
      'https://polygon.drpc.org',
    ];
  } else if (normId === 'base' || chainId === 8453) {
    safeDefault = 'https://base.gateway.tenderly.co';
    safeFallbacks = ['https://1rpc.io/base', 'https://base.drpc.org'];
  } else if (normId === 'ink' || chainId === 57073) {
    safeDefault = 'https://rpc-gel.inkonchain.com';
    safeFallbacks = ['https://rpc.inkonchain.com'];
  } else if (normId === 'arbitrum' || chainId === 42161) {
    safeDefault = 'https://arbitrum.gateway.tenderly.co';
    safeFallbacks = ['https://arb1.arbitrum.io/rpc', 'https://1rpc.io/arb'];
  } else if (normId === 'optimism' || chainId === 10) {
    safeDefault = 'https://optimism.gateway.tenderly.co';
    safeFallbacks = ['https://mainnet.optimism.io', 'https://1rpc.io/op'];
  } else if (normId === 'bsc' || chainId === 56) {
    safeDefault = 'https://bsc.blockrazor.xyz';
    safeFallbacks = ['https://bsc-dataseed.binance.org'];
  } else if (normId === 'avalanche' || chainId === 43114) {
    safeDefault = 'https://api.avax.network/ext/bc/C/rpc';
    safeFallbacks = ['https://1rpc.io/avax/c'];
  } else if (normId === 'robinhood' || chainId === 4663) {
    safeDefault = 'https://rpc.mainnet.chain.robinhood.com';
    safeFallbacks = ['https://rpc.chain.robinhood.com'];
  }

  // 3. Select primary RPC:
  // If env var is set and not defunct, it takes highest priority.
  // Otherwise, if existing RPC is valid and NOT defunct, keep it; else use safeDefault.
  let primaryRpc = envRpc;
  if (!primaryRpc) {
    if (existingRpcUrl && !isDefunctRpc(existingRpcUrl.trim())) {
      primaryRpc = existingRpcUrl.trim();
    } else {
      primaryRpc = safeDefault;
    }
  }

  // 4. Clean up fallbacks: filter out defunct endpoints and deduplicate
  const combinedFallbacks = new Set<string>();
  if (existingFallbacks && Array.isArray(existingFallbacks)) {
    for (const fb of existingFallbacks) {
      const clean = fb.trim();
      if (!isDefunctRpc(clean) && clean !== primaryRpc) {
        combinedFallbacks.add(clean);
      }
    }
  }
  for (const sf of safeFallbacks) {
    if (!isDefunctRpc(sf) && sf !== primaryRpc) {
      combinedFallbacks.add(sf);
    }
  }
  if (!isDefunctRpc(safeDefault) && safeDefault !== primaryRpc) {
    combinedFallbacks.add(safeDefault);
  }

  return {
    rpcUrl: primaryRpc,
    fallbackRpcs: Array.from(combinedFallbacks),
  };
}

/**
 * Test an EVM RPC URL via standard JSON-RPC eth_chainId and eth_blockNumber.
 * Detects HTTP 401, 403, 429, timeouts, and validates expected chain ID.
 */
export async function testRpcEndpoint(
  rpcUrl: string,
  expectedChainId?: number,
  timeoutMs = 6000
): Promise<{
  success: boolean;
  blockNumber: number;
  chainId?: number;
  latencyMs: number;
  error?: string;
  isAuthError?: boolean;
}> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // 1. First test eth_chainId to verify network identity & basic connectivity
    const chainRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_chainId',
        params: [],
      }),
      signal: controller.signal,
    });

    if (!chainRes.ok) {
      clearTimeout(timer);
      const isAuth = chainRes.status === 401 || chainRes.status === 403;
      return {
        success: false,
        blockNumber: 0,
        latencyMs: Date.now() - start,
        error: isAuth
          ? `RPC HTTP ${chainRes.status}: Authentication required or access forbidden`
          : `RPC HTTP ${chainRes.status}: ${chainRes.statusText}`,
        isAuthError: isAuth,
      };
    }

    const chainText = await chainRes.text();
    let chainData: { jsonrpc?: string; result?: string; error?: { message: string; code?: number } };
    try {
      chainData = JSON.parse(chainText);
    } catch {
      clearTimeout(timer);
      return {
        success: false,
        blockNumber: 0,
        latencyMs: Date.now() - start,
        error: `Invalid non-JSON response from RPC: ${chainText.slice(0, 80)}`,
      };
    }

    if (chainData.error) {
      clearTimeout(timer);
      const msg = chainData.error.message || 'RPC Error';
      const isAuth = msg.toLowerCase().includes('authenticate') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('api key');
      return {
        success: false,
        blockNumber: 0,
        latencyMs: Date.now() - start,
        error: msg,
        isAuthError: isAuth,
      };
    }

    const chainId = chainData.result ? parseInt(chainData.result, 16) : undefined;
    if (expectedChainId !== undefined && chainId !== expectedChainId) {
      clearTimeout(timer);
      return {
        success: false,
        blockNumber: 0,
        chainId,
        latencyMs: Date.now() - start,
        error: `Chain ID mismatch: returned ${chainId}, expected ${expectedChainId}`,
      };
    }

    // 2. Test eth_blockNumber
    const blockRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_blockNumber',
        params: [],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!blockRes.ok) {
      return {
        success: false,
        blockNumber: 0,
        chainId,
        latencyMs: Date.now() - start,
        error: `RPC HTTP ${blockRes.status}: ${blockRes.statusText}`,
      };
    }

    const blockData = (await blockRes.json()) as { jsonrpc?: string; result?: string; error?: { message: string } };
    if (blockData.error) {
      return {
        success: false,
        blockNumber: 0,
        chainId,
        latencyMs: Date.now() - start,
        error: blockData.error.message || 'Block query error',
      };
    }

    if (!blockData.result) {
      return {
        success: false,
        blockNumber: 0,
        chainId,
        latencyMs: Date.now() - start,
        error: 'Invalid RPC response: missing result',
      };
    }

    const blockNumber = parseInt(blockData.result, 16);
    return {
      success: true,
      blockNumber,
      chainId,
      latencyMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const isTimeout = errorMsg.includes('aborted') || errorMsg.includes('timeout');
    return {
      success: false,
      blockNumber: 0,
      latencyMs: Date.now() - start,
      error: isTimeout ? `Connection timed out (>${timeoutMs / 1000}s)` : errorMsg,
    };
  }
}
