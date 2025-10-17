import { Module } from '@nestjs/common';
import { GoogleDriveService } from './services/google-drive.service';

/**
 * Google Drive Module
 * Handles cloud storage integration:
 * - File upload to Google Drive
 * - Folder management
 * - Service account authentication
 */
@Module({
  providers: [GoogleDriveService],
  exports: [GoogleDriveService],
})
export class GoogleDriveModule {}
