import { Module } from '@nestjs/common';
import { DiscordService } from './services/discord.service';
import { NotificationsController } from './controllers/notifications.controller';

/**
 * Notifications Module
 * Handles external notifications (Discord, Email, Slack, etc.)
 * Supports Discord webhooks and bot token
 * Provides test endpoints via NotificationsController
 */
@Module({
  controllers: [NotificationsController],
  providers: [DiscordService],
  exports: [DiscordService],
})
export class NotificationsModule {}
