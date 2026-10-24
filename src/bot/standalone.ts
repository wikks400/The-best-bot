import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { discordBot } from './client.ts';
import { monitor } from '../server/monitor.ts';
import { db } from '../server/db.ts';

let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Standalone] Received ${signal}. Gracefully stopping bot & saving state...`);
  try {
    monitor.stop();
    await discordBot.stop();
    console.log('[Standalone] Shutdown complete. Goodbye!');
  } catch (err) {
    console.error('[Standalone] Error during graceful shutdown:', err);
  } finally {
    process.exit(0);
  }
}

async function run() {
  console.log('========================================================');
  console.log('NFT Group Alert • Botkeep Production Service Starting');
  console.log('EVM multi-chain NFT mint & buy tracker with wallet groups');
  console.log('Node version:', process.version);
  console.log('========================================================');

  const metrics = db.getMetrics();
  console.log(`[Database] Loaded ${metrics.totalGroups} groups, ${metrics.uniqueEnabledWallets} unique active wallets across ${metrics.totalNetworks} EVM chains.`);

  // Start blockchain monitoring engine
  monitor.start();

  // Start Discord Bot client
  const res = await discordBot.start();
  if (res.success) {
    console.log('[Standalone] Discord bot client connected and active.');
  } else {
    console.log(`[Standalone] Bot notice: ${res.message}`);
  }

  // Lightweight HTTP Health Check for Botkeep / VPS container probes
  const PORT = process.env.PORT || '3000';
  const portNum = parseInt(PORT, 10);
  const healthServer = http.createServer((req, res) => {
    // Respond 200 OK to any GET/HEAD health probe from Botkeep or external monitoring
    if (req.method === 'GET' || req.method === 'HEAD') {
      const status = {
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        discordBotConnected: discordBot.isConnected(),
        isMonitoring: db.getSettings().isMonitoring,
        metrics: db.getMetrics(),
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status, null, 2));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  healthServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Standalone] Health check port ${portNum} is in use. Running purely headless.`);
    } else {
      console.warn('[Standalone] Health check server notice:', err.message || err);
    }
  });

  healthServer.listen(portNum, '0.0.0.0', () => {
    console.log(`[Standalone] Health check HTTP listener active on port ${portNum}`);
  });

  // Graceful shutdown hooks
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Safety hooks to prevent crash loops
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Standalone] Unhandled Promise Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[Standalone] Uncaught Exception:', err);
  });
}

run().catch((err) => {
  console.error('[Standalone] Fatal error:', err);
  process.exit(1);
});

