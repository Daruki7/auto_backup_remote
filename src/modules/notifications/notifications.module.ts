import { Module } from '@nestjs/common';
import { DiscordService } from './services/discord.service';

/**
 * Notifications Module
 * Handles external notifications (Discord, Email, Slack, etc.)
 * Currently supports Discord webhooks
 */
@Module({
  providers: [DiscordService],
  exports: [DiscordService],
})
export class NotificationsModule {}
