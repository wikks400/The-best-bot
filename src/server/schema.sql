-- NFT Group Alert - Complete SQLite Schema
-- This schema represents the full relational structure for persistent storage.

CREATE TABLE IF NOT EXISTS wallet_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tracked_wallets (
    address TEXT NOT NULL,
    group_id TEXT NOT NULL,
    label TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (address, group_id),
    FOREIGN KEY (group_id) REFERENCES wallet_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wallets_address ON tracked_wallets(address);
CREATE INDEX IF NOT EXISTS idx_wallets_group ON tracked_wallets(group_id);

CREATE TABLE IF NOT EXISTS network_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    chain_id INTEGER NOT NULL UNIQUE,
    rpc_url TEXT NOT NULL,
    fallback_rpcs TEXT, -- JSON array of URLs
    explorer_url TEXT NOT NULL,
    currency_symbol TEXT NOT NULL DEFAULT 'ETH',
    is_enabled INTEGER NOT NULL DEFAULT 1,
    is_connected INTEGER NOT NULL DEFAULT 0,
    last_block_checked INTEGER NOT NULL DEFAULT 0,
    last_checked_at INTEGER,
    last_latency_ms INTEGER,
    last_error TEXT,
    free_tier_notes TEXT
);

CREATE TABLE IF NOT EXISTS projects (
    contract_address TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT,
    description TEXT,
    website TEXT,
    twitter TEXT,
    discord TEXT,
    opensea_url TEXT,
    opensea_mint_url TEXT,
    explorer_url TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (contract_address, chain_id)
);

CREATE TABLE IF NOT EXISTS activity_records (
    id TEXT PRIMARY KEY, -- tx_hash + type + wallet + contract + token
    activity_type TEXT NOT NULL, -- 'mint' or 'buy'
    chain_id INTEGER NOT NULL,
    chain_name TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    project_name TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    token_id TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    tx_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    price_native REAL,
    price_usd REAL,
    marketplace TEXT
);

CREATE INDEX IF NOT EXISTS idx_activity_lookup ON activity_records(contract_address, chain_id, activity_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_wallet ON activity_records(wallet_address);

CREATE TABLE IF NOT EXISTS alert_milestones (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    chain_name TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    project_name TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    milestone_index INTEGER NOT NULL, -- 1, 2, 3, 4, 5
    threshold_wallets INTEGER NOT NULL,
    total_unique_wallets INTEGER NOT NULL,
    new_wallets_since_last INTEGER NOT NULL,
    total_nfts INTEGER NOT NULL,
    price_native REAL,
    currency_symbol TEXT NOT NULL,
    group_breakdown TEXT NOT NULL, -- JSON array
    sent_at INTEGER NOT NULL,
    status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_milestone_episode ON alert_milestones(episode_id, milestone_index);
CREATE INDEX IF NOT EXISTS idx_milestone_project ON alert_milestones(contract_address, chain_id, activity_type);

CREATE TABLE IF NOT EXISTS bot_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
