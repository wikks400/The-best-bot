import { FreeProviderComparison, NetworkConfig } from '../types/index.ts';

export const FREE_PROVIDER_COMPARISONS: FreeProviderComparison[] = [
  {
    blockchain: 'Ethereum',
    recommendedProvider: 'LlamaNodes / Cloudflare Public RPC',
    rpcUrl: 'https://eth.llamarpc.com',
    apiKeyRequired: false,
    paymentCardRequired: false,
    freeTierLimitations: 'Rate limit ~20-50 req/sec; eth_getLogs restricted to maximum 10-20 blocks per query to prevent 429/overload.',
    mintDetection: 'Reliable',
    purchaseDetection: 'Reliable',
    historicalDataLimitations: 'Public RPC nodes archive access varies; recent blocks (last 1,000 blocks) are 100% available with full logs.',
    alternativeProviders: ['https://cloudflare-eth.com', 'https://rpc.ankr.com/eth', 'https://1rpc.io/eth'],
  },
  {
    blockchain: 'Base',
    recommendedProvider: 'Coinbase Official Public RPC',
    rpcUrl: 'https://mainnet.base.org',
    apiKeyRequired: false,
    paymentCardRequired: false,
    freeTierLimitations: 'High throughput, fast 2-second block intervals; getLogs batch queries supported up to 50 blocks comfortably.',
    mintDetection: 'Reliable',
    purchaseDetection: 'Reliable',
    historicalDataLimitations: 'Full recent block logs; deep historical queries (>100k blocks) may require paginated chunks or Basescan free tier.',
    alternativeProviders: ['https://base.llamarpc.com', 'https://1rpc.io/base', 'https://base.drpc.org'],
  },
  {
    blockchain: 'Ink',
    recommendedProvider: 'Kraken / Gelato Official Ink RPC',
    rpcUrl: 'https://rpc-gel.inkonchain.com',
    apiKeyRequired: false,
    paymentCardRequired: false,
    freeTierLimitations: 'Brand new Superchain L2. Standard RPC rate limits apply (approx. 30 req/min free burst).',
    mintDetection: 'Reliable',
    purchaseDetection: 'Reliable',
    historicalDataLimitations: 'Recent chain launch means archive depth is compact; full transaction logs accessible.',
    alternativeProviders: ['https://rpc.inkonchain.com'],
  },
  {
    blockchain: 'Arbitrum One',
    recommendedProvider: 'Offchain Labs Official Public RPC',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    apiKeyRequired: false,
    paymentCardRequired: false,
    freeTierLimitations: 'High speed L2. Soft rate limit ~100 req/min. Batch requests supported.',
    mintDetection: 'Reliable',
    purchaseDetection: 'Reliable',
    historicalDataLimitations: 'Full access to state; getLogs capped at 10,000 log events per call.',
    alternativeProviders: ['https://arbitrum.llamarpc.com', 'https://1rpc.io/arb', 'https://arb-mainnet.g.alchemy.com/v2/demo'],
  },
  {
    blockchain: 'Optimism',
    recommendedProvider: 'OP Labs Official Public RPC',
    rpcUrl: 'https://mainnet.optimism.io',
    apiKeyRequired: false,
    paymentCardRequired: false,
    freeTierLimitations: 'OP Stack default endpoint. Free public access without card or API key.',
    mintDetection: 'Reliable',
    purchaseDetection: 'Reliable',
    historicalDataLimitations: 'Last 10,000 blocks freely queryable with eth_getLogs.',
    alternativeProviders: ['https://optimism.llamarpc.com', 'https://1rpc.io/op'],
  },
  {
    blockchain: 'Polygon PoS',
    recommendedProvider: 'Polygon Official RPC',
    rpcUrl: 'https://polygon-rpc.com',
    apiKeyRequired: false,
    paymentCardRequired: false,
    freeTierLimitations: 'Public aggregation endpoint. May experience occasional re-org delay or temporary throttling under heavy traffic.',
    mintDetection: 'Reliable',
    purchaseDetection: 'Reliable',
    historicalDataLimitations: 'Logs restricted to max 2,000 blocks per request. Re-queries recommended with exponential backoff.',
    alternativeProviders: ['https://polygon.llamarpc.com', 'https://rpc-mainnet.matic.quiknode.pro'],
  },
  {
    blockchain: 'BNB Smart Chain',
    recommendedProvider: 'Binance Official Dataseed RPC',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    apiKeyRequired: false,
    paymentCardRequired: false,
    freeTierLimitations: 'High block creation speed (3s). Multi-dataseed failover required for 100% uptime.',
    mintDetection: 'Reliable',
    purchaseDetection: 'Reliable',
    historicalDataLimitations: 'Standard getLogs limits (max 5,000 logs per batch).',
    alternativeProviders: ['https://binance.llamarpc.com', 'https://bsc.publicnode.com'],
  },
  {
    blockchain: 'Avalanche C-Chain',
    recommendedProvider: 'Ava Labs Public C-Chain RPC',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    apiKeyRequired: false,
    paymentCardRequired: false,
    freeTierLimitations: 'Fast finality (~1-2s). Public endpoint allows ~60 req/min for free users.',
    mintDetection: 'Reliable',
    purchaseDetection: 'Reliable',
    historicalDataLimitations: 'Recent blocks fully queryable; historical eth_getLogs range capped at 2,048 blocks.',
    alternativeProviders: ['https://avalanche.public-rpc.com', 'https://1rpc.io/avax/c'],
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
 * Test an EVM RPC URL via simple standard JSON-RPC eth_blockNumber call
 */
export async function testRpcEndpoint(rpcUrl: string, timeoutMs = 6000): Promise<{
  success: boolean;
  blockNumber: number;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: [],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: false,
        blockNumber: 0,
        latencyMs: Date.now() - start,
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json() as { jsonrpc?: string; result?: string; error?: { message: string } };
    if (data.error) {
      return {
        success: false,
        blockNumber: 0,
        latencyMs: Date.now() - start,
        error: data.error.message || 'RPC Error',
      };
    }

    if (!data.result) {
      return {
        success: false,
        blockNumber: 0,
        latencyMs: Date.now() - start,
        error: 'Invalid RPC response: missing result',
      };
    }

    const blockNumber = parseInt(data.result, 16);
    return {
      success: true,
      blockNumber,
      latencyMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      blockNumber: 0,
      latencyMs: Date.now() - start,
      error: errorMsg.includes('aborted') ? 'Connection timed out (>6s)' : errorMsg,
    };
  }
}
