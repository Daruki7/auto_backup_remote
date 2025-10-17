import { Injectable, Logger } from '@nestjs/common';
import { SshService } from './ssh.service';
import { CompressionService } from './compression.service';
import { FileDownloadService } from './file-download.service';
import { GoogleDriveService } from './google-drive.service';
import { BackupConfig } from '../config/backup.config';

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

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly sshService: SshService,
    private readonly compressionService: CompressionService,
    private readonly fileDownloadService: FileDownloadService,
    private readonly googleDriveService: GoogleDriveService,
  ) {}

  /**
   * Execute the complete backup workflow
   */
  async executeBackup(config: BackupConfig): Promise<BackupResult> {
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
      this.logger.log(
        `[${config.serverName}] Step 1: Testing SSH connection to Ubuntu server`,
      );
      await this.sshService.executeCommand(
        config.sshConfig,
        'echo "connected"',
      );
      result.steps.sshConnection = true;
      this.logger.log(
        `[${config.serverName}] SSH connection successful to Ubuntu server`,
      );

      // Step 1.5: Check required tools on Ubuntu server
      this.logger.log(
        `[${config.serverName}] Step 1.5: Checking required tools on Ubuntu`,
      );
      const toolCheck = await this.sshService.checkRequiredTools(
        config.sshConfig,
        config.compressionType,
      );
      if (!toolCheck.available) {
        throw new Error(
          `Required tools not installed on Ubuntu server: ${toolCheck.missing.join(', ')}. ` +
            `Please run: sudo apt-get install ${toolCheck.missing.join(' ')}`,
        );
      }

      // Step 2: Check if target folder exists
      this.logger.log(
        `[${config.serverName}] Step 2: Checking target folder on Ubuntu`,
      );
      const targetPath = `${config.remoteDirectory}/${config.targetFolder}`;
      const folderExists = await this.sshService.directoryExists(
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

      // Step 4: Download the compressed file
      this.logger.log(`[${config.serverName}] Step 4: Downloading file`);
      const localFilePath =
        await this.fileDownloadService.downloadAndRenameFile(
          config.sshConfig,
          remoteCompressedFile,
          config.localBackupPath,
          config.serverName,
        );
      result.localFilePath = localFilePath;
      result.steps.download = true;

      const fileSizeMB = this.fileDownloadService.getFileSizeMB(localFilePath);
      result.fileSize = fileSizeMB;
      this.logger.log(
        `[${config.serverName}] Download successful: ${localFilePath} (${fileSizeMB.toFixed(2)} MB)`,
      );

      // Step 5: Upload to Google Drive (if enabled)
      if (config.googleDrive?.enabled) {
        this.logger.log(
          `[${config.serverName}] Step 5: Uploading to Google Drive`,
        );

        if (!config.googleDrive.credentialsPath) {
          throw new Error('Google Drive credentials path not provided');
        }

        const fileId = await this.googleDriveService.uploadFile(
          localFilePath,
          config.googleDrive.credentialsPath,
          config.googleDrive.folderId,
        );
        result.googleDriveFileId = fileId;
        result.steps.googleDriveUpload = true;
        this.logger.log(
          `[${config.serverName}] Google Drive upload successful: ${fileId}`,
        );
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
      return result;
    } catch (error) {
      result.error = error.message;
      this.logger.error(
        `[${config.serverName}] Backup failed: ${error.message}`,
      );

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
