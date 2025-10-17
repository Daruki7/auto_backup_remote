import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Test Notification DTO
 * For testing Discord notifications via Swagger
 */
export class TestNotificationDto {
  @ApiProperty({
    description: 'Notification title',
    example: 'Test Notification',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Notification message/description',
    example: 'This is a test notification from Swagger',
  })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'Notification type (affects color)',
    enum: ['success', 'error', 'warning', 'info'],
    example: 'success',
    default: 'info',
  })
  @IsEnum(['success', 'error', 'warning', 'info'])
  @IsOptional()
  type?: 'success' | 'error' | 'warning' | 'info' = 'info';

  @ApiPropertyOptional({
    description: 'Discord webhook URL (optional, uses env var if not provided)',
    example: 'https://discord.com/api/webhooks/123456/abcdef',
  })
  @IsString()
  @IsOptional()
  webhookUrl?: string;
}
