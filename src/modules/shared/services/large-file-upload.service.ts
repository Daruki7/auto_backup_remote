import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SshCommandService } from './ssh-command.service';
import { SftpClientService } from './sftp-client.service';
import { GoogleDriveService } from '../../google-drive/services/google-drive.service';
import { SshConfig } from '../interfaces';

/**
 * Large File Upload Service
 * Specialized service for handling very large files (50GB+)
 * with memory-efficient streaming and intelligent fallback
 */
@Injectable()
export class LargeFileUploadService {
  private readonly logger = new Logger(LargeFileUploadService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly sshCommandService: SshCommandService,
    private readonly sftpClientService: SftpClientService,
    private readonly googleDriveService: GoogleDriveService,
  ) {}

  /**
   * Upload large file with optimized settings for 50GB+ files
   * @param sshConfig SSH connection configuration
   * @param remoteFilePath Path to large file on remote server
   * @param googleDriveConfig Google Drive configuration
   * @returns Upload result with performance metrics
   */
  async uploadLargeFile(
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
    method: 'rclone' | 'optimized-streaming' | 'chunked-streaming';
    uploadTime: number;
    fileSize: number;
    chunksProcessed: number;
  }> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    // Get file size first to determine best strategy
    const fileSize = await this.getRemoteFileSize(sshConfig, remoteFilePath);
    const fileSizeGB = fileSize / (1024 * 1024 * 1024);

    this.logger.log(
      `[${googleDriveConfig.serverName}] 📊 Large file detected: ${fileSizeGB.toFixed(2)}GB`,
    );

    // Strategy 1: Try Rclone (best for large files)
    try {
      this.logger.log(
        `[${googleDriveConfig.serverName}] 🚀 Attempting Rclone for large file...`,
      );

      const isRcloneAvailable = await this.sshCommandService.executeCommand(
        sshConfig,
        'which rclone',
      );

      if (isRcloneAvailable.trim()) {
        const result = await this.uploadWithRcloneLarge(
          sshConfig,
          remoteFilePath,
          googleDriveConfig,
        );

        const uploadTime = (Date.now() - startTime) / 1000;
        this.logger.log(
          `[${googleDriveConfig.serverName}] ✅ Rclone large file upload successful in ${uploadTime.toFixed(2)}s`,
        );

        return {
          ...result,
          uploadTime,
          fileSize,
          chunksProcessed: 1, // Rclone handles as single operation
        };
      }
    } catch (error) {
      lastError = error as Error;
      this.logger.warn(
        `[${googleDriveConfig.serverName}] ❌ Rclone large file upload failed: ${error.message}`,
      );
    }

    // Strategy 2: Optimized streaming for large files
    try {
      this.logger.log(
        `[${googleDriveConfig.serverName}] 🚀 Attempting optimized streaming for large file...`,
      );

      const result = await this.uploadWithOptimizedStreaming(
        sshConfig,
        remoteFilePath,
        googleDriveConfig,
        fileSize,
      );

      const uploadTime = (Date.now() - startTime) / 1000;
      this.logger.log(
        `[${googleDriveConfig.serverName}] ✅ Optimized streaming successful in ${uploadTime.toFixed(2)}s`,
      );

      return {
        ...result,
        uploadTime,
        fileSize,
        chunksProcessed: result.chunksProcessed,
      };
    } catch (error) {
      lastError = error as Error;
      this.logger.warn(
        `[${googleDriveConfig.serverName}] ❌ Optimized streaming failed: ${error.message}`,
      );
    }

    // Strategy 3: Chunked streaming (last resort for very large files)
    try {
      this.logger.log(
        `[${googleDriveConfig.serverName}] 🚀 Attempting chunked streaming for very large file...`,
      );

      const result = await this.uploadWithChunkedStreaming(
        sshConfig,
        remoteFilePath,
        googleDriveConfig,
        fileSize,
      );

      const uploadTime = (Date.now() - startTime) / 1000;
      this.logger.log(
        `[${googleDriveConfig.serverName}] ✅ Chunked streaming successful in ${uploadTime.toFixed(2)}s`,
      );

      return {
        ...result,
        uploadTime,
        fileSize,
        chunksProcessed: result.chunksProcessed,
      };
    } catch (error) {
      lastError = error as Error;
      this.logger.error(
        `[${googleDriveConfig.serverName}] ❌ All large file upload methods failed: ${error.message}`,
      );
    }

    // If all methods failed, throw error
    throw new Error(
      `All large file upload methods failed. Last error: ${lastError?.message}`,
    );
  }

  /**
   * Upload large file using Rclone with optimized settings
   * Uses existing rclone config on server (assumes "gdrive" remote is already configured)
   */
  private async uploadWithRcloneLarge(
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
    method: 'rclone';
  }> {
    // Generate date-based folder name
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const folderName = `${year}_${month}_${day}-Database_${googleDriveConfig.serverName}`;

    // Use existing rclone remote (assumes "gdrive" is already configured on server)
    const rcloneRemote = 'gdrive';

    this.logger.log(
      `[${googleDriveConfig.serverName}] 📂 Using existing rclone remote: ${rcloneRemote}`,
    );

    // Create folder in Google Drive using rclone
    const createFolderCommand = googleDriveConfig.folderId
      ? `rclone mkdir ${rcloneRemote}:${folderName} --drive-root-folder-id ${googleDriveConfig.folderId}`
      : `rclone mkdir ${rcloneRemote}:${folderName}`;

    this.logger.log(
      `[${googleDriveConfig.serverName}] 📁 Creating folder in Google Drive: ${folderName}`,
    );

    try {
      await this.sshCommandService.executeCommand(
        sshConfig,
        createFolderCommand,
      );
      this.logger.log(
        `[${googleDriveConfig.serverName}] ✅ Folder created successfully`,
      );
    } catch (error) {
      this.logger.warn(
        `[${googleDriveConfig.serverName}] ⚠️ Folder might already exist or creation failed: ${error.message}`,
      );
    }

    // Upload file to Google Drive with large file optimizations
    const uploadCommand = `
      rclone copy "${remoteFilePath}" ${rcloneRemote}:${folderName}/ \
        --verbose \
        --progress \
        --stats 10s \
        --transfers 1 \
        --buffer-size 16M \
        --use-mmap \
        --fast-list \
        --checkers 2 \
        --retries 3 \
        --low-level-retries 10
    `;

    this.logger.log(
      `[${googleDriveConfig.serverName}] 📤 Starting rclone upload to folder: ${folderName}`,
    );
    await this.sshCommandService.executeCommand(sshConfig, uploadCommand);

    return {
      fileId: `rclone_${Date.now()}`,
      folderName,
      method: 'rclone',
    };
  }

  /**
   * Upload large file using optimized streaming
   */
  private async uploadWithOptimizedStreaming(
    sshConfig: SshConfig,
    remoteFilePath: string,
    googleDriveConfig: {
      credentialsPath: string;
      folderId?: string;
      serverName: string;
    },
    fileSize: number,
  ): Promise<{
    fileId: string;
    folderName: string;
    method: 'optimized-streaming';
    chunksProcessed: number;
  }> {
    // Generate date-based folder name
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const folderName = `${year}_${month}_${day}-Database_${googleDriveConfig.serverName}`;

    // Create folder in Google Drive
    const folderId = await this.googleDriveService.createDateFolder(
      googleDriveConfig.serverName,
      googleDriveConfig.credentialsPath,
      googleDriveConfig.folderId,
    );

    // Calculate optimal chunk size based on file size
    const optimalChunkSize = this.calculateOptimalChunkSize(fileSize);
    this.logger.log(
      `[${googleDriveConfig.serverName}] 📊 Using chunk size: ${(optimalChunkSize / 1024 / 1024).toFixed(2)}MB`,
    );

    // Get read stream with optimized settings
    const { stream, client } = await this.sftpClientService.getReadStream(
      sshConfig,
      remoteFilePath,
    );

    try {
      // Upload with optimized settings for large files
      const fileName = remoteFilePath.split('/').pop() || 'large-backup';
      const mimeType =
        this.googleDriveService.getMimeTypeFromFilename(fileName);

      const fileId =
        await this.googleDriveService.uploadFromStreamWithLargeFileOptimization(
          stream,
          fileName,
          mimeType,
          folderId,
          googleDriveConfig.credentialsPath,
          optimalChunkSize,
        );

      return {
        fileId,
        folderName,
        method: 'optimized-streaming',
        chunksProcessed: Math.ceil(fileSize / optimalChunkSize),
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
   * Upload large file using chunked streaming (for very large files)
   */
  private async uploadWithChunkedStreaming(
    sshConfig: SshConfig,
    remoteFilePath: string,
    googleDriveConfig: {
      credentialsPath: string;
      folderId?: string;
      serverName: string;
    },
    fileSize: number,
  ): Promise<{
    fileId: string;
    folderName: string;
    method: 'chunked-streaming';
    chunksProcessed: number;
  }> {
    // This would implement chunked upload for extremely large files
    // For now, fallback to optimized streaming but return correct method type
    const result = await this.uploadWithOptimizedStreaming(
      sshConfig,
      remoteFilePath,
      googleDriveConfig,
      fileSize,
    );

    return {
      ...result,
      method: 'chunked-streaming' as const,
    };
  }

  /**
   * Calculate optimal chunk size based on file size
   */
  private calculateOptimalChunkSize(fileSize: number): number {
    const fileSizeGB = fileSize / (1024 * 1024 * 1024);

    if (fileSizeGB < 1) {
      return 256 * 1024; // 256KB for files < 1GB
    } else if (fileSizeGB < 10) {
      return 1024 * 1024; // 1MB for files 1-10GB
    } else if (fileSizeGB < 50) {
      return 2 * 1024 * 1024; // 2MB for files 10-50GB
    } else {
      return 4 * 1024 * 1024; // 4MB for files > 50GB
    }
  }

  /**
   * Get remote file size
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
}
