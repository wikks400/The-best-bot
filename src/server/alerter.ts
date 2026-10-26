import {
  ActivityType,
  AlertMilestoneRecord,
  GroupActivitySummary,
  ProjectInfo,
  NetworkConfig,
} from '../types/index.ts';
import { db } from './db.ts';
import { discordBot } from '../bot/client.ts';

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbedPayload {
  title: string;
  description?: string;
  color: number;
  fields: DiscordEmbedField[];
  footer?: { text: string };
  timestamp?: string;
}

/**
 * Format group activity section as requested in Section 9:
 * 
 * GROUP ACTIVITY
 * Degen Minters
 * 2 wallets | 5 NFTs minted
 * 
 * Smart Traders
 * 3 wallets | 7 NFTs minted
 * 
 * TOTAL
 * 7 unique tracked wallets
 * 15 NFTs minted
 */
export function formatGroupActivityText(
  breakdown: GroupActivitySummary[],
  totalUniqueWallets: number,
  totalNfts: number,
  activityType: ActivityType
): string {
  const nftAction = activityType === 'mint' ? 'NFTs minted' : 'NFTs purchased';
  const lines: string[] = [];

  for (const group of breakdown) {
    lines.push(`**${group.groupName}**`);
    lines.push(`${group.walletCount} wallet${group.walletCount === 1 ? '' : 's'} | ${group.nftCount} ${nftAction}\n`);
  }

  lines.push(`**TOTAL**`);
  lines.push(`${totalUniqueWallets} unique tracked wallet${totalUniqueWallets === 1 ? '' : 's'}`);
  lines.push(`${totalNfts} ${nftAction}`);

  return lines.join('\n');
}

/**
 * Build rich Discord embed strictly following the prompt specifications:
 * Section 10: Initial Mint Notification
 * Section 11: Initial Buy Notification
 * Section 12: Follow-up Compact Notification
 */
export function buildDiscordEmbed(
  milestone: AlertMilestoneRecord,
  project: ProjectInfo,
  network: NetworkConfig
): DiscordEmbedPayload {
  const isInitial = milestone.milestoneIndex === 1;
  const isMint = milestone.activityType === 'mint';

  // Embed colors: Orange-Red for Mint (0xFF4500), Emerald Green for Buy (0x10B981)
  const color = isMint ? 0xff4500 : 0x10b981;

  if (isInitial) {
    const title = isMint
      ? `🔥 EARLY NFT MINT ALERT`
      : `🛒 EARLY NFT BUY ALERT`;

    const walletLabel = isMint ? '👛 Tracked wallets minting' : '👛 Tracked wallets buying';
    const nftLabel = isMint ? '🖼 NFTs minted' : '🖼 NFTs purchased';

    const fields: DiscordEmbedField[] = [
      {
        name: 'Project & Chain',
        value: `**Project:** ${project.name}\n**Chain:** ${network.name} (${network.currencySymbol})`,
        inline: false,
      },
      {
        name: 'Participation',
        value: `${walletLabel}: **${milestone.totalUniqueWallets}**\n${nftLabel}: **${milestone.totalNfts}**${
          !isMint && milestone.priceNative
            ? `\n💰 Total purchase value: **${milestone.priceNative.toFixed(4)} ${network.currencySymbol}**`
            : ''
        }`,
        inline: false,
      },
      {
        name: '👥 GROUP ACTIVITY',
        value: formatGroupActivityText(
          milestone.groupBreakdown,
          milestone.totalUniqueWallets,
          milestone.totalNfts,
          milestone.activityType
        ),
        inline: false,
      },
    ];

    // Project Information (Only verified info included)
    const projectInfoLines: string[] = [];
    if (project.description) projectInfoLines.push(`**Description:** ${project.description}`);
    if (project.website) projectInfoLines.push(`**Website:** [${project.website}](${project.website})`);
    if (project.twitter) projectInfoLines.push(`**X / Twitter:** [@${project.twitter.replace(/^@/, '')}](https://x.com/${project.twitter.replace(/^@/, '')})`);
    if (project.discord) projectInfoLines.push(`**Discord:** [Official Invite](${project.discord})`);

    if (projectInfoLines.length > 0) {
      fields.push({
        name: 'ℹ️ PROJECT INFORMATION',
        value: projectInfoLines.join('\n'),
        inline: false,
      });
    }

    // Links
    const links: string[] = [];
    if (project.openseaUrl) {
      links.push(`🔗 [OpenSea Collection](${project.openseaUrl})`);
    }
    if (isMint && project.openseaMintUrl) {
      links.push(`🔗 [OpenSea Mint](${project.openseaMintUrl})`);
    }
    if (project.explorerUrl) {
      links.push(`🔗 [Blockchain Explorer](${project.explorerUrl})`);
    }

    if (links.length > 0) {
      fields.push({
        name: '🔗 LINKS',
        value: links.join('  •  '),
        inline: false,
      });
    }

    return {
      title,
      color,
      fields,
      footer: { text: `NFT Group Alert • Episode Milestone 1/${db.getSettings().maxAlertsPerEpisode}` },
      timestamp: new Date(milestone.sentAt).toISOString(),
    };
  } else {
    // Follow-up compact notification (Section 12)
    const title = isMint
      ? `🔥 NFT MINT UPDATE #${milestone.milestoneIndex}`
      : `🛒 NFT BUY UPDATE #${milestone.milestoneIndex}`;

    const fields: DiscordEmbedField[] = [
      {
        name: 'Project & Chain',
        value: `**Project:** ${project.name}  |  **Chain:** ${network.name}`,
        inline: false,
      },
      {
        name: 'Milestone Progress',
        value: `👛 Total tracked minters: **${milestone.totalUniqueWallets}**\n🆕 New wallets since previous alert: **${milestone.newWalletsSinceLast}**\n🖼 Total NFTs ${isMint ? 'minted' : 'purchased'}: **${milestone.totalNfts}**`,
        inline: false,
      },
      {
        name: '👥 GROUP ACTIVITY',
        value: formatGroupActivityText(
          milestone.groupBreakdown,
          milestone.totalUniqueWallets,
          milestone.totalNfts,
          milestone.activityType
        ),
        inline: false,
      },
    ];

    const links: string[] = [];
    if (isMint && project.openseaMintUrl) {
      links.push(`🔗 [OpenSea Mint](${project.openseaMintUrl})`);
    }
    if (project.openseaUrl) {
      links.push(`🔗 [OpenSea Collection](${project.openseaUrl})`);
    }
    if (project.explorerUrl) {
      links.push(`🔗 [Explorer](${project.explorerUrl})`);
    }

    if (links.length > 0) {
      fields.push({
        name: '🔗 LINKS',
        value: links.join('  •  '),
        inline: false,
      });
    }

    return {
      title,
      color,
      fields,
      footer: {
        text: `NFT Group Alert • Milestone ${milestone.milestoneIndex}/${db.getSettings().maxAlertsPerEpisode} (${milestone.thresholdWallets}+ Wallets)`,
      },
      timestamp: new Date(milestone.sentAt).toISOString(),
    };
  }
}

/**
 * Send alert payload to Discord via Webhook URL
 */
export async function sendDiscordWebhook(
  webhookUrl: string,
  embed: DiscordEmbedPayload,
  roleId?: string
): Promise<{ success: boolean; error?: string; isUnknownWebhook?: boolean }> {
  try {
    if (!webhookUrl || !webhookUrl.trim()) {
      return { success: false, error: 'Configuration variable DISCORD_WEBHOOK_URL is not configured.' };
    }

    const cleanUrl = webhookUrl.trim();
    if (!cleanUrl.startsWith('https://discord.com/api/webhooks/') && !cleanUrl.startsWith('https://discordapp.com/api/webhooks/')) {
      return {
        success: false,
        error: 'Configuration variable DISCORD_WEBHOOK_URL is malformed. Expected a Discord webhook URL (https://discord.com/api/webhooks/...).',
      };
    }

    const content = roleId ? `<@&${roleId}>` : undefined;

    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        content,
        embeds: [embed],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      let isUnknownWebhook = false;
      try {
        const json = JSON.parse(text);
        if (json.code === 10015 || res.status === 404) {
          isUnknownWebhook = true;
        }
      } catch {
        if (res.status === 404) isUnknownWebhook = true;
      }

      if (isUnknownWebhook) {
        return {
          success: false,
          isUnknownWebhook: true,
          error:
            'The webhook configured in DISCORD_WEBHOOK_URL was deleted in Discord (Error 10015: Unknown Webhook). Please recreate a new webhook in Discord Channel Settings > Integrations and update DISCORD_WEBHOOK_URL in Botkeep / environment variables.',
        };
      }

      return { success: false, error: `Discord Webhook HTTP ${res.status}: ${text}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Evaluate if a project has crossed any milestone thresholds, and fire alerts
 */
export async function evaluateAndDispatchAlerts(
  chainId: number,
  contractAddress: string,
  activityType: ActivityType,
  project: ProjectInfo,
  network: NetworkConfig
): Promise<AlertMilestoneRecord | null> {
  const cleanAddr = contractAddress.toLowerCase();
  const settings = db.getSettings();

  const episodeId = db.getEpisodeId(chainId, cleanAddr, activityType);
  const existingMilestones = db.getMilestonesForEpisode(episodeId);

  // Enforce unique alert limit (strictly 3 unique alerts per episode for successfully sent alerts)
  const maxAlerts = settings.maxAlertsPerEpisode || 3;
  const sentMilestones = existingMilestones.filter(m => m.status === 'sent');
  if (sentMilestones.length >= maxAlerts) {
    return null;
  }

  // Calculate current unique wallets from enabled groups
  const breakdownData = db.calculateGroupBreakdown(chainId, cleanAddr, activityType);
  const currentUniqueCount = breakdownData.totalUniqueCount;

  const milestones = settings.milestones || [3, 7, 12];

  // Determine what milestone we qualify for
  let highestReachedIndex = -1;
  for (let i = 0; i < milestones.length; i++) {
    if (currentUniqueCount >= milestones[i]) {
      highestReachedIndex = i;
    }
  }

  if (highestReachedIndex === -1) {
    // Under milestone threshold, no alert yet
    return null;
  }

  // Check if this milestone index has already been successfully sent
  const highestIndexToSend = highestReachedIndex + 1; // 1-based (1, 2, 3)
  if (highestIndexToSend > maxAlerts) {
    return null;
  }
  const alreadySent = sentMilestones.some(m => m.milestoneIndex >= highestIndexToSend);
  if (alreadySent) {
    return null;
  }

  // Previous wallet count for milestone delta
  const lastSentMilestone = sentMilestones.length > 0 ? sentMilestones[sentMilestones.length - 1] : null;
  const previousWalletCount = lastSentMilestone ? lastSentMilestone.totalUniqueWallets : 0;
  const newWalletsSinceLast = Math.max(0, currentUniqueCount - previousWalletCount);

  const milestoneRecord: AlertMilestoneRecord = {
    id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    episodeId,
    chainId,
    chainName: network.name,
    contractAddress: cleanAddr,
    projectName: project.name,
    activityType,
    milestoneIndex: highestIndexToSend,
    thresholdWallets: milestones[highestReachedIndex],
    totalUniqueWallets: currentUniqueCount,
    newWalletsSinceLast,
    totalNfts: breakdownData.totalNfts,
    priceNative: breakdownData.totalPriceNative > 0 ? breakdownData.totalPriceNative : undefined,
    currencySymbol: network.currencySymbol,
    groupBreakdown: breakdownData.groupBreakdown,
    projectInfo: project,
    sentAt: Date.now(),
    status: 'sent',
  };

  // Build embed
  const embed = buildDiscordEmbed(milestoneRecord, project, network);

  let alertDispatched = false;

  // 1. Try Discord Webhook if configured
  if (settings.webhookUrl && settings.webhookUrl.trim()) {
    const webhookRes = await sendDiscordWebhook(settings.webhookUrl, embed, settings.roleId);
    if (webhookRes.success) {
      alertDispatched = true;
      console.log(`[Alerter] Successfully dispatched milestone alert to Discord webhook.`);
    } else {
      if (webhookRes.isUnknownWebhook) {
        console.warn(`[Alerter] Webhook Notice: ${webhookRes.error}`);
      } else {
        console.warn(`[Alerter] Discord webhook delivery error: ${webhookRes.error}`);
      }
    }
  }

  // 2. If webhook was NOT dispatched (not configured or failed), use Discord Bot text channel fallback
  // (Prevents duplicate delivery through both webhook and channel fallback)
  if (!alertDispatched && settings.channelId && discordBot.isConnected()) {
    console.log(`[Alerter] Attempting alert delivery via Discord Bot text channel #${settings.channelId}...`);
    const channelRes = await discordBot.sendChannelAlert(settings.channelId, embed, settings.roleId);
    if (channelRes.success) {
      alertDispatched = true;
      console.log(`[Alerter] Successfully dispatched milestone alert to channel #${settings.channelId}`);
    } else {
      console.warn(`[Alerter] Bot channel delivery error: ${channelRes.error}`);
    }
  }

  // Update record status accurately: never report success when delivery failed
  if (alertDispatched) {
    milestoneRecord.status = 'sent';
  } else {
    milestoneRecord.status = 'failed';
    console.error(`[Alerter] Milestone alert delivery failed for ${project.name} (${cleanAddr}). Status marked as failed.`);
  }

  // Record milestone in DB to prevent duplicates even after server restart
  db.recordMilestone(milestoneRecord);
  return milestoneRecord;
}
