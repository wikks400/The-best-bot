export type ActivityType = 'mint' | 'buy';

export interface WalletGroup {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TrackedWallet {
  address: string; // lowercased 0x...
  label?: string;
  groupIds: string[];
  createdAt: number;
}

export interface NetworkConfig {
  id: string;
  name: string;
  chainId: number;
  rpcUrl: string;
  fallbackRpcs: string[];
  explorerUrl: string;
  currencySymbol: string;
  isEnabled: boolean;
  isConnected: boolean;
  lastBlockChecked: number;
  lastCheckedAt: number | null;
  lastLatencyMs: number | null;
  lastError: string | null;
  freeTierNotes: string;
}

export interface NFTActivityRecord {
  id: string; // unique event id: hash + logIndex or hash + activityType + wallet
  type: ActivityType;
  chainId: number;
  chainName: string;
  contractAddress: string;
  projectName: string;
  walletAddress: string;
  tokenId?: string;
  quantity: number;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  priceNative?: number;
  priceUsd?: number;
  marketplace?: string;
}

export interface ProjectInfo {
  contractAddress: string;
  chainId: number;
  name: string;
  symbol?: string;
  description?: string;
  website?: string;
  twitter?: string;
  discord?: string;
  openseaUrl?: string;
  openseaMintUrl?: string;
  explorerUrl: string;
  verified: boolean;
  updatedAt: number;
}

export interface GroupActivitySummary {
  groupId: string;
  groupName: string;
  walletCount: number;
  nftCount: number;
}

export interface AlertMilestoneRecord {
  id: string;
  episodeId: string;
  chainId: number;
  chainName: string;
  contractAddress: string;
  projectName: string;
  activityType: ActivityType;
  milestoneIndex: number; // 1 (initial), 2, 3, 4, 5
  thresholdWallets: number; // 4, 7, 12, 20, 35
  totalUniqueWallets: number;
  newWalletsSinceLast: number;
  totalNfts: number;
  priceNative?: number;
  currencySymbol: string;
  groupBreakdown: GroupActivitySummary[];
  projectInfo?: ProjectInfo;
  sentAt: number;
  status: 'sent' | 'failed' | 'simulated';
}

export interface AlertSettings {
  milestones: number[]; // default: [4, 7, 12, 20, 35]
  channelId: string;
  roleId: string;
  webhookUrl: string;
  episodeTimeoutHours: number; // default: 24
  maxAlertsPerEpisode: number; // default: 5
  isMonitoring: boolean;
  pollIntervalMs: number; // default 12000
}

export interface FreeProviderComparison {
  blockchain: string;
  recommendedProvider: string;
  rpcUrl: string;
  apiKeyRequired: boolean;
  paymentCardRequired: boolean;
  freeTierLimitations: string;
  mintDetection: 'Reliable' | 'Partial' | 'Experimental';
  purchaseDetection: 'Reliable' | 'Partial' | 'Experimental';
  historicalDataLimitations: string;
  alternativeProviders: string[];
}
