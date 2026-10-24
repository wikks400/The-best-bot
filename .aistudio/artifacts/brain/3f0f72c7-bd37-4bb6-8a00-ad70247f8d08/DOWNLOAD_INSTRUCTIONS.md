# NFT Group Alert • Botkeep Migration & RPC Configuration Guide

The complete source code and standalone Discord bot runner are updated with reliable EVM RPC endpoints, active failover handling, and environment variable synchronization.

---

## 📦 1. Download Your Corrected Project ZIP

Download the updated project archive directly:
- **Direct Download**: [/nft-group-alert-project.zip](/nft-group-alert-project.zip)
- **API Endpoint**: [/api/download/project-zip](/api/download/project-zip)
- Or click **"Download Files"** > **"Full Project Source Code (.zip)"** in the dashboard.

---

## ⚙️ 2. Botkeep Environment Variables Configuration

Set these environment variables in your Botkeep dashboard under **Config / Environment Variables**:

| Variable Name | Recommended Value | Notes |
| :--- | :--- | :--- |
| `DISCORD_TOKEN` | *Your Bot Token* | From [Discord Developer Portal](https://discord.com/developers/applications) |
| `DISCORD_CLIENT_ID` | *Your Client ID* | Required for registering slash commands |
| `ETHEREUM_RPC_URL` | `https://rpc.mevblocker.io` | Verified high-throughput public RPC (no API key required) |
| `POLYGON_RPC_URL` | `https://1rpc.io/matic` | Verified Bor RPC with full getLogs support (no API key required) |
| `PORT` | `3000` | Health check listener for Botkeep container probes |
| `DATABASE_PATH` | `./data/nft-alert.json` | Stores your 6 groups, 48 active wallets, and history |
| `POLL_INTERVAL_MS` | `12000` | 12-second cycle between block checks |

### Alternative Authenticated Providers (Optional)
If you prefer your own dedicated Alchemy, Infura, or QuickNode accounts:
- `ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY`
- `POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY`
*(Or set `ALCHEMY_API_KEY` or `INFURA_API_KEY` directly; the bot will auto-generate authenticated URLs).*

---

## 🐙 3. How to Push Corrected Files to GitHub

```bash
# 1. Check status
git status

# 2. Stage updated files
git add src/server/chains.ts src/server/db.ts src/server/monitor.ts src/bot/standalone.ts src/bot/client.ts src/test/monitor.test.ts .env.example

# 3. Commit the changes
git commit -m "fix(rpc): replace failing Ethereum & Polygon endpoints with verified RPCs and active failover"

# 4. Push to your repository
git push origin main
```

---

## 🚀 4. Botkeep Deployment & Verification

1. In Botkeep, ensure the **Startup Command** is:
   ```bash
   npm start
   ```
2. Save your environment variables and click **Restart**.
3. The bot will load your stored groups and wallets, verify network connectivity via `eth_chainId`, register all slash commands, and start monitoring.
