import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
  ChannelType,
  MessageFlags,
} from 'discord.js';
import { db } from '../server/db.ts';
import { monitor } from '../server/monitor.ts';
import { testRpcEndpoint } from '../server/chains.ts';

export class DiscordBotService {
  private client: Client | null = null;
  private isReady = false;
  private isStarting = false;
  private inFlightInteractions = new Set<string>();
  private loggedInvalidChannels = new Map<string, number>();

  public async start(): Promise<{ success: boolean; message: string }> {
    if (this.isStarting || (this.client && this.isReady)) {
      return { success: true, message: 'Discord bot client already connected or in-flight login.' };
    }
    this.isStarting = true;

    const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      return {
        success: false,
        message: 'DISCORD_TOKEN / DISCORD_BOT_TOKEN not provided in environment variables. Webhook alerts active.',
      };
    }

    try {
      this.client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      });

      this.client.once(Events.ClientReady, async (c) => {
        this.isReady = true;
        console.log(`[Discord Bot] Successfully connected and logged in as ${c.user.tag}!`);
        await this.registerSlashCommands();
      });

      this.client.on('error', (err) => {
        console.error('[Discord Bot] Client connection error:', err);
      });

      this.client.on('shardError', (error, shardId) => {
        console.warn(`[Discord Bot] Shard ${shardId} error:`, error.message || error);
      });

      this.client.on('shardDisconnect', (event, shardId) => {
        console.warn(`[Discord Bot] Shard ${shardId} disconnected (${event.code}). Auto-reconnecting...`);
      });

      this.client.on('shardResume', (shardId, replayedEvents) => {
        console.log(`[Discord Bot] Shard ${shardId} resumed connection (${replayedEvents} events replayed).`);
      });

      this.client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (this.inFlightInteractions.has(interaction.id)) return;
        this.inFlightInteractions.add(interaction.id);
        try {
          await this.handleInteraction(interaction);
        } finally {
          this.inFlightInteractions.delete(interaction.id);
        }
      });

      await this.client.login(token);
      this.isStarting = false;
      return { success: true, message: 'Discord bot logged in successfully.' };
    } catch (err) {
      this.isStarting = false;
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Discord Bot] Login failed:', msg);
      return { success: false, message: `Discord login failed: ${msg}` };
    }
  }

  public isConnected(): boolean {
    return this.isReady && this.client !== null && this.client.isReady();
  }

  public async stop() {
    this.isStarting = false;
    this.inFlightInteractions.clear();
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (err) {
        console.warn('[Discord Bot] Error during destroy:', err);
      }
      this.client = null;
      this.isReady = false;
      console.log('[Discord Bot] Client safely disconnected.');
    }
  }

  /**
   * Send alert directly to a Discord text channel using the bot client
   */
  public async sendChannelAlert(
    channelId: string,
    embedData: {
      title: string;
      description?: string;
      color: number;
      fields: { name: string; value: string; inline?: boolean }[];
      footer?: { text: string };
      timestamp?: string;
    },
    roleId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.client || !this.isReady) {
      return { success: false, error: 'Discord bot client is not connected' };
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel) {
        return { success: false, error: `Channel ${channelId} not found. Ensure the bot is invited to the server.` };
      }

      // Check if channel is a Category
      if (channel.type === ChannelType.GuildCategory) {
        const catName = (channel as any).name || 'Alpha';
        const errorMsg = `Configured channel "${catName}" (${channelId}) is a Discord Category (type: 4), not a text channel. Discord categories cannot receive messages. Configure a text channel inside this category using /alerts-channel or via DISCORD_CHANNEL_ID.`;
        const lastLogged = this.loggedInvalidChannels.get(channelId) || 0;
        if (Date.now() - lastLogged > 300_000) {
          this.loggedInvalidChannels.set(channelId, Date.now());
          console.error(`[Discord Bot] Channel Configuration Error: ${errorMsg}`);
        }
        return { success: false, error: errorMsg };
      }

      // Check if channel is a Voice or Stage channel
      if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
        const vName = (channel as any).name || channelId;
        const errorMsg = `Configured channel "${vName}" (${channelId}) is a Voice channel (type: ${channel.type}). Voice channels cannot receive alert embeds. Please configure a text channel using /alerts-channel.`;
        const lastLogged = this.loggedInvalidChannels.get(channelId) || 0;
        if (Date.now() - lastLogged > 300_000) {
          this.loggedInvalidChannels.set(channelId, Date.now());
          console.error(`[Discord Bot] Channel Configuration Error: ${errorMsg}`);
        }
        return { success: false, error: errorMsg };
      }

      if (!channel.isTextBased()) {
        const errorMsg = `Channel "${(channel as any).name || channelId}" is an unsupported channel type (${channel.type}). Only standard text or announcement channels can receive alerts.`;
        const lastLogged = this.loggedInvalidChannels.get(channelId) || 0;
        if (Date.now() - lastLogged > 300_000) {
          this.loggedInvalidChannels.set(channelId, Date.now());
          console.error(`[Discord Bot] Channel Configuration Error: ${errorMsg}`);
        }
        return { success: false, error: errorMsg };
      }

      // Check bot permissions before attempting to post
      const perms = (channel as TextChannel).permissionsFor(this.client.user!);
      if (perms) {
        if (!perms.has(PermissionFlagsBits.ViewChannel)) {
          return { success: false, error: `Bot lacks 'View Channel' permission in #${(channel as TextChannel).name} (${channelId})` };
        }
        if (!perms.has(PermissionFlagsBits.SendMessages)) {
          return { success: false, error: `Bot lacks 'Send Messages' permission in #${(channel as TextChannel).name} (${channelId})` };
        }
        if (!perms.has(PermissionFlagsBits.EmbedLinks)) {
          return { success: false, error: `Bot lacks 'Embed Links' permission in #${(channel as TextChannel).name} (${channelId})` };
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(embedData.title)
        .setColor(embedData.color);

      if (embedData.description) embed.setDescription(embedData.description);
      if (embedData.footer) embed.setFooter(embedData.footer);
      if (embedData.timestamp) embed.setTimestamp(new Date(embedData.timestamp));

      for (const f of embedData.fields) {
        embed.addFields({ name: f.name, value: f.value, inline: f.inline ?? false });
      }

      const content = roleId ? `<@&${roleId}>` : undefined;
      await (channel as TextChannel).send({
        content,
        embeds: [embed],
      });

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Discord Bot] Error sending alert to channel ${channelId}:`, msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Register the 10 required slash commands
   */
  private async registerSlashCommands() {
    const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
    const clientId = process.env.DISCORD_CLIENT_ID || this.client?.user?.id;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!token || !clientId) {
      console.warn('[Discord Bot] Skipping slash command registration: missing DISCORD_CLIENT_ID or token');
      return;
    }

    const commands = [
      new SlashCommandBuilder()
        .setName('group-create')
        .setDescription('Create a new NFT wallet tracking group')
        .addStringOption(opt => opt.setName('name').setDescription('Group name (e.g., Degen Minters)').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Optional group description').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      new SlashCommandBuilder()
        .setName('group-list')
        .setDescription('List all wallet groups and their wallet counts'),

      new SlashCommandBuilder()
        .setName('group-clear')
        .setDescription('Remove all tracked wallets from a specific group')
        .addStringOption(opt => opt.setName('group').setDescription('Group name or ID').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      new SlashCommandBuilder()
        .setName('wallet-add')
        .setDescription('Add a tracked wallet to a group')
        .addStringOption(opt => opt.setName('group').setDescription('Group name or ID').setRequired(true))
        .addStringOption(opt => opt.setName('address').setDescription('EVM wallet address (0x...)').setRequired(true))
        .addStringOption(opt => opt.setName('label').setDescription('Optional label (e.g. vitalik.eth)').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      new SlashCommandBuilder()
        .setName('wallet-remove')
        .setDescription('Remove a tracked wallet from a group (or "all" to remove all wallets)')
        .addStringOption(opt => opt.setName('group').setDescription('Group name or ID').setRequired(true))
        .addStringOption(opt => opt.setName('address').setDescription('EVM address (0x...) or "all" to remove all wallets in group').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      new SlashCommandBuilder()
        .setName('wallet-import')
        .setDescription('Bulk-import wallet addresses into a group')
        .addStringOption(opt => opt.setName('group').setDescription('Group name or ID').setRequired(true))
        .addStringOption(opt => opt.setName('addresses').setDescription('Comma or space separated 0x addresses').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      new SlashCommandBuilder()
        .setName('monitor')
        .setDescription('Start or stop blockchain monitoring')
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Action: start or stop')
            .setRequired(true)
            .addChoices(
              { name: 'start', value: 'start' },
              { name: 'stop', value: 'stop' }
            )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

      new SlashCommandBuilder()
        .setName('alerts-channel')
        .setDescription('Select the Discord notification channel for NFT alerts')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Text channel to send alerts to')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      new SlashCommandBuilder()
        .setName('alerts-role')
        .setDescription('Select the Discord role to mention in NFT alerts')
        .addRoleOption(opt => opt.setName('role').setDescription('Role to mention (or leave empty to disable)').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      new SlashCommandBuilder()
        .setName('alert-settings')
        .setDescription('View or configure notification thresholds')
        .addStringOption(opt => opt.setName('milestones').setDescription('Comma-separated thresholds (e.g. 4,7,12,20,35)').setRequired(false))
        .addIntegerOption(opt => opt.setName('episode_hours').setDescription('Hours before new activity starts a new episode').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      new SlashCommandBuilder()
        .setName('status')
        .setDescription('View monitoring status, connected networks, rate limits, and errors'),
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(token);

    try {
      console.log('[Discord Bot] Registering application slash commands...');
      if (guildId) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log(`[Discord Bot] Registered ${commands.length} guild slash commands for guild ${guildId}`);
      } else {
        await rest.put(Routes.applicationCommands(clientId), { body: commands });
        console.log(`[Discord Bot] Registered ${commands.length} global slash commands`);
      }
    } catch (err) {
      console.error('[Discord Bot] Error registering slash commands:', err);
    }
  }

  /**
   * Slash command router
   */
  private async handleInteraction(interaction: ChatInputCommandInteraction) {
    const { commandName } = interaction;
    const responder = new SafeInteractionResponder(interaction);

    try {
      if (commandName === 'group-create') {
        const name = interaction.options.getString('name', true);
        const desc = interaction.options.getString('description') || undefined;
        const group = db.createGroup(name, desc);
        await responder.reply({
          content: `✅ Created wallet group **${group.name}** (ID: \`${group.id}\`)`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (commandName === 'group-list') {
        const groups = db.getGroups();
        const wallets = db.getWallets();
        const embed = new EmbedBuilder()
          .setTitle('📁 Tracked NFT Wallet Groups')
          .setColor(0x5865f2)
          .setFooter({ text: 'NFT Group Alert' });

        for (const g of groups) {
          const count = wallets.filter(w => w.groupIds.includes(g.id)).length;
          embed.addFields({
            name: `${g.enabled ? '🟢' : '⚪'} ${g.name}`,
            value: `Status: **${g.enabled ? 'Active' : 'Disabled'}** | Wallets: **${count}**\n${g.description || 'No description'}`,
            inline: false,
          });
        }

        await responder.reply({ embeds: [embed] });
      } else if (commandName === 'wallet-add') {
        const groupQuery = interaction.options.getString('group', true);
        const address = interaction.options.getString('address', true);
        const label = interaction.options.getString('label') || undefined;

        const group = db.getGroupById(groupQuery) || db.getGroupByName(groupQuery);
        if (!group) {
          await responder.reply({ content: `❌ Group "${groupQuery}" not found.`, flags: MessageFlags.Ephemeral });
          return;
        }

        const { wallet, isNew } = db.addWallet(address, group.id, label);
        await responder.reply({
          content: `✅ Wallet \`${wallet.address}\`${wallet.label ? ` (${wallet.label})` : ''} added to **${group.name}**! (${isNew ? 'New wallet registered' : 'Added to group'})`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (commandName === 'group-clear') {
        await responder.defer(true);
        const groupQuery = interaction.options.getString('group', true);
        const group = db.getGroupById(groupQuery) || db.getGroupByName(groupQuery);
        if (!group) {
          await responder.editReply({ content: `❌ Group "${groupQuery}" not found.` });
          return;
        }

        const result = db.clearWalletsInGroup(group.id);
        await responder.editReply({
          content: `✅ Removed all **${result.removedCount}** wallets from group **${group.name}**.`,
        });
      } else if (commandName === 'wallet-remove') {
        const groupQuery = interaction.options.getString('group', true);
        const address = interaction.options.getString('address', true);

        const group = db.getGroupById(groupQuery) || db.getGroupByName(groupQuery);
        if (!group) {
          await responder.reply({ content: `❌ Group "${groupQuery}" not found.`, flags: MessageFlags.Ephemeral });
          return;
        }

        // Support removing all wallets via /wallet-remove group:... address:all
        if (address.trim().toLowerCase() === 'all') {
          await responder.defer(true);
          const result = db.clearWalletsInGroup(group.id);
          await responder.editReply({
            content: `✅ Removed all **${result.removedCount}** wallets from group **${group.name}**.`,
          });
          return;
        }

        const removed = db.removeWalletFromGroup(address, group.id);
        if (removed) {
          await responder.reply({ content: `✅ Removed \`${address}\` from **${group.name}**.`, flags: MessageFlags.Ephemeral });
        } else {
          await responder.reply({ content: `❌ Wallet not found in group **${group.name}**.`, flags: MessageFlags.Ephemeral });
        }
      } else if (commandName === 'wallet-import') {
        // Acknowledge early within 3s for batch address parsing & DB I/O
        await responder.defer(true);
        const groupQuery = interaction.options.getString('group', true);
        const raw = interaction.options.getString('addresses', true);

        const group = db.getGroupById(groupQuery) || db.getGroupByName(groupQuery);
        if (!group) {
          await responder.editReply({ content: `❌ Group "${groupQuery}" not found.` });
          return;
        }

        const result = db.importWallets(raw, group.id);
        await responder.editReply({
          content: `✅ Imported to **${group.name}**:\n• **${result.added}** addresses added\n• **${result.existing}** already in group${result.errors.length > 0 ? `\n⚠️ ${result.errors.length} invalid addresses skipped` : ''}`,
        });
      } else if (commandName === 'monitor') {
        const action = interaction.options.getString('action', true);
        if (action === 'start') {
          db.updateSettings({ isMonitoring: true });
          monitor.start();
          await responder.reply({ content: '🟢 Multi-chain monitoring started!', flags: MessageFlags.Ephemeral });
        } else {
          db.updateSettings({ isMonitoring: false });
          monitor.stop();
          await responder.reply({ content: '🔴 Multi-chain monitoring paused.', flags: MessageFlags.Ephemeral });
        }
      } else if (commandName === 'alerts-channel') {
        const channel = interaction.options.getChannel('channel', true);

        // Check if category channel was passed
        if (channel.type === ChannelType.GuildCategory) {
          await responder.reply({
            content: `❌ **Cannot use a Category as an alert channel.**\n"${channel.name}" (${channel.id}) is a Category, not a text channel. Please select an actual text channel inside it (such as a text channel like #alpha)!`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Check if channel is text-based (standard text or announcement)
        if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
          await responder.reply({
            content: `❌ **Unsupported Channel Type:**\nChannel <#${channel.id}> is not a text channel. Please choose a standard text or announcement channel.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Check bot permissions on the chosen channel
        const perms = 'permissionsFor' in channel && typeof (channel as any).permissionsFor === 'function'
          ? (channel as any).permissionsFor(interaction.client.user!)
          : null;
        if (perms) {
          const missing: string[] = [];
          if (!perms.has(PermissionFlagsBits.ViewChannel)) missing.push('View Channel');
          if (!perms.has(PermissionFlagsBits.SendMessages)) missing.push('Send Messages');
          if (!perms.has(PermissionFlagsBits.EmbedLinks)) missing.push('Embed Links');

          if (missing.length > 0) {
            await responder.reply({
              content: `⚠️ **Insufficient Bot Permissions:**\nThe bot is missing the following permissions in <#${channel.id}>: **${missing.join(', ')}**.\nPlease grant these permissions to the bot role before using this channel.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        }

        db.updateSettings({ channelId: channel.id });
        await responder.reply({ content: `🔔 Alerts channel set to <#${channel.id}> (#${channel.name})!`, flags: MessageFlags.Ephemeral });
      } else if (commandName === 'alerts-role') {
        const role = interaction.options.getRole('role');
        db.updateSettings({ roleId: role ? role.id : '' });
        await responder.reply({ content: role ? `👥 Mention role set to <@&${role.id}>` : '👥 Mention role cleared.', flags: MessageFlags.Ephemeral });
      } else if (commandName === 'alert-settings') {
        const milestonesInput = interaction.options.getString('milestones');
        const episodeHours = interaction.options.getInteger('episode_hours');

        const updates: any = {};
        if (milestonesInput) {
          const parsed = milestonesInput.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
          if (parsed.length > 0) {
            updates.milestones = parsed.sort((a, b) => a - b);
          }
        }
        if (episodeHours && episodeHours > 0) {
          updates.episodeTimeoutHours = episodeHours;
        }

        if (Object.keys(updates).length > 0) {
          db.updateSettings(updates);
        }

        const current = db.getSettings();
        await responder.reply({
          content: `⚙️ **Current Alert Settings:**\n• Milestones: [${current.milestones.join(', ')}] unique wallets\n• Initial Alert: **${current.milestones[0]}** wallets\n• Episode Reset Window: **${current.episodeTimeoutHours}h**\n• Alerts Channel: ${current.channelId ? `<#${current.channelId}>` : '*Not set*'}\n• Role Mention: ${current.roleId ? `<@&${current.roleId}>` : '*None*'}`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (commandName === 'status') {
        // Acknowledge immediately before querying network latencies to prevent 10062 Unknown interaction
        await responder.defer(false);
        const networks = db.getNetworks();
        const settings = db.getSettings();
        const metrics = db.getMetrics();

        const embed = new EmbedBuilder()
          .setTitle('⚡ NFT Group Alert • Monitoring & Network Status')
          .setColor(settings.isMonitoring ? 0x10b981 : 0xef4444)
          .addFields(
            {
              name: 'Engine Status',
              value: `• State: **${settings.isMonitoring ? '🟢 Active Polling' : '🔴 Paused'}**\n• Unique Tracked Wallets: **${metrics.uniqueEnabledWallets}**\n• Active Groups: **${metrics.enabledGroups} / ${metrics.totalGroups}**\n• Total Events Tracked: **${metrics.totalActivitiesTracked}**\n• Alerts Sent: **${metrics.totalAlertsSent}**`,
              inline: false,
            }
          );

        const networkLines = networks.map(n => {
          const stateIcon = !n.isEnabled ? '⚪ [Disabled]' : n.isConnected ? '🟢 [Connected]' : '🔴 [Error]';
          const block = n.lastBlockChecked > 0 ? `#${n.lastBlockChecked}` : 'None';
          const lat = n.lastLatencyMs ? `${n.lastLatencyMs}ms` : '-';
          return `**${n.name}** (${n.currencySymbol})\n${stateIcon} Block: \`${block}\` | Latency: \`${lat}\`${n.lastError ? `\n⚠️ *${n.lastError.substring(0, 70)}*` : ''}`;
        });

        embed.addFields({
          name: '⛓️ Configured EVM Blockchains (Free RPCs)',
          value: networkLines.join('\n\n').substring(0, 1024),
          inline: false,
        });

        const missingConfig: string[] = [];
        if (!settings.channelId && !settings.webhookUrl) missingConfig.push('No alert destination set (use `/alerts-channel` or set Webhook)');
        if (metrics.uniqueEnabledWallets === 0) missingConfig.push('No active tracked wallets found (use `/wallet-add` or `/wallet-import`)');

        if (missingConfig.length > 0) {
          embed.addFields({
            name: '⚠️ Configuration Checklist',
            value: missingConfig.map(m => `• ${m}`).join('\n'),
            inline: false,
          });
        }

        await responder.editReply({ embeds: [embed] });
      }
    } catch (err: any) {
      console.error(`[Discord Bot] Error executing /${commandName}:`, err?.message || err);
      const isDiscordTimingError =
        err?.code === 10062 ||
        err?.code === 40060 ||
        err?.rawError?.code === 10062 ||
        err?.rawError?.code === 40060;

      if (isDiscordTimingError) {
        // Interaction expired or already acknowledged - do not attempt another response to avoid repeat loops
        return;
      }

      const msg = err instanceof Error ? err.message : 'Unknown error';
      await responder.sendError(msg);
    }
  }
}

/**
 * Safe Interaction Responder to guard against 10062 (Unknown interaction) and 40060 (Already acknowledged)
 */
export class SafeInteractionResponder {
  private interaction: ChatInputCommandInteraction;
  private acknowledged = false;
  private isDeferred = false;

  constructor(interaction: ChatInputCommandInteraction) {
    this.interaction = interaction;
    this.acknowledged = interaction.replied || interaction.deferred;
    this.isDeferred = interaction.deferred;
  }

  public isExpired(): boolean {
    return (Date.now() - this.interaction.createdTimestamp) > 2700;
  }

  public async defer(ephemeral = false): Promise<boolean> {
    if (this.acknowledged || this.interaction.replied || this.interaction.deferred) {
      return false;
    }
    if (this.isExpired()) {
      console.warn(`[Discord Bot] Interaction ${this.interaction.id} (/${this.interaction.commandName}) expired before defer. Aborting.`);
      return false;
    }
    try {
      await this.interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined });
      this.acknowledged = true;
      this.isDeferred = true;
      return true;
    } catch (err: any) {
      if (err?.code !== 10062 && err?.code !== 40060) {
        console.warn(`[Discord Bot] Failed to defer /${this.interaction.commandName}:`, err?.message || err);
      }
      return false;
    }
  }

  public async reply(options: { content?: string; embeds?: any[]; flags?: number }): Promise<boolean> {
    if (this.isDeferred || this.interaction.deferred) {
      return this.editReply(options);
    }
    if (this.acknowledged || this.interaction.replied) {
      return false;
    }
    if (this.isExpired()) {
      console.warn(`[Discord Bot] Interaction ${this.interaction.id} (/${this.interaction.commandName}) expired before reply. Aborting.`);
      return false;
    }
    try {
      await this.interaction.reply(options);
      this.acknowledged = true;
      return true;
    } catch (err: any) {
      if (err?.code !== 10062 && err?.code !== 40060) {
        console.warn(`[Discord Bot] Failed to reply to /${this.interaction.commandName}:`, err?.message || err);
      }
      return false;
    }
  }

  public async editReply(options: { content?: string; embeds?: any[] }): Promise<boolean> {
    try {
      const { flags, ...editOptions } = options as any;
      await this.interaction.editReply(editOptions);
      this.acknowledged = true;
      return true;
    } catch (err: any) {
      if (err?.code !== 10062 && err?.code !== 40060) {
        console.warn(`[Discord Bot] Failed to editReply to /${this.interaction.commandName}:`, err?.message || err);
      }
      return false;
    }
  }

  public async sendError(errorMessage: string): Promise<void> {
    if (this.isExpired()) return;
    try {
      if (this.isDeferred || this.interaction.deferred || this.interaction.replied || this.acknowledged) {
        await this.interaction.editReply({ content: `❌ Error: ${errorMessage}` });
      } else {
        await this.interaction.reply({ content: `❌ Error: ${errorMessage}`, flags: MessageFlags.Ephemeral });
        this.acknowledged = true;
      }
    } catch (err: any) {
      if (err?.code !== 10062 && err?.code !== 40060) {
        console.warn(`[Discord Bot] Error handler response failed for /${this.interaction.commandName}:`, err?.message || err);
      }
    }
  }
}

export const discordBot = new DiscordBotService();
