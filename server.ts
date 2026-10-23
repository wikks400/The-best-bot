import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

import { db } from './src/server/db.ts';
import { monitor } from './src/server/monitor.ts';
import { discordBot } from './src/bot/client.ts';
import { testRpcEndpoint, FREE_PROVIDER_COMPARISONS } from './src/server/chains.ts';
import { sendDiscordWebhook, buildDiscordEmbed } from './src/server/alerter.ts';
import { getOrDiscoverProject } from './src/server/metadata.ts';
import { createProjectZipBuffer } from './src/server/zipExport.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// CORS & Preflight handling for iframe, mobile, and cross-origin embedding
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Consolidated Dashboard Initial State (loads all data in a single swift call)
app.get('/api/dashboard', (req, res) => {
  try {
    const metrics = db.getMetrics();
    const settings = db.getSettings();
    const networks = db.getNetworks();
    const groups = db.getGroups();
    const wallets = db.getWallets();
    const alerts = db.getRecentAlerts(50);
    const activities = db.getRecentActivities(60);

    const groupMap = new Map(groups.map(g => [g.id, g.name]));
    const enrichedGroups = groups.map(g => ({
      ...g,
      walletCount: wallets.filter(w => w.groupIds.includes(g.id)).length,
    }));
    const enrichedWallets = wallets.map(w => ({
      ...w,
      groupNames: w.groupIds.map(id => groupMap.get(id) || id),
    }));

    res.json({
      status: {
        metrics,
        settings,
        networks,
        isBotConnected: discordBot.isConnected(),
        isMonitoring: settings.isMonitoring,
      },
      groups: enrichedGroups,
      wallets: enrichedWallets,
      networks,
      alerts,
      activities,
      providers: FREE_PROVIDER_COMPARISONS,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// API: System Status & Metrics
app.get('/api/status', (req, res) => {
  const metrics = db.getMetrics();
  const settings = db.getSettings();
  const networks = db.getNetworks();
  res.json({
    metrics,
    settings,
    networks,
    isBotConnected: discordBot.isConnected(),
    isMonitoring: settings.isMonitoring,
  });
});

// API: Toggle Monitoring
app.post('/api/monitor/toggle', (req, res) => {
  const { enabled } = req.body;
  const current = db.getSettings();
  const nextState = enabled !== undefined ? !!enabled : !current.isMonitoring;
  db.updateSettings({ isMonitoring: nextState });

  if (nextState) {
    monitor.start();
  } else {
    monitor.stop();
  }

  res.json({ isMonitoring: nextState });
});

// API: Wallet Groups
app.get('/api/groups', (req, res) => {
  const groups = db.getGroups();
  const wallets = db.getWallets();
  const enriched = groups.map(g => {
    const groupWallets = wallets.filter(w => w.groupIds.includes(g.id));
    return {
      ...g,
      walletCount: groupWallets.length,
    };
  });
  res.json(enriched);
});

app.post('/api/groups', (req, res) => {
  try {
    const { name, description } = req.body;
    const group = db.createGroup(name, description);
    res.json(group);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

app.put('/api/groups/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const group = db.toggleGroup(id, enabled);
    res.json(group);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

app.delete('/api/groups/:id', (req, res) => {
  try {
    const { id } = req.params;
    const success = db.deleteGroup(id);
    res.json({ success });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

app.post('/api/groups/:id/clear-wallets', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.clearWalletsInGroup(id);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

// API: Tracked Wallets
app.get('/api/wallets', (req, res) => {
  const wallets = db.getWallets();
  const groups = db.getGroups();
  const groupMap = new Map(groups.map(g => [g.id, g.name]));

  const enriched = wallets.map(w => ({
    ...w,
    groupNames: w.groupIds.map(id => groupMap.get(id) || id),
  }));

  res.json(enriched);
});

app.post('/api/wallets', (req, res) => {
  try {
    const { address, groupId, groupName, label } = req.body;
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    let targetGroupId = groupId;
    if (!targetGroupId && groupName) {
      const existing = db.getGroupByName(groupName);
      if (existing) {
        targetGroupId = existing.id;
      } else {
        const created = db.createGroup(groupName);
        targetGroupId = created.id;
      }
    }

    if (!targetGroupId) {
      return res.status(400).json({ error: 'Please choose or enter a group name' });
    }

    const result = db.addWallet(address, targetGroupId, label);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

app.delete('/api/wallets', (req, res) => {
  try {
    const { address, groupId } = req.body;
    if (!address || !groupId) {
      return res.status(400).json({ error: 'Address and groupId are required' });
    }
    const success = db.removeWalletFromGroup(address, groupId);
    res.json({ success });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

app.post('/api/wallets/import', (req, res) => {
  try {
    const { rawText, groupId, groupName, groupDescription } = req.body;
    const groupIdentifier = groupName || groupId;
    if (!rawText || !groupIdentifier) {
      return res.status(400).json({ error: 'Wallet list and group name are required' });
    }
    const result = db.importWallets(rawText, groupIdentifier, groupDescription);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

// API: Reset all groups and wallets to clean slate
app.post('/api/reset-data', (req, res) => {
  try {
    db.clearAllGroupsAndWallets();
    res.json({ success: true, message: 'All groups and wallets cleared.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// API: Backup & Restore (Resilience against serverless scale-down/restarts)
app.get('/api/backup', (req, res) => {
  try {
    const backup = db.exportBackup();
    res.json(backup);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

app.post('/api/backup/restore', (req, res) => {
  try {
    const result = db.restoreBackup(req.body);
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

// API: Full Project Source Code Download (ZIP archive)
app.get('/api/download/project-zip', async (req, res) => {
  try {
    const rootDir = __dirname;
    const zipBuffer = await createProjectZipBuffer(rootDir);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="nft-group-alert-project.zip"');
    res.setHeader('Content-Length', zipBuffer.length);
    res.end(zipBuffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[DownloadZip] Error packaging project:', err);
    res.status(500).json({ error: `Failed to create project zip: ${msg}` });
  }
});

app.get('/nft-group-alert-project.zip', (req, res) => {
  const filePath = path.resolve(__dirname, 'public', 'nft-group-alert-project.zip');
  if (fs.existsSync(filePath)) {
    res.download(filePath, 'nft-group-alert-project.zip');
  } else {
    res.redirect('/api/download/project-zip');
  }
});

// API: Direct JSON Backup Download
app.get('/api/download/data-json', (req, res) => {
  try {
    const backup = db.exportBackup();
    const dataStr = JSON.stringify(backup, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="nft-group-alert-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(dataStr);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// API: Networks & Free RPCs
app.get('/api/networks', (req, res) => {
  res.json(db.getNetworks());
});

app.post('/api/networks/test', async (req, res) => {
  const { rpcUrl } = req.body;
  if (!rpcUrl) {
    return res.status(400).json({ error: 'rpcUrl is required' });
  }
  const result = await testRpcEndpoint(rpcUrl);
  res.json(result);
});

app.put('/api/networks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updated = db.updateNetwork(id, req.body);
    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

app.post('/api/networks', (req, res) => {
  try {
    const network = db.addNetwork(req.body);
    res.json(network);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

// API: Free Provider Comparisons
app.get('/api/providers', (req, res) => {
  res.json(FREE_PROVIDER_COMPARISONS);
});

// API: Alerts & Activities
app.get('/api/alerts', (req, res) => {
  res.json(db.getRecentAlerts(50));
});

app.get('/api/activities', (req, res) => {
  res.json(db.getRecentActivities(60));
});

// API: Settings
app.get('/api/settings', (req, res) => {
  res.json(db.getSettings());
});

app.put('/api/settings', (req, res) => {
  try {
    const updated = db.updateSettings(req.body);
    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

// API: Webhook Test
app.post('/api/test/webhook', async (req, res) => {
  const { webhookUrl, roleId } = req.body;
  const targetUrl = webhookUrl || db.getSettings().webhookUrl;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Webhook URL not provided' });
  }

  const sampleNetwork = db.getNetworks()[0];
  const sampleProject = {
    contractAddress: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
    chainId: 1,
    name: 'Bored Ape Yacht Club',
    description: 'A collection of 10,000 unique Bored Ape NFTs on Ethereum.',
    website: 'https://boredapeyachtclub.com',
    twitter: 'BoredApeYC',
    discord: 'https://discord.gg/bayc',
    openseaUrl: 'https://opensea.io/collection/boredapeyachtclub',
    openseaMintUrl: 'https://opensea.io/mint/ethereum/0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
    explorerUrl: 'https://etherscan.io/address/0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
    verified: true,
    updatedAt: Date.now(),
  };

  const sampleMilestone = {
    id: `alert_test_${Date.now()}`,
    episodeId: 'ep_test_sample',
    chainId: 1,
    chainName: 'Ethereum',
    contractAddress: sampleProject.contractAddress,
    projectName: sampleProject.name,
    activityType: 'mint' as const,
    milestoneIndex: 1,
    thresholdWallets: 4,
    totalUniqueWallets: 4,
    newWalletsSinceLast: 4,
    totalNfts: 9,
    currencySymbol: 'ETH',
    groupBreakdown: [
      { groupId: 'grp_degen', groupName: 'Degen Minters', walletCount: 2, nftCount: 5 },
      { groupId: 'grp_smart', groupName: 'Smart Traders', walletCount: 1, nftCount: 2 },
      { groupId: 'grp_early', groupName: 'Early Minters', walletCount: 1, nftCount: 2 },
    ],
    projectInfo: sampleProject,
    sentAt: Date.now(),
    status: 'sent' as const,
  };

  const embed = buildDiscordEmbed(sampleMilestone, sampleProject, sampleNetwork);
  const result = await sendDiscordWebhook(targetUrl, embed, roleId || db.getSettings().roleId);

  res.json(result);
});

// API: Simulation Runner
app.post('/api/test/simulate', async (req, res) => {
  try {
    const {
      chainId = 1,
      contractAddress = '0x1234567890abcdef1234567890abcdef12345678',
      projectName = 'CyberPunks Genesis',
      activityType = 'mint',
      walletCount = 4,
      nftsPerWallet = 2,
      priceNative = 0.05,
    } = req.body;

    const enabledWallets = db.getEnabledWallets();
    if (enabledWallets.length === 0) {
      return res.status(400).json({ error: 'No enabled tracked wallets found. Add wallets first.' });
    }

    // Pick wallets
    const selectedWallets = enabledWallets.slice(0, Math.min(walletCount, enabledWallets.length));
    const walletAddrs = selectedWallets.map(w => w.address);

    // If more requested than we have in enabled groups, generate additional tracked test addresses in the first enabled group
    if (walletAddrs.length < walletCount) {
      const firstGroup = db.getGroups().find(g => g.enabled) || db.getGroups()[0];
      const needed = walletCount - walletAddrs.length;
      for (let i = 0; i < needed; i++) {
        const dummyAddr = `0x${(Date.now() + i).toString(16).padEnd(40, 'a')}`;
        db.addWallet(dummyAddr, firstGroup.id, `Sim Wallet ${i + 1}`);
        walletAddrs.push(dummyAddr);
      }
    }

    const result = await monitor.simulateActivity({
      chainId: Number(chainId),
      contractAddress,
      projectName,
      activityType,
      walletAddresses: walletAddrs,
      nftCountsPerWallet: walletAddrs.map(() => nftsPerWallet),
      priceNative,
    });

    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// Setup Vite or Static File Serving
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] NFT Group Alert running on http://0.0.0.0:${PORT}`);

    // Auto-start monitor if enabled
    if (db.getSettings().isMonitoring) {
      monitor.start();
    }

    // Try starting Discord bot if token provided
    const discordToken = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
    if (discordToken) {
      discordBot.start().then(res => {
        console.log(`[Server] Discord bot status: ${res.message}`);
      });
    } else {
      console.log('[Server] Note: DISCORD_TOKEN not provided in .env; Webhook alerts & web dashboard are active.');
    }
  });

  const handleShutdown = async (signal: string) => {
    console.log(`[Server] Received ${signal}. Shutting down gracefully...`);
    monitor.stop();
    await discordBot.stop();
    server.close(() => {
      console.log('[Server] Closed HTTP listener. Exiting.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

startServer().catch(err => {
  console.error('[Server] Fatal bootstrap error:', err);
});
