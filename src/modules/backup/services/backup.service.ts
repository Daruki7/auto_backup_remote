import { Injectable, Logger } from '@nestjs/common';
import { SshCommandService } from '../../shared/services';
import { CompressionService } from './compression.service';
import { FileTransferService } from './file-transfer.service';
import { GoogleDriveService } from '../../google-drive/services/google-drive.service';
import { DiscordService } from '../../notifications/services/discord.service';
import { BackupConfig } from '../../../config/backup.config';

/**
 * Backup Result Interface
 * Contains the result of a backup operation
 */
export interface BackupResult {
  success: boolean;
  serverName: string;
  localFilePath?: string;
  googleDriveFileId?: string;
  fileSize?: number;
  error?: string;
  steps: {
    sshConnection: boolean;
    directoryCheck: boolean;
    compression: boolean;
    download: boolean;
    googleDriveUpload: boolean;
  };
}

/**
 * Backup Service
 * Main orchestrator for backup operations
 * Coordinates SSH, compression, download, and cloud upload workflows
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly sshCommandService: SshCommandService,
    private readonly compressionService: CompressionService,
    private readonly fileTransferService: FileTransferService,
    private readonly googleDriveService: GoogleDriveService,
    private readonly discordService: DiscordService,
  ) {}

  /**
   * Execute the complete backup workflow
   * @param config Backup configuration
   * @returns Backup result with status and metrics
   */
  async executeBackup(config: BackupConfig): Promise<BackupResult> {
    const startTime = Date.now(); // Track backup duration
    const result: BackupResult = {
      success: false,
      serverName: config.serverName,
      steps: {
        sshConnection: false,
        directoryCheck: false,
        compression: false,
        download: false,
        googleDriveUpload: false,
      },
    };

    let remoteCompressedFile: string | null = null;

    try {
      // Step 1: Test SSH connection
      this.logger.log(`[${config.serverName}] Step 1: Testing SSH connection`);
      const connectionSuccess = await this.sshCommandService.testConnection(
        config.sshConfig,
      );
      if (!connectionSuccess) {
        throw new Error('SSH connection test failed');
      }
      result.steps.sshConnection = true;
      this.logger.log(`[${config.serverName}] SSH connection successful`);

      // Step 1.5: Check required tools
      this.logger.log(
        `[${config.serverName}] Step 1.5: Checking required tools`,
      );
      const toolCheck = await this.sshCommandService.checkRequiredTools(
        config.sshConfig,
        config.compressionType,
      );
      if (!toolCheck.available) {
        throw new Error(
          `Required tools not installed: ${toolCheck.missing.join(', ')}. ` +
            `Please run: sudo apt-get install ${toolCheck.missing.join(' ')}`,
        );
      }

      // Step 2: Check if target folder exists
      this.logger.log(`[${config.serverName}] Step 2: Checking target folder`);
      const targetPath = `${config.remoteDirectory}/${config.targetFolder}`;
      const folderExists = await this.sshCommandService.directoryExists(
        config.sshConfig,
        targetPath,
      );

      if (!folderExists) {
        throw new Error(`Target folder not found: ${targetPath}`);
      }
      result.steps.directoryCheck = true;
      this.logger.log(
        `[${config.serverName}] Target folder found: ${targetPath}`,
      );

      // Step 3: Compress the folder
      this.logger.log(`[${config.serverName}] Step 3: Compressing folder`);
      remoteCompressedFile = await this.compressionService.compressFolder(
        config.sshConfig,
        targetPath,
        config.compressionType,
      );
      result.steps.compression = true;
      this.logger.log(
        `[${config.serverName}] Compression successful: ${remoteCompressedFile}`,
      );

      // Step 4: Download the compressed file (OPTIMIZED with ssh2-sftp-client)
      this.logger.log(
        `[${config.serverName}] Step 4: Downloading file (optimized)`,
      );
      const localFilePath =
        await this.fileTransferService.downloadAndOrganizeFile(
          config.sshConfig,
          remoteCompressedFile,
          config.localBackupPath,
          config.serverName,
        );
      result.localFilePath = localFilePath;
      result.steps.download = true;

      const fileSizeMB = this.fileTransferService.getFileSizeMB(localFilePath);
      result.fileSize = fileSizeMB;
      this.logger.log(
        `[${config.serverName}] Download successful: ${localFilePath} (${fileSizeMB.toFixed(2)} MB)`,
      );

      // Step 5: Upload to Google Drive (if enabled)
      // Check if Google Drive upload is enabled:
      // 1. If explicitly set in config, use that value
      // 2. Otherwise, use environment variable default
      const shouldUploadToGoogleDrive =
        config.googleDrive?.enabled !== undefined
          ? config.googleDrive.enabled
          : this.googleDriveService.isEnabledByDefault();

      if (shouldUploadToGoogleDrive) {
        this.logger.log(
          `[${config.serverName}] Step 5: Uploading to Google Drive`,
        );

        try {
          // Use provided paths or fallback to environment variables
          const credentialsPath =
            config.googleDrive?.credentialsPath ||
            this.googleDriveService.getDefaultCredentialsPath();
          const folderId =
            config.googleDrive?.folderId ||
            this.googleDriveService.getDefaultFolderId();

          // Upload to Google Drive (service will use env vars as fallback)
          const fileId = await this.googleDriveService.uploadFile(
            localFilePath,
            credentialsPath,
            folderId,
          );
          result.googleDriveFileId = fileId;
          result.steps.googleDriveUpload = true;
          this.logger.log(
            `[${config.serverName}] ✅ Google Drive upload successful: ${fileId}`,
          );
        } catch (error) {
          // Don't fail the entire backup if Google Drive upload fails
          this.logger.warn(
            `[${config.serverName}] ⚠️  Google Drive upload failed: ${error.message}`,
          );
          this.logger.warn(
            `[${config.serverName}] Backup completed but not uploaded to cloud`,
          );
        }
      } else {
        this.logger.log(
          `[${config.serverName}] Google Drive upload skipped (disabled)`,
        );
      }

      // Cleanup: Delete remote compressed file
      if (remoteCompressedFile) {
        this.logger.log(`[${config.serverName}] Cleaning up remote file`);
        await this.compressionService.deleteRemoteFile(
          config.sshConfig,
          remoteCompressedFile,
        );
      }

      result.success = true;
      this.logger.log(`[${config.serverName}] Backup completed successfully!`);

      // Send Discord notification if enabled
      if (this.discordService.isEnabled()) {
        const duration = (Date.now() - startTime) / 1000;
        await this.discordService.sendBackupSuccess(
          config.serverName,
          fileSizeMB,
          duration,
          localFilePath,
          result.steps.googleDriveUpload,
        );
      }

      return result;
    } catch (error) {
      result.error = error.message;
      this.logger.error(
        `[${config.serverName}] Backup failed: ${error.message}`,
      );

      // Send Discord failure notification if enabled
      if (this.discordService.isEnabled()) {
        const duration = (Date.now() - startTime) / 1000;
        await this.discordService.sendBackupFailure(
          config.serverName,
          error.message,
          duration,
        );
      }

      // Cleanup: Try to delete remote compressed file if it was created
      if (remoteCompressedFile) {
        try {
          await this.compressionService.deleteRemoteFile(
            config.sshConfig,
            remoteCompressedFile,
          );
        } catch (cleanupError) {
          this.logger.error(
            `Failed to cleanup remote file: ${cleanupError.message}`,
          );
        }
      }

      return result;
    }
  }
}
