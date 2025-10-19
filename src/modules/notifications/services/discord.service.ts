import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';

/**
 * Discord Notification Interface
 */
export interface DiscordNotification {
  title: string;
  description: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp?: Date;
}

/**
 * Discord Notification Service
 * Supports TWO methods:
 * 1. Webhook (Simple) - No bot token needed, just webhook URL
 * 2. Bot Token (Advanced) - Full discord.js client with more features
 *
 * Method selection:
 * - If DISCORD_BOT_TOKEN is set → Use bot client
 * - If DISCORD_WEBHOOK_URL is set → Use webhook
 * - If both → Use bot token (preferred)
 */
@Injectable()
export class DiscordService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordService.name);
  private discordClient: Client | null = null;
  private isClientReady: boolean = false;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initialize Discord client if bot token is provided
   */
  async onModuleInit() {
    const botToken = this.configService.get<string>('discord.botToken');
    const channelId = this.configService.get<string>('discord.channelId');

    if (botToken && channelId) {
      this.logger.log('Initializing Discord.js client with bot token...');

      try {
        this.discordClient = new Client({
          intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
          ],
        });

        this.discordClient.once('clientReady', (readyClient) => {
          this.isClientReady = true;
          this.logger.log(
            `✅ Discord bot logged in as ${readyClient.user.tag}`,
          );
          this.logger.log(
            `📢 Will send notifications to channel ID: ${channelId}`,
          );
        });

        this.discordClient.on('error', (error) => {
          this.logger.error(`Discord client error: ${error.message}`);
        });

        await this.discordClient.login(botToken);
      } catch (error) {
        this.logger.error(
          `Failed to initialize Discord client: ${error.message}`,
        );
        this.logger.warn('Falling back to webhook method if available');
        this.discordClient = null;
      }
    } else if (this.configService.get<string>('discord.webhookUrl')) {
      this.logger.log('Discord webhook method configured');
    } else {
      this.logger.warn(
        'No Discord configuration found (neither bot token nor webhook)',
      );
    }
  }

  /**
   * Cleanup Discord client on module destroy
   */
  async onModuleDestroy() {
    if (this.discordClient) {
      this.logger.log('Destroying Discord client...');
      await this.discordClient.destroy();
      this.discordClient = null;
      this.isClientReady = false;
    }
  }

  /**
   * Send notification to Discord
   * Automatically chooses best method: bot token > webhook
   * @param notification Notification data
   * @param webhookUrl Optional: Override default webhook URL
   */
  async sendNotification(
    notification: DiscordNotification,
    webhookUrl?: string,
  ): Promise<void> {
    try {
      // Method 1: Try bot token first (if available and ready)
      if (this.discordClient && this.isClientReady) {
        await this.sendViaBotToken(notification);
        return;
      }

      // Method 2: Fallback to webhook
      const finalWebhookUrl =
        webhookUrl || this.configService.get<string>('discord.webhookUrl');

      if (finalWebhookUrl) {
        await this.sendViaWebhook(notification, finalWebhookUrl);
        return;
      }

      // No method available
      this.logger.warn(
        'No Discord notification method configured. Skipping notification.',
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to send Discord notification: ${error.message}`,
      );
      // Don't throw - notification failure shouldn't break backup
    }
  }

  /**
   * Send notification via Bot Token (discord.js)
   * More powerful, supports more features
   * @param notification Notification data
   */
  private async sendViaBotToken(
    notification: DiscordNotification,
  ): Promise<void> {
    const channelId = this.configService.get<string>('discord.channelId');

    if (!channelId) {
      throw new Error('DISCORD_CHANNEL_ID not configured');
    }

    try {
      // Fetch channel
      const channel = await this.discordClient.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(
          `Channel ${channelId} not found or is not a text channel`,
        );
      }

      // Build embed using discord.js EmbedBuilder
      const embed = new EmbedBuilder()
        .setTitle(notification.title)
        .setDescription(notification.description)
        .setColor(notification.color || 3066993) // Default: green
        .setTimestamp(notification.timestamp || new Date())
        .setFooter({ text: 'Auto Backup System' });

      // Add fields if provided
      if (notification.fields && notification.fields.length > 0) {
        notification.fields.forEach((field) => {
          embed.addFields({
            name: field.name,
            value: field.value,
            inline: field.inline || false,
          });
        });
      }

      // Send message
      await (channel as TextChannel).send({ embeds: [embed] });

      this.logger.log(
        '✅ Discord notification sent successfully (via bot token)',
      );
    } catch (error) {
      this.logger.error(`Failed to send via bot token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send notification via Webhook (axios)
   * Simple, no bot token needed
   * @param notification Notification data
   * @param webhookUrl Webhook URL
   */
  private async sendViaWebhook(
    notification: DiscordNotification,
    webhookUrl: string,
  ): Promise<void> {
    try {
      // Build Discord embed
      const embed = {
        title: notification.title,
        description: notification.description,
        color: notification.color || 3066993, // Default: green
        fields: notification.fields || [],
        timestamp: (notification.timestamp || new Date()).toISOString(),
        footer: {
          text: 'Auto Backup System',
        },
      };

      // Send to Discord webhook
      await axios.post(webhookUrl, {
        embeds: [embed],
        username:
          this.configService.get<string>('discord.botUsername') || 'Backup Bot',
        avatar_url: this.configService.get<string>('discord.botAvatarUrl'),
      });

      this.logger.log(
        '✅ Discord notification sent successfully (via webhook)',
      );
    } catch (error) {
      this.logger.error(`Failed to send via webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send backup success notification
   */
  async sendBackupSuccess(
    serverName: string,
    fileSize: number,
    duration: number,
    localPath: string,
    googleDriveUploaded: boolean = false,
    uploadMethod?: 'direct' | 'local',
    googleDriveFolderName?: string,
  ): Promise<void> {
    const fields: Array<{ name: string; value: string; inline: boolean }> = [
      {
        name: '🖥️ Server',
        value: serverName,
        inline: true,
      },
      {
        name: '💾 Kích thước',
        value: `${fileSize.toFixed(2)} MB`,
        inline: true,
      },
      {
        name: '⏱️ Thời gian',
        value: `${duration.toFixed(1)}s`,
        inline: true,
      },
    ];

    // Add upload method if provided
    if (uploadMethod) {
      const methodDisplay =
        uploadMethod === 'direct'
          ? '🚀 Direct (SSH → Drive)'
          : '💾 Local (SSH → PC → Drive)';
      fields.push({
        name: '📤 Phương pháp',
        value: methodDisplay,
        inline: false,
      });
    }

    // Add local path if exists
    if (localPath) {
      fields.push({
        name: '📁 Vị trí file local',
        value: `\`${localPath}\``,
        inline: false,
      });
    }

    // Add Google Drive info
    if (googleDriveUploaded) {
      fields.push({
        name: '☁️ Google Drive',
        value: '✅ Đã upload thành công',
        inline: true,
      });

      // Add folder name if provided
      if (googleDriveFolderName) {
        fields.push({
          name: '📂 Folder trên Drive',
          value: `\`${googleDriveFolderName}\``,
          inline: false,
        });
      }
    } else {
      fields.push({
        name: '☁️ Google Drive',
        value: '❌ Không upload',
        inline: true,
      });
    }

    const notification: DiscordNotification = {
      title: '✅ Backup Thành Công',
      description: `Server **${serverName}** đã được backup thành công!`,
      color: 3066993, // Green
      fields,
      timestamp: new Date(),
    };

    await this.sendNotification(notification);
  }

  /**
   * Send backup failure notification
   */
  async sendBackupFailure(
    serverName: string,
    error: string,
    duration: number,
  ): Promise<void> {
    const notification: DiscordNotification = {
      title: '❌ Backup Thất Bại',
      description: `Backup server **${serverName}** đã thất bại!`,
      color: 15158332, // Red
      fields: [
        {
          name: '🖥️ Server',
          value: serverName,
          inline: true,
        },
        {
          name: '⏱️ Thời gian',
          value: `${duration.toFixed(1)}s`,
          inline: true,
        },
        {
          name: '❌ Lỗi',
          value: `\`${error}\``,
          inline: false,
        },
      ],
      timestamp: new Date(),
    };

    await this.sendNotification(notification);
  }

  /**
   * Send bulk backup summary notification
   */
  async sendBulkBackupSummary(
    totalServers: number,
    successCount: number,
    failureCount: number,
    totalTime: string,
    results: Array<{ serverName: string; success: boolean; fileSize?: number }>,
  ): Promise<void> {
    const successRate = ((successCount / totalServers) * 100).toFixed(1);
    const color = failureCount === 0 ? 3066993 : 15844367; // Green if all success, orange if some failed

    const successServers = results
      .filter((r) => r.success)
      .map((r) => `✅ ${r.serverName}`)
      .join('\n');

    const failedServers = results
      .filter((r) => !r.success)
      .map((r) => `❌ ${r.serverName}`)
      .join('\n');

    const fields = [
      {
        name: '📊 Tổng quan',
        value: `${successCount}/${totalServers} servers thành công (${successRate}%)`,
        inline: false,
      },
      {
        name: '⏱️ Tổng thời gian',
        value: totalTime,
        inline: true,
      },
    ];

    if (successServers) {
      fields.push({
        name: '✅ Thành công',
        value: successServers,
        inline: false,
      });
    }

    if (failedServers) {
      fields.push({
        name: '❌ Thất bại',
        value: failedServers,
        inline: false,
      });
    }

    const notification: DiscordNotification = {
      title: '📊 Báo cáo Bulk Backup',
      description: `Hoàn thành backup ${totalServers} servers`,
      color: color,
      fields: fields,
      timestamp: new Date(),
    };

    await this.sendNotification(notification);
  }

  /**
   * Check if Discord notifications are enabled
   * @returns True if enabled (either bot token or webhook configured)
   */
  isEnabled(): boolean {
    const hasBotToken =
      !!this.configService.get<string>('discord.botToken') &&
      !!this.configService.get<string>('discord.channelId');
    const hasWebhook = !!this.configService.get<string>('discord.webhookUrl');
    const enabled = this.configService.get<boolean>('discord.enabled');
    return enabled && (hasBotToken || hasWebhook);
  }

  /**
   * Get notification method being used
   * @returns 'bot' | 'webhook' | 'none'
   */
  getNotificationMethod(): 'bot' | 'webhook' | 'none' {
    if (this.discordClient && this.isClientReady) {
      return 'bot';
    }
    if (this.configService.get<string>('discord.webhookUrl')) {
      return 'webhook';
    }
    return 'none';
  }

  /**
   * Get default webhook URL from config
   * @returns Webhook URL or undefined
   */
  getDefaultWebhookUrl(): string | undefined {
    return this.configService.get<string>('discord.webhookUrl');
  }
}
