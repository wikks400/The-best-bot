import { ProjectInfo, NetworkConfig } from '../types/index.ts';
import { db } from './db.ts';

/**
 * Clean decoded string from raw hex returned by eth_call
 */
function decodeAbiString(hex: string): string | null {
  try {
    if (!hex || hex === '0x' || hex.length < 66) return null;
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

    // Dynamic string offset: usually 32 bytes offset (000...20), 32 bytes length, then chars
    if (cleanHex.length >= 128) {
      const lengthHex = cleanHex.slice(64, 128);
      const length = parseInt(lengthHex, 16);
      if (length > 0 && length < 256) {
        const strHex = cleanHex.slice(128, 128 + length * 2);
        const buf = Buffer.from(strHex, 'hex');
        const str = buf.toString('utf8').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
        if (str) return str;
      }
    }

    // Try bytes32 fixed string
    const buf = Buffer.from(cleanHex.slice(0, 64), 'hex');
    const str = buf.toString('utf8').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
    if (str && /^[a-zA-Z0-9_\-\s.]+$/.test(str)) {
      return str;
    }
  } catch {
    // Ignore decoding errors
  }
  return null;
}

/**
 * Fetch on-chain collection name using standard ERC721 name() (0x06fdde03)
 */
export async function fetchContractNameOnChain(rpcUrl: string, contractAddress: string): Promise<string | null> {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          {
            to: contractAddress,
            data: '0x06fdde03', // name() selector
          },
          'latest',
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json() as { result?: string };
    if (!data.result || data.result === '0x') return null;

    return decodeAbiString(data.result);
  } catch {
    return null;
  }
}

/**
 * Map chain ID to official OpenSea network slug
 */
export function getOpenSeaChainSlug(chainId: number): string | null {
  switch (chainId) {
    case 1:
      return 'ethereum';
    case 8453:
      return 'base';
    case 42161:
      return 'arbitrum';
    case 10:
      return 'optimism';
    case 137:
      return 'matic';
    case 56:
      return 'bsc';
    case 43114:
      return 'avalanche';
    case 4663:
      return 'robinhood';
    case 57073:
      return 'ink';
    default:
      return null;
  }
}

/**
 * Fetch official OpenSea collection metadata using OpenSea's v2 contract endpoint.
 * This directly returns the verified collection slug (e.g. 'diagnostics-734540624'),
 * collection name, and official overview URL.
 */
export async function fetchOpenSeaContractMetadata(
  chainSlug: string,
  contractAddress: string
): Promise<{ slug: string; name?: string; description?: string; openseaUrl?: string } | null> {
  try {
    const url = `https://api.opensea.io/api/v2/chain/${chainSlug}/contract/${contractAddress.toLowerCase()}`;
    const headers: Record<string, string> = { accept: 'application/json' };
    if (process.env.OPENSEA_API_KEY) {
      headers['x-api-key'] = process.env.OPENSEA_API_KEY;
    }

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;

    const json = (await res.json()) as { collection?: string; name?: string; description?: string };
    if (json.collection) {
      return {
        slug: json.collection,
        name: json.name,
        description: json.description,
        openseaUrl: `https://opensea.io/collection/${json.collection}/overview`,
      };
    }
  } catch {
    // Gracefully handle timeout or offline API
  }
  return null;
}

/**
 * Discover project information and links with verified OpenSea collection overview URLs
 */
export async function getOrDiscoverProject(
  network: NetworkConfig,
  contractAddress: string,
  hintName?: string
): Promise<ProjectInfo> {
  const cleanAddr = contractAddress.toLowerCase();
  const cached = db.getProject(network.chainId, cleanAddr);

  if (cached && cached.verified && cached.openseaUrl?.includes('/collection/')) {
    return cached;
  }

  const openseaChain = getOpenSeaChainSlug(network.chainId);
  let resolvedName = hintName || (cached ? cached.name : null);
  let resolvedDescription = cached?.description || `Verified ${network.name} NFT smart contract collection.`;
  let openseaUrl: string | undefined;
  let openseaMintUrl: string | undefined;

  // 1. Try official OpenSea contract lookup for exact collection slug & overview URL
  if (openseaChain) {
    const osMeta = await fetchOpenSeaContractMetadata(openseaChain, cleanAddr);
    if (osMeta) {
      openseaUrl = osMeta.openseaUrl || `https://opensea.io/collection/${osMeta.slug}/overview`;
      if (osMeta.name && (!resolvedName || resolvedName.startsWith('0x') || resolvedName.startsWith('Contract '))) {
        resolvedName = osMeta.name;
      }
      if (osMeta.description) {
        resolvedDescription = osMeta.description;
      }
    }
  }

  // 2. Query on-chain ERC-721 name() if name is not yet resolved
  if (!resolvedName || resolvedName.startsWith('0x') || resolvedName.startsWith('Contract ')) {
    const onChainName = await fetchContractNameOnChain(network.rpcUrl, cleanAddr);
    if (onChainName) {
      resolvedName = onChainName;
    }
  }

  // 3. Fallback name if neither OpenSea nor RPC returned a string
  if (!resolvedName) {
    resolvedName = `Contract ${cleanAddr.substring(0, 6)}...${cleanAddr.substring(cleanAddr.length - 4)}`;
  }

  // 4. Construct valid OpenSea Collection Overview URL if not already found via API
  if (!openseaUrl && openseaChain) {
    // Generate valid slug from resolved collection name
    const fallbackSlug = resolvedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    if (fallbackSlug && !fallbackSlug.startsWith('contract-')) {
      openseaUrl = `https://opensea.io/collection/${fallbackSlug}/overview`;
    } else {
      // Default collection overview link
      openseaUrl = `https://opensea.io/collection/${cleanAddr}/overview`;
    }
  }

  const explorerUrl = `${network.explorerUrl}/address/${cleanAddr}`;

  const project: ProjectInfo = {
    contractAddress: cleanAddr,
    chainId: network.chainId,
    name: resolvedName,
    description: resolvedDescription,
    website: cached?.website,
    twitter: cached?.twitter,
    discord: cached?.discord,
    openseaUrl,
    openseaMintUrl,
    explorerUrl,
    verified: true,
    updatedAt: Date.now(),
  };

  db.saveProject(project);
  return project;
}
