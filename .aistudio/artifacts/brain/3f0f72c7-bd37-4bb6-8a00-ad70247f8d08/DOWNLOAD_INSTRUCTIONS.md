# NFT Group Alert • Botkeep Migration & Deployment Guide

The complete source code and standalone Discord bot runner are fully synchronized and validated for direct deployment to **Botkeep hosting** and version control on **GitHub**.

---

## 📦 1. How to Download Your Project ZIP

You can download the ready-to-run project ZIP file using either of these methods:

1. **Direct Download Link**:
   - [Download nft-group-alert-project.zip](/nft-group-alert-project.zip)
   - Alternative endpoint: [/api/download/project-zip](/api/download/project-zip)

2. **In-App Header**:
   - Click the **"Download Files"** button in the dashboard top navigation bar.
   - Select **"Full Project Source Code (.zip)"**.

The generated ZIP includes the synchronized `package.json` and `package-lock.json` so `npm ci` will succeed immediately upon deployment.

---

## 🐙 2. How to Push the Corrected Files to GitHub

If your Botkeep instance is connected directly to a GitHub repository, push the updated files using the following commands:

```bash
# 1. Check changed files
git status

# 2. Stage the synchronized package-lock.json, zip export, and any config updates
git add package.json package-lock.json src/server/zipExport.ts

# 3. Commit the changes
git commit -m "fix(deps): synchronize package-lock.json for npm ci compatibility on Botkeep"

# 4. Push to your repository (replace 'main' with your branch name if different)
git push origin main
```

Once pushed, Botkeep will trigger a redeploy, and `npm ci` will complete cleanly with zero errors.

---

## 🚀 3. Deploying to Botkeep Step-by-Step

### Step 1: Upload or Connect Repository
1. Log in to [Botkeep](https://botkeep.com).
2. Click **Create Bot** / **Add Bot**.
3. Select **Node.js** as the environment (Node.js 18, 20, or 22).
4. Either connect your updated GitHub repository or upload `nft-group-alert-project.zip`.

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
Click **Start / Deploy**. Botkeep will run `npm ci` and launch your bot 24/7.

---

## 🛡️ 4. Why Wallets Won't Disappear on Botkeep

In Google AI Studio, the browser container resets after inactivity, clearing temporary storage. On **Botkeep**, you have dedicated persistent disk storage:
- All wallet groups, tracked addresses, and milestone histories are persisted in `data/nft-alert.json`.
- State is preserved across bot restarts.
- Automatic backoff and RPC failover prevent rate limits across 9 EVM chains.
- Built-in `SIGINT` / `SIGTERM` handlers ensure all tracking states are saved on shutdown.
