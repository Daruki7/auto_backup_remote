import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BackupController } from './controllers/backup.controller';
import { BackupService } from './services/backup.service';
import { CompressionService } from './services/compression.service';
import { FileTransferService } from './services/file-transfer.service';

/**
 * Backup Module
 * Core backup functionality including:
 * - SSH connection and command execution
 * - Remote file compression
 * - Optimized SFTP file transfer
 * - Backup orchestration
 * - Discord notifications
 */
@Module({
  imports: [SharedModule, GoogleDriveModule, NotificationsModule],
  controllers: [BackupController],
  providers: [BackupService, CompressionService, FileTransferService],
  exports: [BackupService],
})
export class BackupModule {}
