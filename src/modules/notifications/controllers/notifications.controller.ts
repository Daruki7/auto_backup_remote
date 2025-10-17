import { Controller, Post, Get, Body, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { DiscordService } from '../services/discord.service';
import { TestNotificationDto } from '../dto/test-notification.dto';

/**
 * Notifications Controller
 * Test and manage notification services (Discord, Email, etc.)
 */
@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly discordService: DiscordService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Test Discord notification
   * Send a test message to Discord to verify configuration
   */
  @Post('test-discord')
  @ApiOperation({
    summary: 'Test Discord notification',
    description:
      'Send a test message to Discord to verify webhook or bot token configuration. ' +
      'This endpoint helps debug Discord setup issues.',
  })
  @ApiBody({ type: TestNotificationDto })
  @ApiResponse({
    status: 200,
    description: 'Test notification sent successfully',
    schema: {
      example: {
        success: true,
        message: 'Discord notification sent successfully',
        method: 'bot',
        timestamp: '2025-10-18T04:05:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Discord not configured or failed to send',
  })
  async testDiscord(@Body() dto: TestNotificationDto): Promise<{
    success: boolean;
    message: string;
    method?: string;
    error?: string;
    timestamp: string;
  }> {
    this.logger.log('Testing Discord notification...');

    try {
      // Check if Discord is enabled
      if (!this.discordService.isEnabled()) {
        return {
          success: false,
          message: 'Discord notifications are not enabled',
          error:
            'Please set DISCORD_ENABLED=true and configure either DISCORD_BOT_TOKEN + DISCORD_CHANNEL_ID or DISCORD_WEBHOOK_URL in .env',
          timestamp: new Date().toISOString(),
        };
      }

      // Determine color based on type
      const colors = {
        success: 3066993, // Green
        error: 15158332, // Red
        warning: 15844367, // Orange
        info: 3447003, // Blue
      };

      const color = colors[dto.type || 'info'];

      // Send notification
      await this.discordService.sendNotification(
        {
          title: dto.title,
          description: dto.message,
          color: color,
          fields: [
            {
              name: '🧪 Test Type',
              value: dto.type || 'info',
              inline: true,
            },
            {
              name: '📅 Timestamp',
              value: new Date().toLocaleString(),
              inline: true,
            },
            {
              name: '🔍 Source',
              value: 'Swagger API Test',
              inline: false,
            },
          ],
          timestamp: new Date(),
        },
        dto.webhookUrl,
      );

      const method = this.discordService.getNotificationMethod();

      this.logger.log('✅ Discord notification sent successfully');

      return {
        success: true,
        message: 'Discord notification sent successfully',
        method: method,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to send Discord notification: ${error.message}`,
      );

      return {
        success: false,
        message: 'Failed to send Discord notification',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get Discord configuration status
   * Check if Discord is properly configured
   */
  @Get('discord-status')
  @ApiOperation({
    summary: 'Check Discord configuration status',
    description:
      'Returns detailed information about Discord configuration and status. ' +
      'Helps diagnose configuration issues.',
  })
  @ApiResponse({
    status: 200,
    description: 'Discord configuration status',
    schema: {
      example: {
        enabled: true,
        configured: true,
        method: 'bot',
        botTokenConfigured: true,
        channelIdConfigured: true,
        webhookUrlConfigured: false,
        clientReady: true,
        recommendations: [],
      },
    },
  })
  async getDiscordStatus(): Promise<{
    enabled: boolean;
    configured: boolean;
    method: string;
    botTokenConfigured: boolean;
    channelIdConfigured: boolean;
    webhookUrlConfigured: boolean;
    clientReady?: boolean;
    recommendations: string[];
    envVariables: {
      DISCORD_ENABLED: string;
      DISCORD_BOT_TOKEN: string;
      DISCORD_CHANNEL_ID: string;
      DISCORD_WEBHOOK_URL: string;
    };
  }> {
    const recommendations: string[] = [];

    // Check configuration
    const botTokenConfigured =
      !!this.configService.get<string>('discord.botToken');
    const channelIdConfigured =
      !!this.configService.get<string>('discord.channelId');
    const webhookUrlConfigured =
      !!this.configService.get<string>('discord.webhookUrl');
    const enabled = this.configService.get<boolean>('discord.enabled');
    const method = this.discordService.getNotificationMethod();
    const configured = enabled && (botTokenConfigured || webhookUrlConfigured);

    // Generate recommendations
    if (!enabled) {
      recommendations.push(
        'Set DISCORD_ENABLED=true in .env file to enable Discord notifications',
      );
    }

    if (enabled && !botTokenConfigured && !webhookUrlConfigured) {
      recommendations.push(
        'Configure either Bot Token (DISCORD_BOT_TOKEN + DISCORD_CHANNEL_ID) or Webhook (DISCORD_WEBHOOK_URL) in .env',
      );
    }

    if (botTokenConfigured && !channelIdConfigured) {
      recommendations.push(
        'DISCORD_CHANNEL_ID is required when using bot token. Set it in .env',
      );
    }

    if (method === 'none' && enabled) {
      recommendations.push(
        'No valid Discord configuration found. Check .env file and restart app',
      );
    }

    if (method === 'webhook') {
      recommendations.push(
        'Currently using Webhook method. Consider using Bot Token for better performance and features',
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Discord is properly configured!');
    }

    return {
      enabled,
      configured,
      method,
      botTokenConfigured,
      channelIdConfigured,
      webhookUrlConfigured,
      recommendations,
      envVariables: {
        DISCORD_ENABLED: process.env.DISCORD_ENABLED || 'not set',
        DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN
          ? '***configured***'
          : 'not set',
        DISCORD_CHANNEL_ID: process.env.DISCORD_CHANNEL_ID || 'not set',
        DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL
          ? '***configured***'
          : 'not set',
      },
    };
  }

  /**
   * Test backup success notification
   * Simulate a successful backup notification
   */
  @Post('test-backup-success')
  @ApiOperation({
    summary: 'Test backup success notification',
    description: 'Send a test backup success notification to Discord',
  })
  @ApiResponse({
    status: 200,
    description: 'Test notification sent',
  })
  async testBackupSuccess(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      if (!this.discordService.isEnabled()) {
        return {
          success: false,
          message:
            'Discord is not enabled. Check /notifications/discord-status for details',
        };
      }

      await this.discordService.sendBackupSuccess(
        'test-server',
        125.43, // 125.43 MB
        42.1, // 42.1 seconds
        'H:/Backup/test-server/2025_10_18-Database_test-server/uploads.zip',
        true, // Google Drive uploaded
      );

      return {
        success: true,
        message: 'Test backup success notification sent to Discord',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed: ${error.message}`,
      };
    }
  }

  /**
   * Test backup failure notification
   * Simulate a failed backup notification
   */
  @Post('test-backup-failure')
  @ApiOperation({
    summary: 'Test backup failure notification',
    description: 'Send a test backup failure notification to Discord',
  })
  @ApiResponse({
    status: 200,
    description: 'Test notification sent',
  })
  async testBackupFailure(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      if (!this.discordService.isEnabled()) {
        return {
          success: false,
          message:
            'Discord is not enabled. Check /notifications/discord-status for details',
        };
      }

      await this.discordService.sendBackupFailure(
        'test-server',
        'SSH connection timeout - This is a test error message',
        15.3, // 15.3 seconds before failure
      );

      return {
        success: true,
        message: 'Test backup failure notification sent to Discord',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed: ${error.message}`,
      };
    }
  }
}
