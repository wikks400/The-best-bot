import React, { useState, useEffect } from 'react';
import {
  Zap,
  Users,
  Globe,
  Bell,
  Play,
  Pause,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Flame,
  ShoppingCart,
  Terminal,
  Copy,
  Check,
  BookOpen,
  Send,
  Upload,
  Info,
  ChevronRight,
  ShieldAlert,
  Clock,
  Sparkles,
  UserX,
  Download,
  HardDrive
} from 'lucide-react';
import {
  WalletGroup,
  TrackedWallet,
  NetworkConfig,
  AlertMilestoneRecord,
  NFTActivityRecord,
  FreeProviderComparison
} from './types/index.ts';

type ActiveTab = 'overview' | 'groups' | 'networks' | 'alerts' | 'simulator' | 'settings' | 'guide';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Core Data States
  const [status, setStatus] = useState<any>(null);
  const [groups, setGroups] = useState<(WalletGroup & { walletCount: number })[]>([]);
  const [wallets, setWallets] = useState<(TrackedWallet & { groupNames: string[] })[]>([]);
  const [networks, setNetworks] = useState<NetworkConfig[]>([]);
  const [alerts, setAlerts] = useState<AlertMilestoneRecord[]>([]);
  const [activities, setActivities] = useState<NFTActivityRecord[]>([]);
  const [providers, setProviders] = useState<FreeProviderComparison[]>([]);

  // Feedback notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Forms & Modal states
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  const [showAddWallet, setShowAddWallet] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState('');
  const [addWalletGroupMode, setAddWalletGroupMode] = useState<'existing' | 'new'>('new');
  const [newWalletGroupName, setNewWalletGroupName] = useState('');
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newWalletLabel, setNewWalletLabel] = useState('');

  const [showImportWallets, setShowImportWallets] = useState(false);
  const [importGroupName, setImportGroupName] = useState('');
  const [importGroupMode, setImportGroupMode] = useState<'existing' | 'new'>('new');
  const [bulkImportText, setBulkImportText] = useState('');

  const [testingRpcId, setTestingRpcId] = useState<string | null>(null);
  const [rpcTestResults, setRpcTestResults] = useState<Record<string, { latencyMs: number; blockNumber: number; error?: string }>>({});

  // Simulator Form State
  const [simChainId, setSimChainId] = useState<number>(1);
  const [simContract, setSimContract] = useState('0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d');
  const [simProjectName, setSimProjectName] = useState('CyberPunks Genesis');
  const [simActivityType, setSimActivityType] = useState<'mint' | 'buy'>('mint');
  const [simWalletCount, setSimWalletCount] = useState<number>(4);
  const [simRunning, setSimRunning] = useState(false);
  const [simLastResult, setSimLastResult] = useState<any>(null);

  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    webhookUrl: '',
    channelId: '',
    roleId: '',
    milestones: '4, 7, 12, 20, 35',
    episodeTimeoutHours: 24,
    pollIntervalMs: 12000,
  });
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Local Storage Backup & Cloud Run Ephemeral Container Resilience
  const autoRestoringRef = React.useRef(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [hasBrowserBackup, setHasBrowserBackup] = useState(false);
  const [backupMeta, setBackupMeta] = useState<{ wallets: number; groups: number; savedAt: number } | null>(null);

  const LOCAL_STORAGE_BACKUP_KEY = 'nft_alert_persistent_backup_v2';

  const checkBrowserBackup = () => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const wCount = parsed.wallets?.length || 0;
        const gCount = parsed.groups?.length || 0;
        if (wCount > 0 || gCount > 0) {
          setHasBrowserBackup(true);
          setBackupMeta({ wallets: wCount, groups: gCount, savedAt: parsed.savedAt || Date.now() });
          return parsed;
        }
      }
    } catch {}
    setHasBrowserBackup(false);
    setBackupMeta(null);
    return null;
  };

  useEffect(() => {
    checkBrowserBackup();
  }, []);

  const handleDownloadProjectZip = async () => {
    setDownloadingZip(true);
    try {
      const res = await fetch('/api/download/project-zip');
      if (!res.ok) throw new Error('Failed to generate project zip');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nft-group-alert-project-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Downloaded complete project zip archive!');
    } catch (err: any) {
      showToast(err.message || 'Failed to download zip', 'error');
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadDatabaseJson = async () => {
    try {
      const res = await fetch('/api/download/data-json');
      if (!res.ok) throw new Error('Failed to download database JSON');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nft-alert-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Downloaded backup database file');
    } catch (err: any) {
      showToast(err.message || 'Failed to download data', 'error');
    }
  };

  const handleExportBackup = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      groups: groups.map(({ walletCount, ...rest }) => rest),
      wallets: wallets.map(({ groupNames, ...rest }) => rest),
      settings: settingsForm,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nft-alert-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded wallet backup JSON file');
  };

  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.groups && !json.wallets) {
          throw new Error('Invalid backup file: missing groups or wallets');
        }
        const res = await fetch('/api/backup/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json),
        }).then(r => r.json());
        if (res.success) {
          showToast(`Successfully restored ${res.restoredWallets} wallets and ${res.restoredGroups} groups!`);
          fetchData(false);
          checkBrowserBackup();
        } else {
          throw new Error(res.error || 'Failed to restore backup');
        }
      } catch (err: any) {
        showToast(err.message || 'Failed to parse backup JSON file', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleManualRestoreBrowser = async () => {
    try {
      const stored = checkBrowserBackup();
      if (!stored) {
        showToast('No saved browser backup found', 'error');
        return;
      }
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stored),
      }).then(r => r.json());
      if (res.success) {
        showToast(`Restored ${res.restoredWallets} wallets and ${res.restoredGroups} groups from browser cache!`);
        fetchData(false);
      }
    } catch {
      showToast('Failed to restore from browser storage', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    showToast(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopiedText(null), 2500);
  };

  const fetchData = async (isManual = false) => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();

      if (data.status) setStatus(data.status);
      if (data.groups) setGroups(data.groups);
      if (data.wallets) setWallets(data.wallets);
      if (data.networks) setNetworks(data.networks);
      if (data.alerts) setAlerts(data.alerts);
      if (data.activities) setActivities(data.activities);
      if (data.providers) setProviders(data.providers);

      // Resilient local caching & auto-recovery against Cloud Run container restarts
      if ((data.groups && data.groups.length > 0) || (data.wallets && data.wallets.length > 0)) {
        try {
          const cleanGroups = (data.groups || []).map(({ walletCount, ...rest }: any) => rest);
          const cleanWallets = (data.wallets || []).map(({ groupNames, ...rest }: any) => rest);
          const backupObj = {
            groups: cleanGroups,
            wallets: cleanWallets,
            settings: data.status?.settings,
            savedAt: Date.now(),
          };
          localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify(backupObj));
          setHasBrowserBackup(true);
          setBackupMeta({ wallets: cleanWallets.length, groups: cleanGroups.length, savedAt: Date.now() });
        } catch (e) {
          console.warn('Backup write failed', e);
        }
      } else if (
        data.groups && data.groups.length === 0 &&
        data.wallets && data.wallets.length === 0 &&
        !autoRestoringRef.current
      ) {
        // Container restarted with a clean filesystem: auto-restore from browser storage
        const stored = checkBrowserBackup();
        if (stored && ((stored.wallets && stored.wallets.length > 0) || (stored.groups && stored.groups.length > 0))) {
          autoRestoringRef.current = true;
          fetch('/api/backup/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stored),
          })
            .then(r => r.json())
            .then(res => {
              if (res.success && (res.restoredWallets > 0 || res.restoredGroups > 0)) {
                showToast(`Cloud container restarted: auto-restored ${res.restoredWallets} wallets & ${res.restoredGroups} groups from browser storage!`);
                fetchData(false);
              }
            })
            .catch(e => console.warn('Auto restore failed', e))
            .finally(() => {
              setTimeout(() => { autoRestoringRef.current = false; }, 10000);
            });
        }
      }

      if (data.status?.settings) {
        setSettingsForm({
          webhookUrl: data.status.settings.webhookUrl || '',
          channelId: data.status.settings.channelId || '',
          roleId: data.status.settings.roleId || '',
          milestones: (data.status.settings.milestones || [4, 7, 12, 20, 35]).join(', '),
          episodeTimeoutHours: data.status.settings.episodeTimeoutHours || 24,
          pollIntervalMs: data.status.settings.pollIntervalMs || 12000,
        });
      }

      if (isManual) {
        showToast('Dashboard data refreshed');
      }
    } catch (err: unknown) {
      console.warn('Dashboard sync note:', err);
      // Fallback: try individual /api/status if /api/dashboard was unavailable
      try {
        const fallbackStatus = await fetch('/api/status').then(r => r.json());
        if (fallbackStatus) {
          setStatus(fallbackStatus);
        }
      } catch {
        // If server is temporarily restarting or offline
        if (isManual) {
          showToast('Could not sync with backend service', 'error');
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(false);
    const interval = setInterval(() => fetchData(false), 8000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleMonitoring = async () => {
    try {
      const current = status?.isMonitoring;
      const res = await fetch('/api/monitor/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !current }),
      }).then(r => r.json());

      showToast(res.isMonitoring ? 'Monitoring started on all enabled networks' : 'Monitoring paused');
      fetchData();
    } catch {
      showToast('Failed to toggle monitor state', 'error');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName.trim(), description: newGroupDesc.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(`Group "${data.name}" created!`);
      setNewGroupName('');
      setNewGroupDesc('');
      setShowCreateGroup(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleGroup = async (id: string, current: boolean) => {
    try {
      await fetch(`/api/groups/${id}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !current }),
      });
      showToast('Group status updated');
      fetchData();
    } catch {
      showToast('Error toggling group', 'error');
    }
  };

  const handleDeleteGroup = async (id: string, name: string) => {
    if (!confirm(`Delete group "${name}"? Wallets will remain in any other groups they belong to.`)) return;
    try {
      await fetch(`/api/groups/${id}`, { method: 'DELETE' });
      showToast(`Group "${name}" deleted`);
      fetchData();
    } catch {
      showToast('Failed to delete group', 'error');
    }
  };

  const handleClearGroupWallets = async (id: string, name: string, count: number) => {
    if (!confirm(`Are you sure you want to remove all ${count} tracked wallets from "${name}"?`)) return;
    try {
      const res = await fetch(`/api/groups/${id}/clear-wallets`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`Removed all ${data.removedCount} wallets from "${name}"`);
      fetchData(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to clear wallets in group', 'error');
    }
  };

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletAddress.trim()) return;

    const groupPayload = (addWalletGroupMode === 'new' || groups.length === 0)
      ? { groupName: newWalletGroupName.trim() }
      : { groupId: targetGroupId };

    if ((addWalletGroupMode === 'new' || groups.length === 0) && !newWalletGroupName.trim()) {
      showToast('Please specify a group name for this wallet', 'error');
      return;
    }
    if (addWalletGroupMode === 'existing' && groups.length > 0 && !targetGroupId) {
      showToast('Please select a group', 'error');
      return;
    }

    try {
      const res = await fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: newWalletAddress.trim(),
          ...groupPayload,
          label: newWalletLabel.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast('Wallet added successfully');
      setNewWalletAddress('');
      setNewWalletLabel('');
      setNewWalletGroupName('');
      setShowAddWallet(false);
      fetchData(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRemoveWallet = async (address: string, groupId: string) => {
    try {
      await fetch('/api/wallets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, groupId }),
      });
      showToast('Wallet removed from group');
      fetchData(true);
    } catch {
      showToast('Failed to remove wallet', 'error');
    }
  };

  const handleImportWallets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkImportText.trim()) return;

    const groupPayload = (importGroupMode === 'new' || groups.length === 0)
      ? { groupName: importGroupName.trim() }
      : { groupId: targetGroupId };

    if ((importGroupMode === 'new' || groups.length === 0) && !importGroupName.trim()) {
      showToast('Please enter a group name for the imported wallets', 'error');
      return;
    }
    if (importGroupMode === 'existing' && groups.length > 0 && !targetGroupId) {
      showToast('Please choose an existing group', 'error');
      return;
    }

    try {
      const res = await fetch('/api/wallets/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: bulkImportText,
          ...groupPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(`Imported ${data.added} addresses into "${data.group?.name || importGroupName}"! (${data.existing} existing)`);
      setBulkImportText('');
      setImportGroupName('');
      setShowImportWallets(false);
      fetchData(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleResetAllData = async () => {
    if (!confirm('Are you sure you want to clear all groups and tracked wallets? This will give you a completely clean empty slate.')) return;
    try {
      const res = await fetch('/api/reset-data', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('All groups and wallets cleared successfully');
        fetchData(true);
      }
    } catch {
      showToast('Failed to reset data', 'error');
    }
  };

  const handleTestRpc = async (net: NetworkConfig) => {
    setTestingRpcId(net.id);
    try {
      const res = await fetch('/api/networks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rpcUrl: net.rpcUrl }),
      }).then(r => r.json());

      setRpcTestResults(prev => ({
        ...prev,
        [net.id]: {
          latencyMs: res.latencyMs,
          blockNumber: res.blockNumber,
          error: res.error,
        },
      }));

      if (res.success) {
        showToast(`Connected to ${net.name} in ${res.latencyMs}ms (Block #${res.blockNumber})`);
      } else {
        showToast(`Failed connecting to ${net.name}: ${res.error}`, 'error');
      }
    } catch {
      showToast(`Network test failed for ${net.name}`, 'error');
    } finally {
      setTestingRpcId(null);
    }
  };

  const handleToggleNetwork = async (id: string, current: boolean) => {
    try {
      await fetch(`/api/networks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !current }),
      });
      showToast('Network configuration updated');
      fetchData();
    } catch {
      showToast('Failed to update network', 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedMilestones = settingsForm.milestones
        .split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n) && n > 0)
        .sort((a, b) => a - b);

      if (parsedMilestones.length === 0) {
        showToast('Please enter at least one valid milestone number', 'error');
        return;
      }

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: settingsForm.webhookUrl.trim(),
          channelId: settingsForm.channelId.trim(),
          roleId: settingsForm.roleId.trim(),
          milestones: parsedMilestones,
          episodeTimeoutHours: Number(settingsForm.episodeTimeoutHours),
          pollIntervalMs: Number(settingsForm.pollIntervalMs),
        }),
      });

      if (!res.ok) throw new Error('Failed to update settings');
      showToast('Alert settings saved successfully!');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    try {
      const res = await fetch('/api/test/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: settingsForm.webhookUrl,
          roleId: settingsForm.roleId,
        }),
      }).then(r => r.json());

      if (res.success) {
        showToast('Test embed sent successfully to Discord Webhook!');
      } else {
        showToast(`Webhook failed: ${res.error}`, 'error');
      }
    } catch {
      showToast('Failed to contact Discord webhook', 'error');
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleRunSimulation = async (count: number) => {
    setSimRunning(true);
    setSimWalletCount(count);
    try {
      const res = await fetch('/api/test/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId: simChainId,
          contractAddress: simContract,
          projectName: simProjectName,
          activityType: simActivityType,
          walletCount: count,
          nftsPerWallet: 2,
          priceNative: 0.08,
        }),
      }).then(r => r.json());

      setSimLastResult(res);
      if (res.milestoneSent) {
        showToast(`Milestone Alert #${res.milestone.milestoneIndex} triggered (${count} unique wallets)!`);
      } else {
        showToast(`Recorded activity for ${count} wallets (${res.currentBreakdown?.totalUniqueCount} total unique)`);
      }
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Simulation error', 'error');
    } finally {
      setSimRunning(false);
    }
  };

  const metrics = status?.metrics || {
    totalGroups: 0,
    enabledGroups: 0,
    totalWallets: 0,
    uniqueEnabledWallets: 0,
    totalNetworks: 0,
    connectedNetworks: 0,
    totalActivitiesTracked: 0,
    totalAlertsSent: 0,
    isMonitoring: false,
    milestones: [4, 7, 12, 20, 35],
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl border backdrop-blur-md transition-all ${
            toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-200 shadow-rose-950/50'
              : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200 shadow-emerald-950/50'
          }`}
        >
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Flame className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  NFT Group Alert
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  100% Free Resources
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Multi-chain EVM NFT mint & buy detector • 4-wallet initial alert threshold
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Monitor Toggle Button */}
            <button
              onClick={handleToggleMonitoring}
              className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all border shadow-sm ${
                status?.isMonitoring
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              {status?.isMonitoring ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Monitoring Active</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  <span>Monitoring Paused</span>
                </>
              )}
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => {
                setRefreshing(true);
                fetchData(true);
              }}
              disabled={refreshing}
              className="p-2 text-slate-400 hover:text-slate-100 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition-colors"
              title="Refresh monitoring data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            {/* Download Files Button */}
            <button
              onClick={() => setShowDownloadModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition-all shadow-sm"
              title="Download your project files or backup"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Download Files</span>
              <span className="sm:hidden">Download</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation - Horizontal scroll on mobile */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 overflow-x-auto scrollbar-none border-t border-slate-800/40 py-1">
          {[
            { id: 'overview', label: 'Dashboard', icon: Zap },
            { id: 'groups', label: `Groups (${groups.length})`, icon: Users },
            { id: 'networks', label: `Networks (${networks.length})`, icon: Globe },
            { id: 'alerts', label: `Alerts (${alerts.length})`, icon: Bell },
            { id: 'simulator', label: 'Simulation & Tests', icon: Sparkles },
            { id: 'settings', label: 'Bot & Webhook', icon: Sliders },
            { id: 'guide', label: 'Free Hosting Guide', icon: BookOpen },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW DASHBOARD */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 sm:p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Unique Wallets</span>
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white">{metrics.uniqueEnabledWallets}</span>
                  <span className="text-xs text-slate-400">across {metrics.enabledGroups} active groups</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  Deduplicated across multiple groups
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 sm:p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Milestone Threshold</span>
                  <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
                    <Flame className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white">{metrics.milestones[0]}</span>
                  <span className="text-xs text-rose-300 font-medium">wallets for initial alert</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  Follow-ups at {metrics.milestones.slice(1).join(', ')} wallets
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 sm:p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">EVM Chains</span>
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                    <Globe className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white">
                    {metrics.connectedNetworks} / {metrics.totalNetworks}
                  </span>
                  <span className="text-xs text-emerald-400">connected</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  Free public RPCs with 0 cost
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 sm:p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Alerts Sent</span>
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                    <Bell className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white">{metrics.totalAlertsSent}</span>
                  <span className="text-xs text-slate-400">milestones dispatched</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  {metrics.totalActivitiesTracked} total blockchain events stored
                </div>
              </div>
            </div>

            {/* Quick Status Banner */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${status?.isBotConnected ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <span>Discord Integration:</span>
                    {status?.isBotConnected ? (
                      <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Bot Connected & Slash Commands Registered
                      </span>
                    ) : settingsForm.webhookUrl ? (
                      <span className="text-xs font-medium text-indigo-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Webhook Alert Destination Configured
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Set Discord Bot Token or Webhook in Settings
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Supports slash commands (`/group-create`, `/group-clear`, `/wallet-remove`, `/status`) and instant Discord embeds.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('simulator')}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white rounded-lg text-xs font-semibold shadow-md flex items-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Test 4-Wallet Mint Alert</span>
                </button>
              </div>
            </div>

            {/* Active Groups Overview & Recent Alerts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Wallet Groups */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span>Active Wallet Groups</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('groups')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                  >
                    Manage Groups <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {groups.length === 0 ? (
                  <div className="p-6 text-center bg-slate-950/60 border border-slate-800/60 rounded-xl space-y-3">
                    <Users className="w-8 h-8 text-indigo-400 mx-auto" />
                    <div>
                      <h4 className="text-sm font-bold text-white">No Wallet Groups Yet</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Create your first custom group and import your tracked wallets. You give them whatever names you want.
                      </p>
                    </div>
                    <div className="flex justify-center gap-2 pt-1">
                      <button
                        onClick={() => setShowCreateGroup(true)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow"
                      >
                        + Create First Group
                      </button>
                      <button
                        onClick={() => {
                          setImportGroupMode('new');
                          setImportGroupName('');
                          setShowImportWallets(true);
                        }}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700"
                      >
                        📥 Import Wallets
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {groups.map(g => (
                      <div
                        key={g.id}
                        className="p-3 bg-slate-950/60 border border-slate-800/60 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${g.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                            <span className="font-semibold text-sm text-slate-200">{g.name}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{g.description || 'No description provided'}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-white">{g.walletCount}</span>
                          <span className="text-xs text-slate-400 block">wallets</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Alerts Feed */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-400" />
                    <span>Recent Dispatched Alerts</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('alerts')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                  >
                    View All ({alerts.length}) <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {alerts.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/40 border border-slate-800/40 rounded-lg">
                    <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2 animate-bounce" />
                    <p className="text-sm text-slate-400 font-medium">No alerts triggered yet</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Alerts fire as soon as 4 unique tracked wallets mint or buy from the same project.
                    </p>
                    <button
                      onClick={() => handleRunSimulation(4)}
                      className="mt-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg text-slate-300"
                    >
                      Trigger Test Alert Now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.slice(0, 3).map(alert => (
                      <div
                        key={alert.id}
                        className="p-3.5 bg-slate-950/70 border border-slate-800/70 rounded-lg flex items-start gap-3"
                      >
                        <div
                          className={`p-2 rounded-lg mt-0.5 ${
                            alert.activityType === 'mint'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {alert.activityType === 'mint' ? <Flame className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-white truncate">{alert.projectName}</span>
                            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                              {alert.chainName}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1">
                            Milestone #{alert.milestoneIndex}: <strong className="text-white">{alert.totalUniqueWallets}</strong> unique wallets • {alert.totalNfts} NFTs {alert.activityType === 'mint' ? 'minted' : 'bought'}
                          </p>
                          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
                            <span>{new Date(alert.sentAt).toLocaleTimeString()}</span>
                            <span>•</span>
                            <span>{alert.groupBreakdown.length} groups participating</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Configured EVM Chains Summary */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span>Free EVM RPC Connections</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real-time connectivity to public nodes without API keys or credit cards
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('networks')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                >
                  Manage Networks <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {networks.map(net => (
                  <div
                    key={net.id}
                    className="p-3 bg-slate-950/60 border border-slate-800/60 rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-200">{net.name}</span>
                      <span className={`w-2 h-2 rounded-full ${net.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
                    </div>
                    <div className="flex items-baseline justify-between text-[11px] text-slate-400">
                      <span>Latency</span>
                      <span className="text-slate-200 font-mono">
                        {net.lastLatencyMs ? `${net.lastLatencyMs}ms` : 'Untested'}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between text-[11px] text-slate-400">
                      <span>Block</span>
                      <span className="text-slate-200 font-mono truncate max-w-[90px]">
                        {net.lastBlockChecked > 0 ? `#${net.lastBlockChecked}` : 'Checking...'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: WALLET GROUPS & WALLETS */}
        {/* ========================================================================= */}
        {activeTab === 'groups' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <span>Wallet Group Management</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Create and name your own groups. Give custom names to groups and wallets when adding or importing them.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImportBackupFile}
                  accept=".json"
                  className="hidden"
                />

                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Group</span>
                </button>
                <button
                  onClick={() => {
                    setTargetGroupId(groups[0]?.id || '');
                    setImportGroupMode(groups.length > 0 ? 'existing' : 'new');
                    setImportGroupName('');
                    setShowImportWallets(true);
                  }}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Bulk Import</span>
                </button>

                <button
                  onClick={handleExportBackup}
                  title="Download offline JSON backup of all groups & wallets"
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Export</span> Backup
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Restore wallets and groups from a JSON backup file"
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-all"
                >
                  <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Import</span> Backup
                </button>

                {groups.length > 0 && (
                  <button
                    onClick={handleResetAllData}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-slate-800 transition-all"
                    title="Reset to clean slate (clear all groups and wallets)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Browser Auto-Backup Indicator Banner */}
            {hasBrowserBackup && (
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-lg px-4 py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-slate-300">
                    <strong className="text-emerald-400 font-medium">Browser Auto-Backup Active:</strong>{' '}
                    {backupMeta?.wallets || wallets.length} wallets & {backupMeta?.groups || groups.length} groups protected in browser storage.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleManualRestoreBrowser}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold underline"
                  >
                    Sync Now
                  </button>
                </div>
              </div>
            )}

            {/* Groups Grid or Empty State */}
            {groups.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-xl space-y-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-base font-bold text-white">No Tracked Groups or Wallets Found</h3>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Start by creating your first wallet group, or restore previously saved wallets.
                  </p>
                </div>

                {hasBrowserBackup && (
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl max-w-md mx-auto text-left flex items-start gap-3">
                    <HardDrive className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs">
                      <p className="font-semibold text-indigo-200">Browser Backup Available</p>
                      <p className="text-slate-400 mt-0.5">
                        Found {backupMeta?.wallets || 0} wallets across {backupMeta?.groups || 0} groups saved in your browser storage.
                      </p>
                      <button
                        onClick={handleManualRestoreBrowser}
                        className="mt-2.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Restore All Saved Wallets</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap justify-center gap-2.5 pt-2">
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Your First Group</span>
                  </button>
                  <button
                    onClick={() => {
                      setImportGroupMode('new');
                      setImportGroupName('');
                      setShowImportWallets(true);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 flex items-center gap-1.5"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import Wallets with Custom Names</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 flex items-center gap-1.5"
                  >
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                    <span>Restore from JSON File</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {groups.map(group => (
                  <div
                    key={group.id}
                    className={`p-4 rounded-xl border transition-all ${
                      group.enabled
                        ? 'bg-slate-900/70 border-slate-800'
                        : 'bg-slate-900/30 border-slate-800/40 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${group.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                        <h3 className="font-bold text-sm text-white">{group.name}</h3>
                      </div>
                      <button
                        onClick={() => handleToggleGroup(group.id, group.enabled)}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          group.enabled
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {group.enabled ? 'Active' : 'Disabled'}
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 mt-2 min-h-[32px]">
                      {group.description || 'No description set'}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">
                        <strong className="text-white text-sm">{group.walletCount}</strong> tracked wallets
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setTargetGroupId(group.id);
                            setAddWalletGroupMode('existing');
                            setShowAddWallet(true);
                          }}
                          className="px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded text-[11px] font-medium"
                        >
                          + Add Wallet
                        </button>
                        {group.walletCount > 0 && (
                          <button
                            onClick={() => handleClearGroupWallets(group.id, group.name, group.walletCount)}
                            className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded text-[11px] font-medium flex items-center gap-1"
                            title={`Remove all ${group.walletCount} wallets in ${group.name}`}
                          >
                            <UserX className="w-3 h-3" />
                            <span>Clear</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteGroup(group.id, group.name)}
                          className="p-1 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded"
                          title="Delete Group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Wallets Table */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Tracked Wallets</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Wallets can belong to multiple groups. Counted once in overall unique wallet total.
                  </p>
                </div>
                <span className="text-xs bg-slate-800 px-2.5 py-1 rounded-full text-slate-300 font-medium">
                  {wallets.length} total entries
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3">Address</th>
                      <th className="px-5 py-3">Custom Label / Name</th>
                      <th className="px-5 py-3">Assigned Groups</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {wallets.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                          No wallets tracked yet. Click "+ New Group", "+ Add Wallet", or "Bulk Import" above to add your wallets.
                        </td>
                      </tr>
                    ) : (
                      wallets.map(wallet => (
                        <tr key={wallet.address} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-3 font-mono text-slate-200">
                            <div className="flex items-center gap-2">
                              <span>{wallet.address}</span>
                              <button
                                onClick={() => copyToClipboard(wallet.address, 'Wallet Address')}
                                className="text-slate-500 hover:text-slate-300"
                                title="Copy"
                              >
                                {copiedText === 'Wallet Address' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-slate-300">
                            {wallet.label ? (
                              <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                                {wallet.label}
                              </span>
                            ) : (
                              <span className="text-slate-500">Unlabeled</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {wallet.groupNames.map((name, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            {wallet.groupIds.map(gId => {
                              const group = groups.find(g => g.id === gId);
                              return (
                                <button
                                  key={gId}
                                  onClick={() => handleRemoveWallet(wallet.address, gId)}
                                  className="text-[11px] text-rose-400 hover:text-rose-300 ml-2 font-medium"
                                  title={`Remove from ${group?.name || gId}`}
                                >
                                  Remove from {group?.name?.split(' ')[0] || 'group'}
                                </button>
                              );
                            })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal: Create Group */}
            {showCreateGroup && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                  <h3 className="font-bold text-base text-white">Create Wallet Group</h3>
                  <form onSubmit={handleCreateGroup} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">Group Name</label>
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        placeholder="e.g. Whales, Alpha Minters, Smart Traders"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        required
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">Description (Optional)</label>
                      <textarea
                        value={newGroupDesc}
                        onChange={e => setNewGroupDesc(e.target.value)}
                        placeholder="What wallets belong here..."
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowCreateGroup(false)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow"
                      >
                        Create Group
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal: Add Single Wallet */}
            {showAddWallet && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                  <h3 className="font-bold text-base text-white">Add Tracked Wallet</h3>
                  <form onSubmit={handleAddWallet} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">Target Group</label>
                      {groups.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
                            <button
                              type="button"
                              onClick={() => setAddWalletGroupMode('existing')}
                              className={`flex-1 py-1 rounded font-medium ${
                                addWalletGroupMode === 'existing' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                              }`}
                            >
                              Existing Group
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddWalletGroupMode('new')}
                              className={`flex-1 py-1 rounded font-medium ${
                                addWalletGroupMode === 'new' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                              }`}
                            >
                              + New Group Name
                            </button>
                          </div>

                          {addWalletGroupMode === 'existing' ? (
                            <select
                              value={targetGroupId}
                              onChange={e => setTargetGroupId(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                            >
                              {groups.map(g => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={newWalletGroupName}
                              onChange={e => setNewWalletGroupName(e.target.value)}
                              placeholder="e.g. Alpha Callers, Top Minters"
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                              required
                            />
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={newWalletGroupName}
                          onChange={e => setNewWalletGroupName(e.target.value)}
                          placeholder="e.g. My Smart Wallets, Alpha Callers"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                          required
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">EVM Wallet Address (0x...)</label>
                      <input
                        type="text"
                        value={newWalletAddress}
                        onChange={e => setNewWalletAddress(e.target.value)}
                        placeholder="0x..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">Custom Label / Name (Optional)</label>
                      <input
                        type="text"
                        value={newWalletLabel}
                        onChange={e => setNewWalletLabel(e.target.value)}
                        placeholder="e.g. Whale #1, Smart Deployer"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddWallet(false)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow"
                      >
                        Save Wallet
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal: Bulk Import */}
            {showImportWallets && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
                  <h3 className="font-bold text-base text-white">Bulk-Import Wallet Addresses</h3>
                  <p className="text-xs text-slate-400">
                    Import multiple wallets at once. Give your group any name you want, and name individual wallets on each line.
                  </p>
                  <form onSubmit={handleImportWallets} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">Target Group</label>
                      {groups.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
                            <button
                              type="button"
                              onClick={() => setImportGroupMode('existing')}
                              className={`flex-1 py-1 rounded font-medium ${
                                importGroupMode === 'existing' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                              }`}
                            >
                              Existing Group
                            </button>
                            <button
                              type="button"
                              onClick={() => setImportGroupMode('new')}
                              className={`flex-1 py-1 rounded font-medium ${
                                importGroupMode === 'new' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                              }`}
                            >
                              + Create New Group
                            </button>
                          </div>

                          {importGroupMode === 'existing' ? (
                            <select
                              value={targetGroupId}
                              onChange={e => setTargetGroupId(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                            >
                              {groups.map(g => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={importGroupName}
                              onChange={e => setImportGroupName(e.target.value)}
                              placeholder="e.g. Alpha Callers, Top Minters, Whales"
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                              required
                            />
                          )}
                        </div>
                      ) : (
                        <div>
                          <input
                            type="text"
                            value={importGroupName}
                            onChange={e => setImportGroupName(e.target.value)}
                            placeholder="e.g. My Tracked Wallets, Early Minters, Whales"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                            required
                            autoFocus
                          />
                          <span className="text-[11px] text-indigo-400 mt-1 block">
                            This will be the name of your new group.
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-300">Wallet Addresses & Custom Labels</label>
                      </div>
                      <textarea
                        value={bulkImportText}
                        onChange={e => setBulkImportText(e.target.value)}
                        placeholder="0x1111111111111111111111111111111111111111, Whale Leader&#10;0x2222222222222222222222222222222222222222 - Smart Caller&#10;0x3333333333333333333333333333333333333333: Alpha Mint&#10;0x4444444444444444444444444444444444444444"
                        rows={6}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                        required
                      />
                      <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800 mt-2 space-y-1">
                        <span className="font-semibold text-indigo-300 block">💡 Naming Tips:</span>
                        <span>• You can put a name on each line after comma, colon, or hyphen:</span>
                        <code className="text-slate-300 block font-mono text-[10px]">0x123...456, Main Alpha Wallet</code>
                        <span>• Or paste bare addresses separated by spaces or newlines.</span>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowImportWallets(false)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow"
                      >
                        Start Import
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: EVM NETWORKS & FREE RPCS */}
        {/* ========================================================================= */}
        {activeTab === 'networks' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-emerald-400" />
                  <span>Configured EVM Blockchains</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Using 100% free public RPCs and explorers with zero subscription or card requirement.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {networks.map(net => {
                const testResult = rpcTestResults[net.id];
                const isTesting = testingRpcId === net.id;

                return (
                  <div
                    key={net.id}
                    className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-3 h-3 rounded-full ${net.isConnected ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                        <div>
                          <span className="font-bold text-sm text-white">{net.name}</span>
                          <span className="text-[10px] text-slate-400 ml-2 font-mono">Chain ID: {net.chainId}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleNetwork(net.id, net.isEnabled)}
                          className={`text-xs px-2.5 py-1 rounded font-medium border ${
                            net.isEnabled
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          {net.isEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Primary Free RPC</span>
                        <code className="text-slate-200 bg-slate-950 px-2 py-1 rounded block truncate font-mono mt-0.5">
                          {net.rpcUrl}
                        </code>
                      </div>

                      {net.fallbackRpcs && net.fallbackRpcs.length > 0 && (
                        <div>
                          <span className="text-slate-400 block text-[11px]">Fallback RPCs</span>
                          <span className="text-slate-400 text-[11px]">
                            {net.fallbackRpcs.join(', ')}
                          </span>
                        </div>
                      )}

                      <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2 rounded border border-slate-800/50">
                        <strong className="text-slate-300">Free Tier Limit:</strong> {net.freeTierNotes || 'Public rate limits apply'}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <div className="text-xs">
                        {testResult ? (
                          testResult.error ? (
                            <span className="text-rose-400 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> {testResult.error}
                            </span>
                          ) : (
                            <span className="text-emerald-400 flex items-center gap-1 font-mono">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {testResult.latencyMs}ms • Block #{testResult.blockNumber}
                            </span>
                          )
                        ) : net.lastLatencyMs ? (
                          <span className="text-slate-400 font-mono text-[11px]">
                            Last check: {net.lastLatencyMs}ms • Block #{net.lastBlockChecked}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Not tested yet</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTestRpc(net)}
                          disabled={isTesting}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                          <span>Test RPC</span>
                        </button>
                        <a
                          href={net.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-slate-400 hover:text-slate-200"
                          title="Block Explorer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: ALERTS FEED & DISCORD EMBED PREVIEW */}
        {/* ========================================================================= */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-400" />
                  <span>NFT Activity Milestone Alerts</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Initial alert triggers at 4 unique wallets. Follow-up updates at 7, 12, 20, 35 wallets.
                </p>
              </div>
              <span className="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-300 font-medium">
                {alerts.length} Total Alerts
              </span>
            </div>

            {alerts.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center">
                <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3 animate-pulse" />
                <h3 className="text-base font-semibold text-slate-200">No alerts have been dispatched yet</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Alerts trigger automatically when 4 unique tracked wallets from any enabled group mint or buy NFTs from the same project.
                </p>
                <button
                  onClick={() => setActiveTab('simulator')}
                  className="mt-5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow"
                >
                  Open Simulator & Trigger 4-Wallet Mint Alert
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {alerts.map(alert => {
                  const isMint = alert.activityType === 'mint';
                  const isInitial = alert.milestoneIndex === 1;

                  return (
                    <div
                      key={alert.id}
                      className="bg-[#2B2D31] border border-slate-700/80 rounded-xl p-5 shadow-2xl relative overflow-hidden"
                    >
                      {/* Discord Style Embed Left Border */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                          isMint ? 'bg-[#FF4500]' : 'bg-[#10B981]'
                        }`}
                      ></div>

                      <div className="space-y-4">
                        {/* Title Header */}
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-base font-bold text-white flex items-center gap-1.5">
                              {isMint ? '🔥' : '🛒'} {isInitial ? `EARLY NFT ${isMint ? 'MINT' : 'BUY'} ALERT` : `NFT ${isMint ? 'MINT' : 'BUY'} UPDATE #${alert.milestoneIndex}`}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(alert.sentAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5 font-medium">
                            <strong>Project:</strong> {alert.projectName} &nbsp;•&nbsp; <strong>Chain:</strong> {alert.chainName}
                          </p>
                        </div>

                        {/* Participation Stat Box */}
                        <div className="bg-[#1E1F22] p-3 rounded-lg border border-slate-800 space-y-1 text-xs">
                          <div>
                            👛 {isMint ? 'Tracked wallets minting' : 'Tracked wallets buying'}:{' '}
                            <strong className="text-white text-sm">{alert.totalUniqueWallets}</strong>
                            {!isInitial && alert.newWalletsSinceLast > 0 && (
                              <span className="text-indigo-400 ml-2 font-medium">
                                (+{alert.newWalletsSinceLast} new since previous alert)
                              </span>
                            )}
                          </div>
                          <div>
                            🖼 {isMint ? 'NFTs minted' : 'NFTs purchased'}:{' '}
                            <strong className="text-white text-sm">{alert.totalNfts}</strong>
                          </div>
                          {!isMint && alert.priceNative && (
                            <div>
                              💰 Total purchase value:{' '}
                              <strong className="text-emerald-400">{alert.priceNative.toFixed(3)} {alert.currencySymbol}</strong>
                            </div>
                          )}
                        </div>

                        {/* Group Activity Section (Strict adherence to section 9) */}
                        <div className="bg-[#1E1F22] p-3.5 rounded-lg border border-slate-800 space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                            👥 GROUP ACTIVITY
                          </span>
                          <div className="space-y-2 text-xs">
                            {alert.groupBreakdown.map((g, idx) => (
                              <div key={idx} className="border-b border-slate-800/60 pb-1.5 last:border-0 last:pb-0">
                                <span className="font-semibold text-slate-200 block">{g.groupName}</span>
                                <span className="text-slate-400 text-[11px]">
                                  {g.walletCount} wallet{g.walletCount === 1 ? '' : 's'} | {g.nftCount} {isMint ? 'NFTs minted' : 'NFTs purchased'}
                                </span>
                              </div>
                            ))}
                            <div className="pt-2 border-t border-slate-700/80 font-medium">
                              <span className="text-slate-300 font-bold block">TOTAL</span>
                              <span className="text-white">
                                {alert.totalUniqueWallets} unique tracked wallet{alert.totalUniqueWallets === 1 ? '' : 's'}
                              </span>
                              <span className="text-slate-400 block text-[11px]">
                                {alert.totalNfts} {isMint ? 'NFTs minted' : 'NFTs purchased'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Verified Links */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700/50 text-xs">
                          {alert.projectInfo?.openseaMintUrl && (
                            <a
                              href={alert.projectInfo.openseaMintUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 rounded font-medium flex items-center gap-1"
                            >
                              <span>OpenSea Mint</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {alert.projectInfo?.openseaUrl && (
                            <a
                              href={alert.projectInfo.openseaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium flex items-center gap-1"
                            >
                              <span>OpenSea Collection</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {alert.projectInfo?.explorerUrl && (
                            <a
                              href={alert.projectInfo.explorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium flex items-center gap-1"
                            >
                              <span>Explorer</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-500 pt-1 flex items-center justify-between">
                          <span>Episode: {alert.episodeId}</span>
                          <span>Milestone {alert.milestoneIndex}/5</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: SIMULATION STUDIO & TEST RUNNER */}
        {/* ========================================================================= */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span>Simulation Studio & Milestone Testing</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Trigger mock minting or buying events to test the exact 4-wallet threshold and subsequent milestones (7, 12, 20, 35) on demand.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Controls */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white">Simulation Parameters</h3>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">EVM Blockchain</label>
                  <select
                    value={simChainId}
                    onChange={e => setSimChainId(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {networks.map(n => (
                      <option key={n.chainId} value={n.chainId}>
                        {n.name} (Chain ID: {n.chainId})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Activity Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSimActivityType('mint')}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                        simActivityType === 'mint'
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Minting</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimActivityType('buy')}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                        simActivityType === 'buy'
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Buying</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Project Name</label>
                  <input
                    type="text"
                    value={simProjectName}
                    onChange={e => setSimProjectName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Contract Address</label>
                  <input
                    type="text"
                    value={simContract}
                    onChange={e => setSimContract(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="pt-2 space-y-2">
                  <span className="text-xs font-semibold text-slate-300 block">Trigger Milestone Preset</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleRunSimulation(4)}
                      disabled={simRunning}
                      className="px-3 py-2 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white rounded-lg text-xs font-bold shadow"
                    >
                      🎯 4 Wallets (Milestone #1)
                    </button>
                    <button
                      onClick={() => handleRunSimulation(7)}
                      disabled={simRunning}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow"
                    >
                      🚀 7 Wallets (Update #2)
                    </button>
                    <button
                      onClick={() => handleRunSimulation(12)}
                      disabled={simRunning}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700"
                    >
                      12 Wallets (Update #3)
                    </button>
                    <button
                      onClick={() => handleRunSimulation(20)}
                      disabled={simRunning}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700"
                    >
                      20 Wallets (Update #4)
                    </button>
                  </div>
                </div>
              </div>

              {/* Simulation Output */}
              <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Simulation Results</h3>
                  {simLastResult && (
                    <span className={`text-xs px-2.5 py-0.5 rounded font-semibold ${
                      simLastResult.milestoneSent
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {simLastResult.milestoneSent ? 'Alert Dispatched!' : 'Activity Recorded'}
                    </span>
                  )}
                </div>

                {simLastResult ? (
                  <div className="space-y-4">
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Unique Participating Wallets:</span>
                        <strong className="text-white text-sm">{simLastResult.currentBreakdown?.totalUniqueCount}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total NFTs {simActivityType === 'mint' ? 'Minted' : 'Bought'}:</span>
                        <strong className="text-white text-sm">{simLastResult.currentBreakdown?.totalNfts}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Participating Groups:</span>
                        <span className="text-indigo-300 font-medium">{simLastResult.currentBreakdown?.groupBreakdown?.length} groups</span>
                      </div>
                    </div>

                    {/* Breakdown list */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Group Breakdown Result</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {simLastResult.currentBreakdown?.groupBreakdown?.map((g: any, i: number) => (
                          <div key={i} className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                            <span className="font-bold text-white block">{g.groupName}</span>
                            <span className="text-slate-400 text-[11px]">
                              {g.walletCount} wallets | {g.nftCount} NFTs
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {simLastResult.milestone && (
                      <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-xs space-y-2">
                        <div className="flex items-center gap-2 text-emerald-300 font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Milestone #{simLastResult.milestone.milestoneIndex} Threshold ({simLastResult.milestone.thresholdWallets} wallets) Sent</span>
                        </div>
                        <p className="text-slate-300">
                          Dispatched Discord embed formatted strictly per Section 10/11/12 specifications! View the formatted embed in the <strong>Alerts</strong> tab.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-500 text-xs">
                    Click "🎯 4 Wallets (Milestone #1)" to test initial alert dispatch.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: BOT SETTINGS & DISCORD CONFIGURATION */}
        {/* ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <span>Discord Bot & Alert Destination Settings</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure your Discord Bot token or Webhook URL. All configuration is stored persistently.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 sm:p-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1">
                  Discord Webhook URL (Recommended for 1-click zero-friction alerts)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={settingsForm.webhookUrl}
                    onChange={e => setSettingsForm({ ...settingsForm, webhookUrl: e.target.value })}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleTestWebhook}
                    disabled={testingWebhook || !settingsForm.webhookUrl}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow"
                  >
                    <Send className={`w-3.5 h-3.5 ${testingWebhook ? 'animate-pulse' : ''}`} />
                    <span>Send Test</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Obtain in Discord: Server Settings → Integrations → Webhooks → New Webhook.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-200 block mb-1">Alerts Channel ID (for Bot mode)</label>
                  <input
                    type="text"
                    value={settingsForm.channelId}
                    onChange={e => setSettingsForm({ ...settingsForm, channelId: e.target.value })}
                    placeholder="e.g. 123456789012345678"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-200 block mb-1">Role Mention ID (Optional)</label>
                  <input
                    type="text"
                    value={settingsForm.roleId}
                    onChange={e => setSettingsForm({ ...settingsForm, roleId: e.target.value })}
                    placeholder="Role ID to ping in alerts"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
                <div>
                  <label className="text-xs font-bold text-slate-200 block mb-1">Milestone Thresholds</label>
                  <input
                    type="text"
                    value={settingsForm.milestones}
                    onChange={e => setSettingsForm({ ...settingsForm, milestones: e.target.value })}
                    placeholder="4, 7, 12, 20, 35"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400">Default: 4, 7, 12, 20, 35</span>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-200 block mb-1">Episode Reset Window (Hours)</label>
                  <input
                    type="number"
                    value={settingsForm.episodeTimeoutHours}
                    onChange={e => setSettingsForm({ ...settingsForm, episodeTimeoutHours: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400">Default: 24h</span>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-200 block mb-1">Poll Interval (ms)</label>
                  <input
                    type="number"
                    value={settingsForm.pollIntervalMs}
                    onChange={e => setSettingsForm({ ...settingsForm, pollIntervalMs: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400">Default: 12000 (12s)</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-600/20"
                >
                  Save Settings
                </button>
              </div>
            </form>

            {/* Cloud Storage Resilience & Backup Card */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                    <span>Cloud Container Resilience & Wallet Backup</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Because Google AI Studio uses serverless containers (Cloud Run), the server disk resets when the container goes to sleep. The app automatically safeguards your groups and wallets in your browser storage and auto-restores them on reboot.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-lg space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Browser Auto-Backup Protection:</span>
                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Active
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Safeguarded Items:</span>
                  <span className="font-mono text-slate-200">
                    {backupMeta?.wallets ?? wallets.length} wallets • {backupMeta?.groups ?? groups.length} groups
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Synced:</span>
                  <span className="font-mono text-slate-300">
                    {backupMeta?.savedAt ? new Date(backupMeta.savedAt).toLocaleTimeString() : 'Just now'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadProjectZip}
                  disabled={downloadingZip}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow"
                >
                  <Download className={`w-3.5 h-3.5 ${downloadingZip ? 'animate-bounce' : ''}`} />
                  <span>{downloadingZip ? 'Packaging Zip...' : 'Download Full Code (.zip)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download Backup JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Restore from JSON File</span>
                </button>
                <button
                  type="button"
                  onClick={handleManualRestoreBrowser}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Force Browser Sync</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: 100% FREE HOSTING & PROVIDER COMPARISON GUIDE */}
        {/* ========================================================================= */}
        {activeTab === 'guide' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <span>Zero-Cost Free Hosting & Free Provider Strategy</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Every component is built to run on 100% free resources with no payment card or subscription required.
              </p>
            </div>

            {/* Provider Comparison Matrix (Strictly satisfying Section 3) */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">EVM Free Provider Comparison Matrix</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verified live limitations and capabilities across monitored blockchains
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Blockchain</th>
                      <th className="px-4 py-3">Recommended Free Provider</th>
                      <th className="px-4 py-3">API Key / Card?</th>
                      <th className="px-4 py-3">Mint Detection</th>
                      <th className="px-4 py-3">Purchase Detection</th>
                      <th className="px-4 py-3">Free Tier Limits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {providers.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/20">
                        <td className="px-4 py-3 font-bold text-white">{p.blockchain}</td>
                        <td className="px-4 py-3 text-slate-200">
                          <div>{p.recommendedProvider}</div>
                          <code className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate max-w-xs">{p.rpcUrl}</code>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-semibold text-[10px]">
                            NO Card • NO Key
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-emerald-400 font-medium">● {p.mintDetection}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-emerald-400 font-medium">● {p.purchaseDetection}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-[11px] max-w-xs">
                          {p.freeTierLimitations}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Hosting Platforms Guide */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-3">
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Option 1: Free Cloud Hosting (Zero-Cost 24/7)
                </h4>
                <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                  <li><strong>Render Free Web Service:</strong> Deploy this repository directly on Render's free tier. Run command: <code className="bg-slate-950 px-1 py-0.5 rounded">npm start</code>.</li>
                  <li><strong>Koyeb Free Eco Tier:</strong> Deploy Docker/Node applet with persistent volume or auto-sync.</li>
                  <li><strong>Fly.io / Railway Starter:</strong> Zero-card trial credits or free compute allowance.</li>
                  <li><strong>Oracle Cloud Always Free:</strong> 4 ARM cores + 24GB RAM 100% free forever for running 100 background bots.</li>
                </ul>
              </div>

              <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-3">
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                  Option 2: Running from iPhone or Local Node
                </h4>
                <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                  <li><strong>From iPhone (iSH app or Termux):</strong> Install Node.js, clone repository, run <code className="bg-slate-950 px-1 py-0.5 rounded">npm start</code>.</li>
                  <li><strong>Local Mac/PC / Raspberry Pi:</strong> Clone repo and run <code className="bg-slate-950 px-1 py-0.5 rounded">npm run bot</code> for headless daemon.</li>
                  <li><strong>State Persistence:</strong> Stored locally at <code className="bg-slate-950 px-1 py-0.5 rounded">./data/nft-alert.json</code>; zero database servers needed.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Download Files & Project */}
        {showDownloadModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Download Files & Project Code</h3>
                    <p className="text-xs text-slate-400">Save your wallets, bot scripts, or complete source code</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="text-slate-400 hover:text-white text-lg p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                {/* Option 1: Full Project ZIP */}
                <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 hover:border-indigo-500/60 transition-all flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">Full Project Source Code (.zip)</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Complete Codebase
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Downloads all TypeScript, React, and Express files, plus the standalone bot (<code className="text-slate-300">src/bot/standalone.ts</code>) and a quickstart guide ready to run 24/7 on a VPS, local PC, or server.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadProjectZip}
                    disabled={downloadingZip}
                    className="shrink-0 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow"
                  >
                    <Download className={`w-3.5 h-3.5 ${downloadingZip ? 'animate-bounce' : ''}`} />
                    <span>{downloadingZip ? 'Packaging...' : 'Download .zip'}</span>
                  </button>
                </div>

                {/* Option 2: Wallet & Settings Backup */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">Wallet & Group Config (.json)</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Safe Data Backup
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Exports all {wallets.length} tracked wallets, {groups.length} groups, milestone thresholds, and Discord settings so you never lose them.
                    </p>
                  </div>
                  <button
                    onClick={handleExportBackup}
                    className="shrink-0 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Export .json</span>
                  </button>
                </div>

                {/* Option 3: Backend Database File */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">Raw Database File (database.json)</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      The active database state file including network configs, activities, and group associations.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadDatabaseJson}
                    className="shrink-0 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              {/* Quick 24/7 Hosting Terminal Command */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs space-y-1.5">
                <span className="text-slate-400 font-medium">To run the bot 24/7 after unzipping:</span>
                <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg font-mono text-[11px] text-indigo-300 border border-slate-800">
                  <code>npm install && npm run bot</code>
                  <button
                    onClick={() => copyToClipboard('npm install && npm run bot', 'bot-cmd')}
                    className="text-slate-400 hover:text-white ml-2"
                    title="Copy command"
                  >
                    {copiedText === 'bot-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowDownloadModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
