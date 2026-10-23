# NFT Group Alert • Botkeep Migration & Download Guide

The complete source code and standalone Discord bot runner have been updated and packaged for direct deployment to **Botkeep hosting**.

---

## 📦 1. How to Download Your Project ZIP

You can download the ready-to-run project ZIP file using either of these methods:

1. **Direct Download Link**:
   - [Download nft-group-alert-project.zip](/nft-group-alert-project.zip)
   - Alternative endpoint: [/api/download/project-zip](/api/download/project-zip)

2. **In-App Header**:
   - Click the **"Download Files"** button in the dashboard top navigation bar.
   - Select **"Full Project Source Code (.zip)"**.

---

## 🚀 2. Deploying to Botkeep Step-by-Step

### Step 1: Upload to Botkeep
1. Log in to [Botkeep](https://botkeep.com).
2. Click **Create Bot** / **Add Bot**.
3. Select **Node.js** as the environment (Node.js 18, 20, or 22).
4. Upload the `nft-group-alert-project.zip` file (or extract and upload the project files).

### Step 2: Configure Startup Command
Set the startup command in Botkeep to:
```bash
npm start
```
*(Alternatively, `npm run bot` — both point to the dedicated headless service `src/bot/standalone.ts`)*

### Step 3: Configure Environment Variables
In the Botkeep **Environment Variables** / **Config** tab, add the following:

| Variable | Value / Description | Required |
| :--- | :--- | :--- |
| `DISCORD_TOKEN` | Your Bot Token from the Discord Developer Portal | **Yes** |
| `DISCORD_CLIENT_ID` | Your Application ID / Client ID | **Yes** |
| `DISCORD_CHANNEL_ID` | Channel ID where alerts should be posted | Optional (can also set via `/alerts-channel`) |
| `DISCORD_WEBHOOK_URL`| Webhook URL for backup/direct alerts | Optional |
| `PORT` | Container port (e.g., `3000`) for health checks | Optional (auto-handled) |
| `DATABASE_PATH` | `./data/nft-alert.json` | Optional (default: persistent JSON) |

### Step 4: Start Your Bot
Click **Start / Deploy**. Botkeep will automatically install dependencies and launch your bot.

---

## 🛡️ 3. Why Wallets Won't Disappear on Botkeep

In Google AI Studio, the browser container resets after inactivity, clearing temporary storage. On **Botkeep**, you have dedicated persistent disk storage:
- All wallet groups, tracked addresses, and milestone histories are persisted in `data/nft-alert.json`.
- State is preserved across bot restarts.
- Automatic backoff and RPC failover prevent rate limits.
- Built-in `SIGINT` / `SIGTERM` handlers ensure all tracking states are saved on shutdown.
