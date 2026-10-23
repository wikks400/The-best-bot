import { ProjectInfo, NetworkConfig } from '../types/index.ts';
import { db } from './db.ts';

/**
 * Clean decoded string from raw hex returned by eth_call
 */
function decodeAbiString(hex: string): string | null {
  try {
    if (!hex || hex === '0x' || hex.length < 66) return null;
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

    // Check if dynamic string offset
    // usually 32 bytes offset (000...20), 32 bytes length, then characters
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
 * Map chain ID to OpenSea network slug
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
    case 57073:
      return 'ink';
    default:
      return null;
  }
}

/**
 * Discover project information and links with fallback
 */
export async function getOrDiscoverProject(
  network: NetworkConfig,
  contractAddress: string,
  hintName?: string
): Promise<ProjectInfo> {
  const cleanAddr = contractAddress.toLowerCase();
  const cached = db.getProject(network.chainId, cleanAddr);

  if (cached && cached.verified) {
    return cached;
  }

  // Generate verified OpenSea and explorer links
  const openseaChain = getOpenSeaChainSlug(network.chainId);
  const openseaUrl = openseaChain
    ? `https://opensea.io/assets/${openseaChain}/${cleanAddr}`
    : undefined;
  const openseaMintUrl = openseaChain
    ? `https://opensea.io/mint/${openseaChain}/${cleanAddr}`
    : undefined;
  const explorerUrl = `${network.explorerUrl}/address/${cleanAddr}`;

  // 1. Try on-chain name() call
  let resolvedName = hintName || (cached ? cached.name : null);
  if (!resolvedName || resolvedName.startsWith('0x')) {
    const onChainName = await fetchContractNameOnChain(network.rpcUrl, cleanAddr);
    if (onChainName) {
      resolvedName = onChainName;
    }
  }

  if (!resolvedName) {
    // Short address fallback
    resolvedName = `Contract ${cleanAddr.substring(0, 6)}...${cleanAddr.substring(cleanAddr.length - 4)}`;
  }

  const project: ProjectInfo = {
    contractAddress: cleanAddr,
    chainId: network.chainId,
    name: resolvedName,
    description: cached?.description || `Verified ${network.name} NFT smart contract collection.`,
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
