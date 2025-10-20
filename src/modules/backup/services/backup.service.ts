import { Injectable, Logger } from '@nestjs/common';
import {
  SshCommandService,
  SftpClientService,
  HybridUploadService,
} from '../../shared/services';
import { CompressionService } from './compression.service';
import { FileTransferService } from './file-transfer.service';
import { GoogleDriveService } from '../../google-drive/services/google-drive.service';
import { DiscordService } from '../../notifications/services/discord.service';
import { BackupConfig } from '../../../config/backup.config';
import * as path from 'path';

import { BackupSteps } from '../../../config/backup.config';

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
  steps: BackupSteps;
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
    private readonly sftpClientService: SftpClientService,
    private readonly compressionService: CompressionService,
    private readonly fileTransferService: FileTransferService,
    private readonly googleDriveService: GoogleDriveService,
    private readonly discordService: DiscordService,
    private readonly hybridUploadService: HybridUploadService,
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

      // Check if Google Drive upload is enabled:
      // 1. If explicitly set in config, use that value
      // 2. Otherwise, use environment variable default
      const shouldUploadToGoogleDrive =
        config.googleDrive?.enabled !== undefined
          ? config.googleDrive.enabled
          : this.googleDriveService.isEnabledByDefault();

      // Determine upload method: 'direct' or 'local'
      const uploadMethod = config.googleDrive?.uploadMethod || 'local';

      let localFilePath: string = null;
      let fileSizeMB: number = 0;
      let googleDriveFolderName: string = null;

      // Generate folder name for Discord notification
      if (shouldUploadToGoogleDrive) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        googleDriveFolderName = `${year}_${month}_${day}-Database_${config.serverName}`;
      }

      // Step 4 & 5: Handle download and upload based on configuration
      // Case 1: Direct upload (enabled=true, method=direct)
      // Case 2: Local upload (enabled=true, method=local)
      // Case 3: Local only (enabled=false)

      if (shouldUploadToGoogleDrive && uploadMethod === 'direct') {
        // ==========================================
        // CASE 1: HYBRID DIRECT METHOD (True Direct + Fallbacks)
        // ==========================================
        this.logger.log(
          `[${config.serverName}] 🚀 Hybrid direct upload mode: True Direct → Streaming → Local`,
        );

        try {
          // Use provided paths or fallback to environment variables
          const credentialsPath =
            config.googleDrive?.credentialsPath ||
            this.googleDriveService.getDefaultCredentialsPath();
          const parentFolderId =
            config.googleDrive?.folderId ||
            this.googleDriveService.getDefaultFolderId();

          // Use hybrid upload service with intelligent fallback
          const uploadResult = await this.hybridUploadService.uploadWithHybrid(
            config.sshConfig,
            remoteCompressedFile,
            {
              credentialsPath,
              folderId: parentFolderId,
              serverName: config.serverName,
            },
          );

          result.googleDriveFileId = uploadResult.fileId;
          result.steps.googleDriveUpload = true;
          result.steps.download = true; // Mark as complete
          fileSizeMB = uploadResult.fileSize / (1024 * 1024);
          result.fileSize = fileSizeMB;

          // Update Discord notification with upload method
          googleDriveFolderName = uploadResult.folderName;

          this.logger.log(
            `[${config.serverName}] ✅ Hybrid upload successful: ${uploadResult.method} method`,
          );
          this.logger.log(
            `[${config.serverName}] 📊 Upload time: ${uploadResult.uploadTime.toFixed(2)}s`,
          );
          this.logger.log(
            `[${config.serverName}] 📁 Folder: ${uploadResult.folderName}`,
          );
        } catch (error) {
          // Hybrid upload failed - throw error to be handled by outer catch
          this.logger.error(
            `[${config.serverName}] ❌ All hybrid upload methods failed: ${error.message}`,
          );
          throw error;
        }
      } else if (shouldUploadToGoogleDrive && uploadMethod === 'local') {
        // ==========================================
        // CASE 2: LOCAL METHOD (SSH → Local → Drive)
        // ==========================================
        this.logger.log(
          `[${config.serverName}] 💾 Local upload mode: SSH → Local PC → Google Drive`,
        );

        // Step 4: Download to local PC first
        this.logger.log(
          `[${config.serverName}] Step 4: Downloading file to local PC...`,
        );

        localFilePath = await this.fileTransferService.downloadAndOrganizeFile(
          config.sshConfig,
          remoteCompressedFile,
          config.localBackupPath,
          config.serverName,
        );
        result.localFilePath = localFilePath;
        result.steps.download = true;

        fileSizeMB = this.fileTransferService.getFileSizeMB(localFilePath);
        result.fileSize = fileSizeMB;
        this.logger.log(
          `[${config.serverName}] ✅ Download successful: ${localFilePath} (${fileSizeMB.toFixed(2)} MB)`,
        );

        // Step 5: Upload from local to Google Drive
        this.logger.log(
          `[${config.serverName}] Step 5: Uploading from local PC to Google Drive...`,
        );

        try {
          // Use provided paths or fallback to environment variables
          const credentialsPath =
            config.googleDrive?.credentialsPath ||
            this.googleDriveService.getDefaultCredentialsPath();
          const parentFolderId =
            config.googleDrive?.folderId ||
            this.googleDriveService.getDefaultFolderId();

          // Upload to Google Drive with date-based folder
          const { fileId } = await this.googleDriveService.uploadFile(
            localFilePath,
            config.serverName,
            credentialsPath,
            parentFolderId,
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
            `[${config.serverName}] ℹ️  Backup saved locally but not uploaded to cloud`,
          );
        }
      } else {
        // ==========================================
        // CASE 3: LOCAL ONLY (enabled=false, just download)
        // ==========================================
        this.logger.log(
          `[${config.serverName}] 📁 Local only mode: SSH → Local PC (no cloud upload)`,
        );

        // Step 4: Download to local PC only
        this.logger.log(
          `[${config.serverName}] Step 4: Downloading file to local PC...`,
        );

        localFilePath = await this.fileTransferService.downloadAndOrganizeFile(
          config.sshConfig,
          remoteCompressedFile,
          config.localBackupPath,
          config.serverName,
        );
        result.localFilePath = localFilePath;
        result.steps.download = true;

        fileSizeMB = this.fileTransferService.getFileSizeMB(localFilePath);
        result.fileSize = fileSizeMB;
        this.logger.log(
          `[${config.serverName}] ✅ Download successful: ${localFilePath} (${fileSizeMB.toFixed(2)} MB)`,
        );
        this.logger.log(
          `[${config.serverName}] ℹ️  Google Drive upload disabled - file saved locally only`,
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
          shouldUploadToGoogleDrive ? uploadMethod : undefined,
          googleDriveFolderName,
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
