import { Module } from '@nestjs/common';
import { SshCommandService } from './services/ssh-command.service';
import { SftpClientService } from './services/sftp-client.service';
import { DirectUploadService } from './services/direct-upload.service';
import { HybridUploadService } from './services/hybrid-upload.service';
import { LargeFileUploadService } from './services/large-file-upload.service';
import { GoogleDriveService } from '../google-drive/services/google-drive.service';

/**
 * Shared Module
 * Provides common services used across multiple modules
 * - SSH command execution
 * - SFTP file operations
 * - Direct upload capabilities
 * - Hybrid upload with fallback
 */
@Module({
  providers: [
    SshCommandService,
    SftpClientService,
    DirectUploadService,
    HybridUploadService,
    LargeFileUploadService,
    GoogleDriveService,
  ],
  exports: [
    SshCommandService,
    SftpClientService,
    DirectUploadService,
    HybridUploadService,
    LargeFileUploadService,
  ],
})
export class SharedModule {}
