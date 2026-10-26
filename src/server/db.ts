import fs from 'fs';
import path from 'path';
import {
  WalletGroup,
  TrackedWallet,
  NetworkConfig,
  NFTActivityRecord,
  ProjectInfo,
  AlertMilestoneRecord,
  AlertSettings,
  GroupActivitySummary
} from '../types/index.ts';
import { resolveNetworkRpcs } from './chains.ts';

interface DatabaseSchema {
  groups: WalletGroup[];
  wallets: TrackedWallet[];
  networks: NetworkConfig[];
  projects: Record<string, ProjectInfo>; // key: `${chainId}:${contractAddress.toLowerCase()}`
  activities: NFTActivityRecord[];
  alerts: AlertMilestoneRecord[];
  settings: AlertSettings;
}

const envMilestones = process.env.ALERT_MILESTONES || process.env.MILESTONES;
const parsedMilestones = envMilestones
  ? envMilestones.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0)
  : null;

const DEFAULT_SETTINGS: AlertSettings = {
  milestones: parsedMilestones && parsedMilestones.length > 0 ? parsedMilestones : [3, 7, 12],
  channelId: process.env.DISCORD_CHANNEL_ID || '',
  roleId: process.env.DISCORD_ROLE_ID || '',
  webhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
  episodeTimeoutHours: 24,
  maxAlertsPerEpisode: 3,
  isMonitoring: true,
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '12000', 10),
};

// Default empty groups and wallets - User creates their own groups and imports their own wallets
const DEFAULT_GROUPS: WalletGroup[] = [];
const DEFAULT_WALLETS: TrackedWallet[] = [];

const ethRpcs = resolveNetworkRpcs('ethereum', 1);
const baseRpcs = resolveNetworkRpcs('base', 8453);
const inkRpcs = resolveNetworkRpcs('ink', 57073);
const arbRpcs = resolveNetworkRpcs('arbitrum', 42161);
const opRpcs = resolveNetworkRpcs('optimism', 10);
const polyRpcs = resolveNetworkRpcs('polygon', 137);
const bscRpcs = resolveNetworkRpcs('bsc', 56);
const avaxRpcs = resolveNetworkRpcs('avalanche', 43114);
const rhRpcs = resolveNetworkRpcs('robinhood', 4663);

const DEFAULT_NETWORKS: NetworkConfig[] = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: ethRpcs.rpcUrl,
    fallbackRpcs: ethRpcs.fallbackRpcs,
    explorerUrl: 'https://etherscan.io',
    currencySymbol: 'ETH',
    isEnabled: true,
    isConnected: false,
    lastBlockChecked: 0,
    lastCheckedAt: null,
    lastLatencyMs: null,
    lastError: null,
    freeTierNotes: 'MEV Blocker / 1RPC / Tenderly public RPC. Zero auth required.',
  },
  {
    id: 'base',
    name: 'Base',
    chainId: 8453,
    rpcUrl: baseRpcs.rpcUrl,
    fallbackRpcs: baseRpcs.fallbackRpcs,
    explorerUrl: 'https://basescan.org',
    currencySymbol: 'ETH',
    isEnabled: true,
    isConnected: false,
    lastBlockChecked: 0,
    lastCheckedAt: null,
    lastLatencyMs: null,
    lastError: null,
    freeTierNotes: 'Tenderly / 1RPC public gateway. Fast block time and unrestricted getLogs.',
  },
  {
    id: 'ink',
    name: 'Ink',
    chainId: 57073,
    rpcUrl: inkRpcs.rpcUrl,
    fallbackRpcs: inkRpcs.fallbackRpcs,
    explorerUrl: 'https://explorer.inkonchain.com',
    currencySymbol: 'ETH',
    isEnabled: true,
    isConnected: false,
    lastBlockChecked: 0,
    lastCheckedAt: null,
    lastLatencyMs: null,
    lastError: null,
    freeTierNotes: 'Kraken Ink Superchain L2. Free official Gelato RPC, zero card needed.',
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum One',
    chainId: 42161,
    rpcUrl: arbRpcs.rpcUrl,
    fallbackRpcs: arbRpcs.fallbackRpcs,
    explorerUrl: 'https://arbiscan.io',
    currencySymbol: 'ETH',
    isEnabled: true,
    isConnected: false,
    lastBlockChecked: 0,
    lastCheckedAt: null,
    lastLatencyMs: null,
    lastError: null,
    freeTierNotes: 'Tenderly / Offchain Labs official public endpoint. Fast block queries.',
  },
  {
    id: 'optimism',
    name: 'Optimism',
    chainId: 10,
    rpcUrl: opRpcs.rpcUrl,
    fallbackRpcs: opRpcs.fallbackRpcs,
    explorerUrl: 'https://optimistic.etherscan.io',
    currencySymbol: 'ETH',
    isEnabled: true,
    isConnected: false,
    lastBlockChecked: 0,
    lastCheckedAt: null,
    lastLatencyMs: null,
    lastError: null,
    freeTierNotes: 'Tenderly / OP Foundation public RPC. Free and reliable.',
  },
  {
    id: 'polygon',
    name: 'Polygon',
    chainId: 137,
    rpcUrl: polyRpcs.rpcUrl,
    fallbackRpcs: polyRpcs.fallbackRpcs,
    explorerUrl: 'https://polygonscan.com',
    currencySymbol: 'POL',
    isEnabled: true,
    isConnected: false,
    lastBlockChecked: 0,
    lastCheckedAt: null,
    lastLatencyMs: null,
    lastError: null,
    freeTierNotes: '1RPC / Tenderly / PublicNode official Bor RPC. Free public tier.',
  },
  {
    id: 'bsc',
    name: 'BNB Smart Chain',
    chainId: 56,
    rpcUrl: bscRpcs.rpcUrl,
    fallbackRpcs: bscRpcs.fallbackRpcs,
    explorerUrl: 'https://bscscan.com',
    currencySymbol: 'BNB',
    isEnabled: true,
    isConnected: false,
    lastBlockChecked: 0,
    lastCheckedAt: null,
    lastLatencyMs: null,
    lastError: null,
    freeTierNotes: 'Binance public dataseed RPC. Zero cost.',
  },
  {
    id: 'avalanche',
    name: 'Avalanche C-Chain',
    chainId: 43114,
    rpcUrl: avaxRpcs.rpcUrl,
    fallbackRpcs: avaxRpcs.fallbackRpcs,
    explorerUrl: 'https://snowtrace.io',
    currencySymbol: 'AVAX',
    isEnabled: true,
    isConnected: false,
    lastBlockChecked: 0,
    lastCheckedAt: null,
    lastLatencyMs: null,
    lastError: null,
    freeTierNotes: 'Ava Labs official C-Chain RPC. Free public tier.',
  },
  {
    id: 'robinhood',
    name: 'Robinhood Chain',
    chainId: 4663,
    rpcUrl: rhRpcs.rpcUrl,
    fallbackRpcs: rhRpcs.fallbackRpcs,
    explorerUrl: 'https://explorer.chain.robinhood.com',
    currencySymbol: 'ETH',
    isEnabled: true,
    isConnected: true,
    lastBlockChecked: 0,
    lastCheckedAt: null,
    lastLatencyMs: null,
    lastError: null,
    freeTierNotes: 'Robinhood Official Mainnet L2 (Arbitrum Orbit, Chain ID 4663). Zero-card public endpoint active.',
  },
];

export class Database {
  private filePath: string;
  private data: DatabaseSchema;

  constructor(filePath?: string) {
    if (filePath) {
      this.filePath = filePath;
    } else if (fs.existsSync('./data/database.json')) {
      this.filePath = './data/database.json';
    } else if (process.env.DATABASE_PATH && fs.existsSync(process.env.DATABASE_PATH)) {
      this.filePath = process.env.DATABASE_PATH;
    } else {
      this.filePath = process.env.DATABASE_PATH || './data/database.json';
    }

    // Clean up any stale temporary files from previous abrupt process halts
    try {
      const dir = path.dirname(this.filePath);
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (f.endsWith('.tmp')) {
            try {
              fs.unlinkSync(path.join(dir, f));
            } catch {}
          }
        }
      }
    } catch {}

    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);

        // Dynamically reconcile and apply environment variables & filter defunct RPCs
        const rawNetworks: NetworkConfig[] = parsed.networks || DEFAULT_NETWORKS;
        const reconciledNetworks = rawNetworks.map((net) => {
          const { rpcUrl, fallbackRpcs } = resolveNetworkRpcs(net.id, net.chainId, net.rpcUrl, net.fallbackRpcs);
          return {
            ...net,
            rpcUrl,
            fallbackRpcs,
          };
        });

        // Ensure defaults if missing keys, preserving all existing user data
        return {
          groups: parsed.groups || DEFAULT_GROUPS,
          wallets: parsed.wallets || DEFAULT_WALLETS,
          networks: reconciledNetworks,
          projects: parsed.projects || {},
          activities: parsed.activities || [],
          alerts: parsed.alerts || [],
          settings: {
            ...DEFAULT_SETTINGS,
            ...(parsed.settings || {}),
            milestones: parsedMilestones && parsedMilestones.length > 0
              ? parsedMilestones
              : (Array.isArray(parsed.settings?.milestones) && parsed.settings.milestones.length > 0
                  ? [3, ...parsed.settings.milestones.filter((m: number) => m > 3)].slice(0, 3)
                  : [3, 7, 12]),
            maxAlertsPerEpisode: process.env.MAX_ALERTS_PER_EPISODE
              ? parseInt(process.env.MAX_ALERTS_PER_EPISODE, 10)
              : (parsed.settings?.maxAlertsPerEpisode === 5 ? 3 : (parsed.settings?.maxAlertsPerEpisode || 3)),
            channelId: process.env.DISCORD_CHANNEL_ID || parsed.settings?.channelId || DEFAULT_SETTINGS.channelId || '',
            roleId: process.env.DISCORD_ROLE_ID || parsed.settings?.roleId || DEFAULT_SETTINGS.roleId || '',
            webhookUrl: process.env.DISCORD_WEBHOOK_URL || parsed.settings?.webhookUrl || DEFAULT_SETTINGS.webhookUrl || '',
          },
        };
      }
    } catch (err) {
      console.error('Error reading database file, initializing defaults:', err);
    }

    const initial: DatabaseSchema = {
      groups: DEFAULT_GROUPS,
      wallets: DEFAULT_WALLETS,
      networks: DEFAULT_NETWORKS,
      projects: {},
      activities: [],
      alerts: [],
      settings: DEFAULT_SETTINGS,
    };
    this.persist(initial);
    return initial;
  }

  private persist(data: DatabaseSchema) {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tempPath = `${this.filePath}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('Failed to persist database file:', err);
    }
  }

  private save() {
    this.persist(this.data);
  }

  // --- Group Management ---
  public getGroups(): WalletGroup[] {
    return [...this.data.groups];
  }

  public getGroupById(id: string): WalletGroup | undefined {
    return this.data.groups.find(g => g.id === id);
  }

  public getGroupByName(name: string): WalletGroup | undefined {
    const trimmed = name.trim().toLowerCase();
    return this.data.groups.find(g => g.name.toLowerCase() === trimmed);
  }

  public createGroup(name: string, description?: string): WalletGroup {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Group name cannot be empty');
    if (this.getGroupByName(trimmed)) {
      throw new Error(`Group '${trimmed}' already exists`);
    }

    const id = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const group: WalletGroup = {
      id,
      name: trimmed,
      description: description?.trim() || '',
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.data.groups.push(group);
    this.save();
    return group;
  }

  public toggleGroup(id: string, enabled?: boolean): WalletGroup {
    const group = this.data.groups.find(g => g.id === id);
    if (!group) throw new Error(`Group not found`);
    group.enabled = enabled !== undefined ? enabled : !group.enabled;
    group.updatedAt = Date.now();
    this.save();
    return group;
  }

  public deleteGroup(id: string): boolean {
    const initialLen = this.data.groups.length;
    this.data.groups = this.data.groups.filter(g => g.id !== id);
    if (this.data.groups.length !== initialLen) {
      // Remove group from all wallets
      for (const wallet of this.data.wallets) {
        wallet.groupIds = wallet.groupIds.filter(gId => gId !== id);
      }
      // Remove wallets that now belong to no groups
      this.data.wallets = this.data.wallets.filter(w => w.groupIds.length > 0);
      this.save();
      return true;
    }
    return false;
  }

  // --- Wallet Management ---
  public static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
  }

  public getWallets(): TrackedWallet[] {
    return [...this.data.wallets];
  }

  public getWalletsByGroup(groupId: string): TrackedWallet[] {
    return this.data.wallets.filter(w => w.groupIds.includes(groupId));
  }

  public getEnabledWallets(): TrackedWallet[] {
    const enabledGroupIds = new Set(this.data.groups.filter(g => g.enabled).map(g => g.id));
    return this.data.wallets.filter(w => w.groupIds.some(gId => enabledGroupIds.has(gId)));
  }

  public getEnabledWalletAddresses(): Set<string> {
    const enabled = this.getEnabledWallets();
    return new Set(enabled.map(w => w.address.toLowerCase()));
  }

  public addWallet(address: string, groupId: string, label?: string): { wallet: TrackedWallet; isNew: boolean } {
    const cleanAddr = address.trim().toLowerCase();
    if (!Database.isValidAddress(cleanAddr)) {
      throw new Error(`Invalid EVM wallet address: ${address}. Must be 0x followed by 40 hex characters.`);
    }

    const group = this.getGroupById(groupId);
    if (!group) {
      throw new Error(`Group '${groupId}' does not exist.`);
    }

    let wallet = this.data.wallets.find(w => w.address.toLowerCase() === cleanAddr);
    let isNew = false;

    if (wallet) {
      if (wallet.groupIds.includes(groupId)) {
        throw new Error(`Wallet ${cleanAddr} is already in group '${group.name}'.`);
      }
      wallet.groupIds.push(groupId);
      if (label && !wallet.label) {
        wallet.label = label.trim();
      }
    } else {
      isNew = true;
      wallet = {
        address: cleanAddr,
        label: label?.trim() || '',
        groupIds: [groupId],
        createdAt: Date.now(),
      };
      this.data.wallets.push(wallet);
    }

    this.save();
    return { wallet, isNew };
  }

  public removeWalletFromGroup(address: string, groupId: string): boolean {
    const cleanAddr = address.trim().toLowerCase();
    const wallet = this.data.wallets.find(w => w.address.toLowerCase() === cleanAddr);
    if (!wallet) return false;

    if (!wallet.groupIds.includes(groupId)) return false;

    wallet.groupIds = wallet.groupIds.filter(g => g !== groupId);

    // If wallet belongs to zero groups now, delete wallet entry
    if (wallet.groupIds.length === 0) {
      this.data.wallets = this.data.wallets.filter(w => w.address.toLowerCase() !== cleanAddr);
    }

    this.save();
    return true;
  }

  /**
   * Remove all tracked wallets from a specific group
   */
  public clearWalletsInGroup(groupNameOrId: string): { removedCount: number; groupName: string } {
    const trimmed = (groupNameOrId || '').trim();
    const group = this.getGroupById(trimmed) || this.getGroupByName(trimmed);
    if (!group) {
      throw new Error(`Group '${groupNameOrId}' does not exist.`);
    }

    let removedCount = 0;
    for (const wallet of this.data.wallets) {
      if (wallet.groupIds.includes(group.id)) {
        wallet.groupIds = wallet.groupIds.filter(g => g !== group.id);
        removedCount++;
      }
    }

    // Delete wallets that no longer belong to any group
    this.data.wallets = this.data.wallets.filter(w => w.groupIds.length > 0);
    this.save();
    return { removedCount, groupName: group.name };
  }

  private processImportItem(
    cleanAddr: string,
    label: string | undefined,
    groupId: string,
    onAdded: () => void,
    onExisting: () => void
  ) {
    let wallet = this.data.wallets.find(w => w.address.toLowerCase() === cleanAddr);
    if (wallet) {
      if (wallet.groupIds.includes(groupId)) {
        onExisting();
      } else {
        wallet.groupIds.push(groupId);
        onAdded();
      }
      if (label && !wallet.label) {
        wallet.label = label.trim();
      }
    } else {
      this.data.wallets.push({
        address: cleanAddr,
        label: label?.trim() || '',
        groupIds: [groupId],
        createdAt: Date.now(),
      });
      onAdded();
    }
  }

  public importWallets(
    rawText: string,
    groupNameOrId: string,
    groupDescription?: string
  ): { added: number; existing: number; errors: string[]; group: WalletGroup } {
    const trimmedGroupRef = (groupNameOrId || '').trim();
    if (!trimmedGroupRef) {
      throw new Error('Please specify a group name for the imported wallets.');
    }

    let group = this.getGroupById(trimmedGroupRef) || this.getGroupByName(trimmedGroupRef);
    if (!group) {
      // Auto-create group using the exact name the user entered
      group = this.createGroup(trimmedGroupRef, groupDescription || 'User created wallet group');
    }

    // Split into individual lines
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let added = 0;
    let existing = 0;
    const errors: string[] = [];
    const ethAddressRegex = /(0x[a-fA-F0-9]{40})/i;

    for (const line of lines) {
      const match = line.match(ethAddressRegex);
      if (!match) {
        // Fallback: check if multiple comma or space separated addresses are on this line
        const tokens = line.split(/[,;\s]+/).filter(Boolean);
        let foundAny = false;
        for (const token of tokens) {
          const tMatch = token.match(ethAddressRegex);
          if (tMatch) {
            foundAny = true;
            this.processImportItem(tMatch[1].toLowerCase(), undefined, group.id, () => added++, () => existing++);
          }
        }
        if (!foundAny) {
          errors.push(`No valid 0x EVM address found in: "${line}"`);
        }
        continue;
      }

      const cleanAddr = match[1].toLowerCase();
      // Extract custom wallet name/label from the rest of the line (e.g. "0x123... - Whales Captain" or "0x123..., Alpha Minters")
      let label = line.replace(match[0], '').replace(/^[\s,;:\-|–—]+|[\s,;:\-|–—]+$/g, '').trim();

      this.processImportItem(cleanAddr, label || undefined, group.id, () => added++, () => existing++);
    }

    this.save();
    return { added, existing, errors, group };
  }

  public clearAllGroupsAndWallets(): void {
    this.data.groups = [];
    this.data.wallets = [];
    this.data.activities = [];
    this.data.alerts = [];
    this.save();
  }

  // --- Network Configurations ---
  public getNetworks(): NetworkConfig[] {
    return [...this.data.networks];
  }

  public getNetworkByChainId(chainId: number): NetworkConfig | undefined {
    return this.data.networks.find(n => n.chainId === chainId);
  }

  public getNetworkById(id: string): NetworkConfig | undefined {
    return this.data.networks.find(n => n.id === id);
  }

  public updateNetwork(id: string, updates: Partial<NetworkConfig>): NetworkConfig {
    const net = this.data.networks.find(n => n.id === id);
    if (!net) throw new Error(`Network ${id} not found`);
    Object.assign(net, updates);
    this.save();
    return net;
  }

  public addNetwork(network: Omit<NetworkConfig, 'lastBlockChecked' | 'lastCheckedAt' | 'lastLatencyMs' | 'lastError' | 'isConnected'>): NetworkConfig {
    if (this.data.networks.some(n => n.chainId === network.chainId)) {
      throw new Error(`Network with Chain ID ${network.chainId} already exists`);
    }
    const fullNet: NetworkConfig = {
      ...network,
      isConnected: false,
      lastBlockChecked: 0,
      lastCheckedAt: null,
      lastLatencyMs: null,
      lastError: null,
    };
    this.data.networks.push(fullNet);
    this.save();
    return fullNet;
  }

  // --- Projects & Metadata ---
  public getProject(chainId: number, contractAddress: string): ProjectInfo | undefined {
    const key = `${chainId}:${contractAddress.toLowerCase()}`;
    return this.data.projects[key];
  }

  public saveProject(project: ProjectInfo) {
    const key = `${project.chainId}:${project.contractAddress.toLowerCase()}`;
    this.data.projects[key] = {
      ...project,
      updatedAt: Date.now(),
    };

    // Keep metadata cache bounded to 500 contracts
    const keys = Object.keys(this.data.projects);
    if (keys.length > 500) {
      const oldestKeys = keys
        .sort((a, b) => (this.data.projects[a]?.updatedAt || 0) - (this.data.projects[b]?.updatedAt || 0))
        .slice(0, keys.length - 500);
      for (const k of oldestKeys) {
        delete this.data.projects[k];
      }
    }

    this.save();
  }

  // --- Activity Records & Deduplication ---
  public recordActivity(record: Omit<NFTActivityRecord, 'id'>): { record: NFTActivityRecord; isNew: boolean } {
    // Unique ID combining chainId, txHash, activityType, wallet, contract, tokenId
    const id = `${record.chainId}_${record.txHash.toLowerCase()}_${record.type}_${record.walletAddress.toLowerCase()}_${record.contractAddress.toLowerCase()}_${record.tokenId || '0'}`;
    const legacyId = `${record.txHash.toLowerCase()}_${record.type}_${record.walletAddress.toLowerCase()}_${record.contractAddress.toLowerCase()}_${record.tokenId || '0'}`;

    const existing = this.data.activities.find(a => a.id === id || a.id === legacyId);
    if (existing) {
      return { record: existing, isNew: false };
    }

    const fullRecord: NFTActivityRecord = {
      ...record,
      id,
      walletAddress: record.walletAddress.toLowerCase(),
      contractAddress: record.contractAddress.toLowerCase(),
      txHash: record.txHash.toLowerCase(),
    };

    this.data.activities.push(fullRecord);
    // Keep activities capped to last 3,000 to maintain compact storage and swift execution
    if (this.data.activities.length > 3000) {
      this.data.activities = this.data.activities.slice(-3000);
    }

    this.save();
    return { record: fullRecord, isNew: true };
  }

  public getActivitiesForProject(chainId: number, contractAddress: string, activityType: 'mint' | 'buy', sinceTimestamp?: number): NFTActivityRecord[] {
    const cleanAddr = contractAddress.toLowerCase();
    return this.data.activities.filter(a =>
      a.chainId === chainId &&
      a.contractAddress.toLowerCase() === cleanAddr &&
      a.type === activityType &&
      (!sinceTimestamp || a.timestamp >= sinceTimestamp)
    );
  }

  public getRecentActivities(limit = 50): NFTActivityRecord[] {
    return [...this.data.activities].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  // --- Episode & Group Breakdown Calculation ---
  public getEpisodeId(chainId: number, contractAddress: string, activityType: 'mint' | 'buy'): string {
    const cleanAddr = contractAddress.toLowerCase();
    const episodeDurationMs = (this.data.settings.episodeTimeoutHours || 24) * 3600 * 1000;
    const now = Date.now();

    // Check recent milestone for this contract/type to attach to ongoing episode
    const recentMilestones = this.data.alerts
      .filter(m => m.chainId === chainId && m.contractAddress.toLowerCase() === cleanAddr && m.activityType === activityType)
      .sort((a, b) => b.sentAt - a.sentAt);

    if (recentMilestones.length > 0) {
      const last = recentMilestones[0];
      if (now - last.sentAt < episodeDurationMs) {
        return last.episodeId;
      }
    }

    // New episode
    return `ep_${chainId}_${cleanAddr.substring(0, 8)}_${Math.floor(now / episodeDurationMs)}`;
  }

  public calculateGroupBreakdown(
    chainId: number,
    contractAddress: string,
    activityType: 'mint' | 'buy',
    sinceTimestamp?: number
  ): {
    uniqueWallets: string[];
    totalUniqueCount: number;
    totalNfts: number;
    totalPriceNative: number;
    groupBreakdown: GroupActivitySummary[];
  } {
    const activities = this.getActivitiesForProject(chainId, contractAddress, activityType, sinceTimestamp);
    const enabledGroupMap = new Map<string, WalletGroup>();
    for (const g of this.data.groups) {
      if (g.enabled) enabledGroupMap.set(g.id, g);
    }

    // Map wallet -> set of enabled group IDs
    const walletToGroups = new Map<string, string[]>();
    for (const w of this.data.wallets) {
      const activeGroups = w.groupIds.filter(gId => enabledGroupMap.has(gId));
      if (activeGroups.length > 0) {
        walletToGroups.set(w.address.toLowerCase(), activeGroups);
      }
    }

    // Filter activities to only enabled wallets
    const validActivities = activities.filter(a => walletToGroups.has(a.walletAddress.toLowerCase()));

    const uniqueWalletsSet = new Set<string>();
    let totalNfts = 0;
    let totalPriceNative = 0;

    // Per group aggregation
    const groupWallets = new Map<string, Set<string>>();
    const groupNfts = new Map<string, number>();

    for (const act of validActivities) {
      const addr = act.walletAddress.toLowerCase();
      uniqueWalletsSet.add(addr);
      totalNfts += (act.quantity || 1);
      if (act.priceNative) totalPriceNative += act.priceNative;

      const gIds = walletToGroups.get(addr) || [];
      for (const gId of gIds) {
        if (!groupWallets.has(gId)) groupWallets.set(gId, new Set());
        groupWallets.get(gId)!.add(addr);
        groupNfts.set(gId, (groupNfts.get(gId) || 0) + (act.quantity || 1));
      }
    }

    // Only include groups that have participating wallets
    const breakdown: GroupActivitySummary[] = [];
    for (const [gId, wallets] of groupWallets.entries()) {
      const grp = enabledGroupMap.get(gId);
      if (grp && wallets.size > 0) {
        breakdown.push({
          groupId: gId,
          groupName: grp.name,
          walletCount: wallets.size,
          nftCount: groupNfts.get(gId) || 0,
        });
      }
    }

    // Sort groups descending by wallet count
    breakdown.sort((a, b) => b.walletCount - a.walletCount);

    return {
      uniqueWallets: Array.from(uniqueWalletsSet),
      totalUniqueCount: uniqueWalletsSet.size,
      totalNfts,
      totalPriceNative,
      groupBreakdown: breakdown,
    };
  }

  // --- Alert Milestones & Persistence ---
  public getMilestonesForEpisode(episodeId: string): AlertMilestoneRecord[] {
    return this.data.alerts.filter(a => a.episodeId === episodeId).sort((a, b) => a.milestoneIndex - b.milestoneIndex);
  }

  public recordMilestone(milestone: AlertMilestoneRecord) {
    this.data.alerts.push(milestone);
    // Keep alerts capped to last 1,000 records to prevent unbounded disk growth
    if (this.data.alerts.length > 1000) {
      this.data.alerts = this.data.alerts.slice(-1000);
    }
    this.save();
  }

  public getRecentAlerts(limit = 20): AlertMilestoneRecord[] {
    return [...this.data.alerts].sort((a, b) => b.sentAt - a.sentAt).slice(0, limit);
  }

  // --- Bot Settings ---
  public getSettings(): AlertSettings {
    return { ...this.data.settings };
  }

  public updateSettings(updates: Partial<AlertSettings>): AlertSettings {
    Object.assign(this.data.settings, updates);
    this.save();
    return { ...this.data.settings };
  }

  // --- System Overview Metrics ---
  public getMetrics() {
    const enabledGroupIds = new Set(this.data.groups.filter(g => g.enabled).map(g => g.id));
    const enabledWallets = this.data.wallets.filter(w => w.groupIds.some(gId => enabledGroupIds.has(gId)));
    const uniqueEnabledAddresses = new Set(enabledWallets.map(w => w.address.toLowerCase()));

    return {
      totalGroups: this.data.groups.length,
      enabledGroups: enabledGroupIds.size,
      totalWallets: this.data.wallets.length,
      uniqueEnabledWallets: uniqueEnabledAddresses.size,
      totalNetworks: this.data.networks.length,
      connectedNetworks: this.data.networks.filter(n => n.isConnected && n.isEnabled).length,
      totalActivitiesTracked: this.data.activities.length,
      totalAlertsSent: this.data.alerts.length,
      isMonitoring: this.data.settings.isMonitoring,
      milestones: this.data.settings.milestones,
    };
  }

  // --- Backup & Restore ---
  public exportBackup(): { groups: WalletGroup[]; wallets: TrackedWallet[]; settings: AlertSettings; exportedAt: number } {
    return {
      groups: [...this.data.groups],
      wallets: [...this.data.wallets],
      settings: { ...this.data.settings },
      exportedAt: Date.now(),
    };
  }

  public restoreBackup(payload: { groups?: WalletGroup[]; wallets?: TrackedWallet[]; settings?: Partial<AlertSettings> }): { restoredGroups: number; restoredWallets: number } {
    if (payload.groups && Array.isArray(payload.groups)) {
      for (const g of payload.groups) {
        if (!g.name) continue;
        const trimmedName = g.name.trim();
        const existing = this.data.groups.find(x => x.id === g.id || x.name.toLowerCase() === trimmedName.toLowerCase());
        if (!existing) {
          this.data.groups.push({
            id: g.id || `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: trimmedName,
            description: g.description || '',
            enabled: g.enabled !== undefined ? g.enabled : true,
            createdAt: g.createdAt || Date.now(),
            updatedAt: g.updatedAt || Date.now(),
          });
        }
      }
    }

    if (payload.wallets && Array.isArray(payload.wallets)) {
      for (const w of payload.wallets) {
        if (!w.address || !Database.isValidAddress(w.address)) continue;
        const cleanAddr = w.address.trim().toLowerCase();
        const existingWallet = this.data.wallets.find(x => x.address.toLowerCase() === cleanAddr);
        if (existingWallet) {
          for (const gId of (w.groupIds || [])) {
            if (!existingWallet.groupIds.includes(gId)) {
              existingWallet.groupIds.push(gId);
            }
          }
          if (w.label && !existingWallet.label) {
            existingWallet.label = w.label;
          }
        } else {
          this.data.wallets.push({
            address: cleanAddr,
            label: w.label || '',
            groupIds: Array.isArray(w.groupIds) ? [...w.groupIds] : [],
            createdAt: w.createdAt || Date.now(),
          });
        }
      }
    }

    if (payload.settings && typeof payload.settings === 'object') {
      Object.assign(this.data.settings, payload.settings);
    }

    this.save();
    return {
      restoredGroups: this.data.groups.length,
      restoredWallets: this.data.wallets.length,
    };
  }
}

export const db = new Database();
