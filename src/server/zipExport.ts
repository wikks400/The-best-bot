import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.aistudio',
  '.vite',
  'tmp',
  '.cache'
]);

const IGNORED_FILES = new Set([
  '.DS_Store',
  'bun.lock',
  '.env',
  '.env.local',
  '.env.production'
]);

async function addDirectoryToZip(zip: JSZip, rootDir: string, currentDir: string) {
  const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        await addDirectoryToZip(zip, rootDir, fullPath);
      }
    } else if (entry.isFile()) {
      // Security: Never bundle sensitive .env files or pre-existing zip bundles
      if (
        !IGNORED_FILES.has(entry.name) &&
        !entry.name.endsWith('.log') &&
        !entry.name.endsWith('.zip') &&
        !entry.name.startsWith('.env.')
      ) {
        try {
          const content = await fs.promises.readFile(fullPath);
          zip.file(relativePath, content);
        } catch (err) {
          console.warn(`[ZipExport] Skipping unreadable file: ${relativePath}`, err);
        }
      }
    }
  }
}

export async function createProjectZipBuffer(rootDir: string): Promise<Buffer> {
  const zip = new JSZip();

  // Recursively add project files
  await addDirectoryToZip(zip, rootDir, rootDir);

  // Add dedicated Botkeep deployment guide
  zip.file(
    'BOTKEEP_DEPLOYMENT.md',
    `# Deploying to Botkeep • NFT Mint & Buy Tracker Bot

This project is fully configured for standalone, independent hosting on Botkeep (or any Node.js VPS/hosting provider).

---

## 1. Quick Botkeep Setup Steps

1. **Log in to Botkeep** (https://botkeep.com).
2. Click **Create Bot** / **New Application**.
3. Choose **Node.js** as the environment (Node.js 18.x, 20.x, or 22.x).
4. Upload this ZIP package or extract the files.
5. In the **Startup Command** setting, enter:
   \`\`\`bash
   npm start
   \`\`\`
   *(Or \`npm run bot\` — both execute the dedicated headless bot service \`src/bot/standalone.ts\`)*
6. In the **Environment Variables** section on Botkeep, set:
   - \`DISCORD_TOKEN\` = Your Discord Bot Token (from Discord Developer Portal)
   - \`DISCORD_CLIENT_ID\` = Your Discord Application Client ID
   - *(Optional)* \`DISCORD_CHANNEL_ID\` = Channel ID where NFT alerts should be sent
   - *(Optional)* \`DISCORD_WEBHOOK_URL\` = Webhook URL (alternative/additional alert destination)
   - *(Optional)* \`PORT\` = 3000 (if Botkeep uses an HTTP health check probe)
7. Click **Deploy** / **Start**.

---

## 2. Why Wallet Data Is Safe on Botkeep

Unlike Google AI Studio's browser development sandbox (which resets on idle or reload), Botkeep provides a persistent server container. All your tracked wallets, groups, and milestone histories are saved to \`data/nft-alert.json\`, so your groups and wallets remain saved across bot restarts.

You can also use the Discord slash commands:
- \`/wallet-add group:<name> address:<0x...>\`
- \`/wallet-import group:<name> addresses:<list>\`
- \`/group-create name:<name>\`
- \`/alerts-channel channel:<#channel>\`
- \`/status\`

---

## 3. Supported Blockchain Networks (100% Free Public RPCs)
- **Ethereum** (Chain ID: 1)
- **Base** (Chain ID: 8453)
- **Arbitrum One** (Chain ID: 42161)
- **Optimism** (Chain ID: 10)
- **Polygon** (Chain ID: 137)
- **Ink** (Chain ID: 57073)
- **BNB Chain** (Chain ID: 56)
- **Avalanche C-Chain** (Chain ID: 43114)
- **Robinhood Chain** (Chain ID: 4663)

All RPC endpoints use public, rate-limited free tiers with automatic fallbacks and backoff retries.
`
  );

  // Add general quickstart guide
  zip.file(
    'QUICKSTART.md',
    `# NFT Group Alert • 24/7 Bot Quickstart Guide

This zip contains the complete source code and standalone Discord bot runner.

## 1. Local or VPS Execution
\`\`\`bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DISCORD_TOKEN and DISCORD_CLIENT_ID

# 3. Start headless bot runner
npm start
\`\`\`

## 2. Start Full-Stack Web Dashboard + Bot
\`\`\`bash
npm run web
# Dashboard opens on http://localhost:3000
\`\`\`
`
  );

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return buffer;
}
