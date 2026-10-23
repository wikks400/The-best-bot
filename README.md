# NFT Group Alert • Discord Bot & Multi-Chain Monitor

**NFT Group Alert** is a Discord bot and EVM blockchain monitoring application built with Node.js, `discord.js`, and TypeScript. It is designed to run exclusively on **100% free resources** with **zero paid APIs, zero credit card requirements, zero paid databases, and zero paid hosting**.

---

## Key Features

1. **Wallet Group Management**
   - Create custom groups (e.g. *Degen Minters*, *Smart Traders*, *Early Minters*).
   - Add, remove, and bulk-import wallet addresses without touching source code.
   - Wallets can belong to multiple groups simultaneously. A wallet is counted only once in the overall unique wallet total, but appears in each relevant group's statistics.
   - Toggle groups on/off (only enabled groups contribute to alerts).

2. **Milestone Alerts (Sections 7 & 8)**
   - **Initial Alert:** Triggers immediately when **4 unique tracked wallets** from enabled groups mint or buy from the same project.
   - **Follow-up Notifications:** Compact updates sent at **7, 12, 20, and 35 unique wallets** (customizable).
   - Shows cumulative count and delta since previous alert (e.g., *"+3 new wallets since previous alert"*).
   - Silent tracking continues past 35 wallets without spamming.
   - Separate episode tracking for mints vs. purchases.

3. **Multi-Chain EVM Support**
   - Pre-configured with free public RPCs across:
     - **Ethereum** (LlamaNodes / Cloudflare public RPC)
     - **Base** (Coinbase official public RPC)
     - **Ink** (Kraken / Gelato official public RPC)
     - **Arbitrum One** (Offchain Labs public RPC)
     - **Optimism** (OP Foundation public RPC)
     - **Polygon PoS** (Polygon official RPC)
     - **BNB Smart Chain** (Binance official dataseed)
     - **Avalanche C-Chain** (Ava Labs public RPC)
     - **Robinhood Chain** (Public EVM gateway)
   - Add custom EVM chains dynamically without modifying application code.

4. **10 Required Discord Slash Commands**
   - `/group-create [name] [description]` — Create a new wallet group.
   - `/group-list` — List all groups and wallet counts.
   - `/wallet-add [group] [address] [label]` — Add an EVM wallet to a group.
   - `/wallet-remove [group] [address]` — Remove a wallet from a group.
   - `/wallet-import [group] [addresses]` — Bulk-import addresses (comma/newline separated).
   - `/monitor [start|stop]` — Start or stop monitoring.
   - `/alerts-channel [channel]` — Select Discord alert channel.
   - `/alerts-role [role]` — Select role to mention in notifications.
   - `/alert-settings [milestones] [episode_hours]` — View or adjust thresholds.
   - `/status` — View connected chains, latency, last blocks, and error states.

5. **iPhone-Friendly Web Management Dashboard**
   - Clean mobile-responsive interface accessible from your iPhone Safari or desktop.
   - Live RPC latency and block height tester.
   - Discord Embed preview matching exact Section 10/11/12 specifications.
   - Interactive Simulation Studio for testing alerts with 1 click.

---

## Free Provider Comparison Matrix

| Blockchain | Recommended Free Provider | RPC URL | Card Required? | Free Tier Limits | Mint Detection | Purchase Detection |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Ethereum** | LlamaNodes / Cloudflare | `https://eth.llamarpc.com` | **No** | ~20-50 req/s, getLogs max 10-20 blocks | Reliable | Reliable |
| **Base** | Coinbase Official | `https://mainnet.base.org` | **No** | Sub-second blocks, batch getLogs | Reliable | Reliable |
| **Ink** | Gelato Ink RPC | `https://rpc-gel.inkonchain.com` | **No** | Standard rate limits, low latency | Reliable | Reliable |
| **Arbitrum** | Offchain Labs | `https://arb1.arbitrum.io/rpc` | **No** | ~100 req/min, batch calls supported | Reliable | Reliable |
| **Optimism** | OP Labs | `https://mainnet.optimism.io` | **No** | Free public endpoint | Reliable | Reliable |
| **Polygon** | Polygon Official | `https://polygon-rpc.com` | **No** | Public aggregation endpoint | Reliable | Reliable |
| **BNB Chain** | Binance Dataseed | `https://bsc-dataseed.binance.org` | **No** | 3s block interval, standard getLogs | Reliable | Reliable |
| **Avalanche** | Ava Labs | `https://api.avax.network/ext/bc/C/rpc`| **No** | 1-2s finality, ~60 req/min | Reliable | Reliable |
| **Robinhood**| Robinhood EVM | `https://rpc.robinhood.com` | **No** | Subject to public gateway availability| Experimental | Experimental |

---

## Free Hosting & Deployment Options

### Option 1: Render.com (Free Web Service)
1. Fork or push this repository to GitHub.
2. Create a free account at [render.com](https://render.com) (no payment card needed).
3. Click **New +** → **Web Service** → Connect your repository.
4. Settings:
   - **Environment:** Node
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
5. Add your `DISCORD_BOT_TOKEN` or `DISCORD_WEBHOOK_URL` in the Environment Variables tab.

### Option 2: Koyeb (Free Eco Tier)
1. Create a free account on [koyeb.com](https://koyeb.com).
2. Deploy repository with build command `npm run build` and run `npm start`.

### Option 3: Local Node or iPhone (iSH / Termux)
1. Run on any local computer or iPhone terminal:
   ```bash
   git clone <repo-url>
   cd nft-group-alert
   npm install
   npm run build
   npm start
   ```
2. Database is stored locally in `./data/nft-alert.json` with automatic atomic writes and backups.

---

## Setting Up Discord Bot & Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and name it **NFT Group Alert**.
3. Under **Bot**, click **Reset Token** to copy your bot token.
4. Under **OAuth2 → URL Generator**:
   - Check `bot` and `applications.commands`.
   - Bot Permissions: `Send Messages`, `Embed Links`, `Manage Roles`, `Use Slash Commands`.
5. Paste the generated authorization URL into your browser to invite the bot to your Discord server.
6. In `.env`:
   ```bash
   DISCORD_BOT_TOKEN=your_token_here
   DISCORD_CLIENT_ID=your_client_id_here
   ```
*(Alternatively, you can simply paste a Discord Webhook URL into the Settings tab for zero-setup alerts!)*

---

## Automated Unit Tests

Run the test suite covering address normalization, group aggregations, multi-group wallet deduplication, mint detection, purchase detection, and milestone alerts:

```bash
npm test
```
All 23 assertions run and pass cleanly in < 1 second.
