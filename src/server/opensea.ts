import { NetworkConfig, ActivityType } from '../types/index.ts';
import { db } from './db.ts';
import { getOrDiscoverProject } from './metadata.ts';
import { evaluateAndDispatchAlerts } from './alerter.ts';

// OpenSea v2 API Base URL
const OPENSEA_API_BASE = 'https://api.opensea.io/api/v2';

// Supported OpenSea chains mapping
const OPENSEA_SUPPORTED_CHAINS: Record<number, string> = {
  1: 'ethereum',
  137: 'matic',
  8453: 'base',
  42161: 'arbitrum',
  10: 'optimism',
  56: 'bsc',
  43114: 'avalanche',
  4663: 'robinhood',
};

// Chains known NOT to be supported by OpenSea API (must use direct RPC monitoring)
export const OPENSEA_UNSUPPORTED_CHAINS = new Set<number>([
  57073, // Ink (Superchain L2)
]);

interface OpenSeaEventNft {
  identifier?: string;
  collection?: string;
  contract?: string;
  name?: string;
}

interface OpenSeaPayment {
  quantity?: string;
  decimals?: number;
  symbol?: string;
}

interface OpenSeaRawEvent {
  event_type?: string;
  event_timestamp?: number | string;
  transaction?: string;
  nft?: OpenSeaEventNft;
  contract?: string;
  buyer?: string;
  seller?: string;
  from_address?: string;
  to_address?: string;
  payment?: OpenSeaPayment;
}

interface OpenSeaEventsResponse {
  asset_events?: OpenSeaRawEvent[];
}

let lastOpenSeaNoticeTime = 0;

/**
 * Checks whether OpenSea API supports a specific chain ID
 */
export function isOpenSeaSupported(chainId: number): boolean {
  return Boolean(OPENSEA_SUPPORTED_CHAINS[chainId]);
}

/**
 * Get OpenSea chain slug for a chain ID
 */
export function getOpenSeaSlug(chainId: number): string | null {
  return OPENSEA_SUPPORTED_CHAINS[chainId] || null;
}

/**
 * Poll OpenSea API v2 for account events (mints and buys) for tracked wallets.
 * Prioritizes OpenSea API for supported chains when OPENSEA_API_KEY is configured.
 * Automatically signals fallback to RPC monitoring if unsupported, unconfigured, or failing.
 */
export async function pollOpenSeaForNetwork(
  network: NetworkConfig,
  trackedAddresses: Set<string>
): Promise<{ prioritized: boolean; mintCount: number; buyCount: number }> {
  const chainSlug = getOpenSeaSlug(network.chainId);

  // 1. If chain is not supported by OpenSea (e.g. Robinhood Chain 4663), use RPC fallback
  if (!chainSlug || OPENSEA_UNSUPPORTED_CHAINS.has(network.chainId)) {
    return { prioritized: false, mintCount: 0, buyCount: 0 };
  }

  // 2. OpenSea v2 API requires an API key. If absent, fallback to reliable RPC monitoring
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) {
    const now = Date.now();
    if (now - lastOpenSeaNoticeTime > 600000) { // Log notice at most once every 10 minutes
      console.log(`[OpenSea] OPENSEA_API_KEY not set. Using primary high-throughput RPC monitoring for ${network.name}.`);
      lastOpenSeaNoticeTime = now;
    }
    return { prioritized: false, mintCount: 0, buyCount: 0 };
  }

  let totalMints = 0;
  let totalBuys = 0;
  const contractsToEvaluate = new Map<string, { type: ActivityType; projectHint?: string }>();

  try {
    for (const address of trackedAddresses) {
      const cleanAddr = address.toLowerCase();

      // Query account events on OpenSea API v2
      const url = `${OPENSEA_API_BASE}/events/accounts/${cleanAddr}?chain=${chainSlug}&limit=15`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-api-key': apiKey,
        },
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403 || res.status === 429) {
          // Rate-limited or auth issue, silently delegate to RPC
          return { prioritized: false, mintCount: totalMints, buyCount: totalBuys };
        }
        continue;
      }

      const data = (await res.json()) as OpenSeaEventsResponse;
      const events = data.asset_events || [];

      for (const ev of events) {
        const eventType = (ev.event_type || '').toLowerCase();
        const txHash = ev.transaction;
        if (!txHash) continue;

        const contract = (ev.nft?.contract || ev.contract || '').toLowerCase();
        if (!contract || contract === '0x') continue;

        const tokenId = ev.nft?.identifier || '0';
        const projectName = ev.nft?.name || ev.nft?.collection || `Collection ${contract.slice(0, 6)}`;
        const timestamp = typeof ev.event_timestamp === 'number'
          ? ev.event_timestamp * 1000
          : ev.event_timestamp ? new Date(ev.event_timestamp).getTime() : Date.now();

        // 1. Detect Buy / Sale
        if (eventType === 'sale' || eventType === 'successful') {
          const seller = (ev.seller || ev.from_address || '').toLowerCase();
          const buyer = (ev.buyer || ev.to_address || '').toLowerCase();

          // Section 6: Exclude sales made by tracked wallets (selling is not buying)
          if (seller === cleanAddr) {
            continue;
          }

          if (buyer === cleanAddr) {
            let priceNative: number | undefined;
            if (ev.payment?.quantity && ev.payment?.decimals) {
              priceNative = parseFloat(ev.payment.quantity) / Math.pow(10, ev.payment.decimals);
            }

            const { isNew } = db.recordActivity({
              type: 'buy',
              chainId: network.chainId,
              chainName: network.name,
              contractAddress: contract,
              projectName,
              walletAddress: cleanAddr,
              tokenId,
              quantity: 1,
              txHash,
              blockNumber: 0,
              timestamp,
              priceNative,
              marketplace: 'OpenSea',
            });

            if (isNew) {
              totalBuys++;
              contractsToEvaluate.set(`${contract}:buy`, { type: 'buy', projectHint: projectName });
            }
          }
        }

        // 2. Detect Mint
        const fromAddr = (ev.from_address || '').toLowerCase();
        const toAddr = (ev.to_address || ev.buyer || '').toLowerCase();
        const isMintEvent = eventType === 'mint' || (fromAddr === '0x0000000000000000000000000000000000000000' && toAddr === cleanAddr);

        if (isMintEvent && toAddr === cleanAddr) {
          const { isNew } = db.recordActivity({
            type: 'mint',
            chainId: network.chainId,
            chainName: network.name,
            contractAddress: contract,
            projectName,
            walletAddress: cleanAddr,
            tokenId,
            quantity: 1,
            txHash,
            blockNumber: 0,
            timestamp,
            marketplace: 'OpenSea',
          });

          if (isNew) {
            totalMints++;
            contractsToEvaluate.set(`${contract}:mint`, { type: 'mint', projectHint: projectName });
          }
        }
      }
    }

    // Trigger milestone evaluations for newly discovered activities
    for (const [key, info] of contractsToEvaluate.entries()) {
      const contract = key.split(':')[0];
      const project = await getOrDiscoverProject(network, contract, info.projectHint);
      await evaluateAndDispatchAlerts(network.chainId, contract, info.type, project, network);
    }

    return { prioritized: true, mintCount: totalMints, buyCount: totalBuys };
  } catch (err) {
    // On any OpenSea API error, fallback to RPC monitoring
    return { prioritized: false, mintCount: totalMints, buyCount: totalBuys };
  }
}
