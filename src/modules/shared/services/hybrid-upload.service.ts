import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DirectUploadService } from './direct-upload.service';
import { SftpClientService } from './sftp-client.service';
import { GoogleDriveService } from '../../google-drive/services/google-drive.service';
import { LargeFileUploadService } from './large-file-upload.service';
import { SshConfig } from '../interfaces';

/**
 * Hybrid Upload Service
 * Combines multiple upload methods with intelligent fallback
 * 1. Try true direct upload (Rclone/gdrive)
 * 2. Fallback to optimized streaming
 * 3. Fallback to local download + upload
 */
@Injectable()
export class HybridUploadService {
  private readonly logger = new Logger(HybridUploadService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly directUploadService: DirectUploadService,
    private readonly sftpClientService: SftpClientService,
    private readonly googleDriveService: GoogleDriveService,
    private readonly largeFileUploadService: LargeFileUploadService,
  ) {}

  /**
   * Upload file with hybrid approach and intelligent fallback
   * @param sshConfig SSH connection configuration
   * @param remoteFilePath Path to file on remote server
   * @param googleDriveConfig Google Drive configuration
   * @returns Upload result with method used
   */
  async uploadWithHybrid(
    sshConfig: SshConfig,
    remoteFilePath: string,
    googleDriveConfig: {
      credentialsPath: string;
      folderId?: string;
      serverName: string;
    },
  ): Promise<{
    fileId: string;
    folderName: string;
    method: 'rclone' | 'local' | 'large-file-optimized';
    uploadTime: number;
    fileSize: number;
  }> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    // Check file size first to determine if we need large file handling
    const fileSize = await this.getRemoteFileSize(sshConfig, remoteFilePath);
    const fileSizeGB = fileSize / (1024 * 1024 * 1024);

    this.logger.log(
      `[${googleDriveConfig.serverName}] 📊 File size: ${fileSizeGB.toFixed(2)}GB`,
    );

    // For files larger than 10GB, use large file optimization
    if (fileSizeGB > 1) {
      this.logger.log(
        `[${googleDriveConfig.serverName}] 🚀 Large file detected (${fileSizeGB.toFixed(2)}GB), using large file optimization...`,
      );

      try {
        const result = await this.largeFileUploadService.uploadLargeFile(
          sshConfig,
          remoteFilePath,
          googleDriveConfig,
        );

        const uploadTime = (Date.now() - startTime) / 1000;
        this.logger.log(
          `[${googleDriveConfig.serverName}] ✅ Large file upload successful: ${result.method} method`,
        );

        return {
          fileId: result.fileId,
          folderName: result.folderName,
          method: 'large-file-optimized',
          uploadTime,
          fileSize: result.fileSize,
        };
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `[${googleDriveConfig.serverName}] ❌ Large file upload failed: ${error.message}`,
        );
        this.logger.warn(
          `[${googleDriveConfig.serverName}] ⚠️ Falling back to standard methods...`,
        );
      }
    }

    // Method 1: Try Rclone direct upload
    try {
      this.logger.log(
        `[${googleDriveConfig.serverName}] 🚀 Attempting Rclone direct upload...`,
      );

      const isRcloneAvailable =
        await this.directUploadService.isRcloneAvailable(sshConfig);

      if (isRcloneAvailable) {
        const result = await this.directUploadService.uploadWithRclone(
          sshConfig,
          remoteFilePath,
          googleDriveConfig,
        );

        const uploadTime = (Date.now() - startTime) / 1000;
        const fileSize = await this.getRemoteFileSize(
          sshConfig,
          remoteFilePath,
        );

        this.logger.log(
          `[${googleDriveConfig.serverName}] ✅ Rclone direct upload successful in ${uploadTime.toFixed(2)}s`,
        );

        return {
          ...result,
          uploadTime,
          fileSize,
        };
      } else {
        this.logger.log(
          `[${googleDriveConfig.serverName}] ⚠️ Rclone not available, trying gdrive...`,
        );
      }
    } catch (error) {
      lastError = error as Error;
      this.logger.warn(
        `[${googleDriveConfig.serverName}] ❌ Rclone upload failed: ${error.message}`,
      );
    }

    // Method 2: Fallback to local download + upload
    try {
      this.logger.log(
        `[${googleDriveConfig.serverName}] 🚀 Attempting local download + upload fallback...`,
      );

      const result = await this.uploadWithLocalFallback(
        sshConfig,
        remoteFilePath,
        googleDriveConfig,
      );

      const uploadTime = (Date.now() - startTime) / 1000;

      this.logger.log(
        `[${googleDriveConfig.serverName}] ✅ Local fallback upload successful in ${uploadTime.toFixed(2)}s`,
      );

      return {
        ...result,
        uploadTime,
        fileSize: result.fileSize,
      };
    } catch (error) {
      lastError = error as Error;
      this.logger.error(
        `[${googleDriveConfig.serverName}] ❌ All upload methods failed: ${error.message}`,
      );
    }

    // If all methods failed, throw the last error
    throw new Error(
      `All upload methods failed. Last error: ${lastError?.message}`,
    );
  }

  /**
   * Upload using optimized streaming method
   * @param sshConfig SSH connection configuration
   * @param remoteFilePath Path to file on remote server
   * @param googleDriveConfig Google Drive configuration
   * @returns Upload result
   */
  private async uploadWithStreaming(
    sshConfig: SshConfig,
    remoteFilePath: string,
    googleDriveConfig: {
      credentialsPath: string;
      folderId?: string;
      serverName: string;
    },
  ): Promise<{
    fileId: string;
    folderName: string;
    method: 'streaming';
    fileSize: number;
  }> {
    // Generate date-based folder name
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const folderName = `${year}_${month}_${day}-Database_${googleDriveConfig.serverName}`;

    // Get file size
    const fileSize = await this.getRemoteFileSize(sshConfig, remoteFilePath);

    // Create date-based folder in Google Drive
    const folderId = await this.googleDriveService.createDateFolder(
      googleDriveConfig.serverName,
      googleDriveConfig.credentialsPath,
      googleDriveConfig.folderId,
    );

    // Get read stream from SSH
    const { stream, client } = await this.sftpClientService.getReadStream(
      sshConfig,
      remoteFilePath,
    );

    try {
      // Upload directly from stream to Google Drive
      const fileName = remoteFilePath.split('/').pop() || 'backup';
      const mimeType =
        this.googleDriveService.getMimeTypeFromFilename(fileName);

      const fileId = await this.googleDriveService.uploadFromStream(
        stream,
        fileName,
        mimeType,
        folderId,
        googleDriveConfig.credentialsPath,
      );

      return {
        fileId,
        folderName,
        method: 'streaming',
        fileSize,
      };
    } finally {
      // Always close SFTP client
      try {
        await client.end();
      } catch (endError) {
        this.logger.warn(`Failed to close SFTP client: ${endError.message}`);
      }
    }
  }

  /**
   * Upload using local download + upload fallback
   * @param sshConfig SSH connection configuration
   * @param remoteFilePath Path to file on remote server
   * @param googleDriveConfig Google Drive configuration
   * @returns Upload result
   */
  private async uploadWithLocalFallback(
    sshConfig: SshConfig,
    remoteFilePath: string,
    googleDriveConfig: {
      credentialsPath: string;
      folderId?: string;
      serverName: string;
    },
  ): Promise<{
    fileId: string;
    folderName: string;
    method: 'local';
    fileSize: number;
  }> {
    // Generate date-based folder name
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const folderName = `${year}_${month}_${day}-Database_${googleDriveConfig.serverName}`;

    // Download to local first
    const localBackupPath =
      this.configService.get<string>('backup.localBackupPath') || 'H:/Backup';
    const downloadResult = await this.sftpClientService.downloadFile(
      sshConfig,
      remoteFilePath,
      `${localBackupPath}/${googleDriveConfig.serverName}`,
    );

    // Get file size
    const fileSize = await this.getLocalFileSize(downloadResult.localPath);

    // Create date-based folder in Google Drive
    const folderId = await this.googleDriveService.createDateFolder(
      googleDriveConfig.serverName,
      googleDriveConfig.credentialsPath,
      googleDriveConfig.folderId,
    );

    // Upload from local to Google Drive
    const { fileId } = await this.googleDriveService.uploadFile(
      downloadResult.localPath,
      googleDriveConfig.serverName,
      googleDriveConfig.credentialsPath,
      folderId,
    );

    // Clean up local file
    try {
      require('fs').unlinkSync(downloadResult.localPath);
    } catch (cleanupError) {
      this.logger.warn(`Failed to cleanup local file: ${cleanupError.message}`);
    }

    return {
      fileId,
      folderName,
      method: 'local',
      fileSize,
    };
  }

  /**
   * Get remote file size
   * @param sshConfig SSH connection configuration
   * @param remoteFilePath Path to remote file
   * @returns File size in bytes
   */
  private async getRemoteFileSize(
    sshConfig: SshConfig,
    remoteFilePath: string,
  ): Promise<number> {
    try {
      const { fileSize } = await this.sftpClientService.getReadStream(
        sshConfig,
        remoteFilePath,
      );
      return fileSize;
    } catch (error) {
      this.logger.warn(`Failed to get remote file size: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get local file size
   * @param localFilePath Path to local file
   * @returns File size in bytes
   */
  private async getLocalFileSize(localFilePath: string): Promise<number> {
    try {
      const stats = require('fs').statSync(localFilePath);
      return stats.size;
    } catch (error) {
      this.logger.warn(`Failed to get local file size: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get upload method recommendations based on server capabilities
   * @param sshConfig SSH connection configuration
   * @returns Recommended upload methods in order of preference
   */
  async getRecommendedMethods(sshConfig: SshConfig): Promise<string[]> {
    const methods: string[] = [];

    // Check for Rclone
    if (await this.directUploadService.isRcloneAvailable(sshConfig)) {
      methods.push('rclone');
    }

    // Check for gdrive
    if (await this.directUploadService.isGdriveAvailable(sshConfig)) {
      methods.push('gdrive');
    }

    // Always add streaming and local as fallbacks
    methods.push('streaming', 'local');

    return methods;
  }
}
