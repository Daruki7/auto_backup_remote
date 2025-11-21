import { Injectable, Logger } from '@nestjs/common';
import { SftpClientService } from '../../shared/services';
import { SshConfig, DownloadResult } from '../../shared/interfaces';
import * as fs from 'fs';
import * as path from 'path';

/**
 * File Transfer Service
 * High-level file transfer operations for backup workflows
 * Uses optimized SFTP client for fast, reliable transfers
 */
@Injectable()
export class FileTransferService {
  private readonly logger = new Logger(FileTransferService.name);

  constructor(private readonly sftpClientService: SftpClientService) {}

  /**
   * Download file from remote server with organized local storage
   * File structure: {localBackupPath}/{serverName}/{YYYY_MM_DD-Database_{serverName}}/filename
   * @param sshConfig SSH connection configuration
   * @param remoteFilePath Remote file path
   * @param localBackupPath Base local backup path
   * @param serverName Server name for organization
   * @returns Local file path where file was saved
   */
  async downloadAndOrganizeFile(
    sshConfig: SshConfig,
    remoteFilePath: string,
    localBackupPath: string,
    serverName: string,
  ): Promise<string> {
    // Create date folder name: 2025_10_17-Database_ServerName
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateFolderName = `${year}_${month}_${day}-Database_${serverName}`;

    // Create full path: {localBackupPath}/{serverName}/{YYYY_MM_DD-Database_{serverName}}/
    const serverBackupPath = path.join(localBackupPath, serverName);
    const dateFolderPath = path.join(serverBackupPath, dateFolderName);

    // Ensure date-specific backup directory exists (create early to avoid delays)
    if (!fs.existsSync(dateFolderPath)) {
      fs.mkdirSync(dateFolderPath, { recursive: true });
      this.logger.log(`✅ Created backup directory: ${dateFolderPath}`);
    }

    // Keep original filename from server (e.g., uploads.tar.gz)
    const remoteFileName = remoteFilePath.split('/').pop();
    const localFilePath = path.join(dateFolderPath, remoteFileName);

    this.logger.log(`🚀 Starting optimized download from ${remoteFilePath}`);
    this.logger.log(`📁 Destination: ${localFilePath}`);

    try {
      // Download using optimized SFTP client with adaptive settings
      // Settings are auto-tuned based on file size for maximum performance
      const result: DownloadResult = await this.sftpClientService.downloadFile(
        sshConfig,
        remoteFilePath,
        localFilePath,
        {
          // Let SFTP service determine optimal settings based on file size
          // You can override here if needed, but auto-tuning is recommended
          onProgress: (transferred, chunk, total) => {
            // Progress is logged by SFTP client service with throttling
          },
        },
      );

      if (!result.success) {
        throw new Error(result.error || 'Download failed');
      }

      // Rename file to clean format (remove timestamp/suffix, keep only base name)
      const cleanFileName = this.getCleanFileName(remoteFileName);
      const cleanFilePath = path.join(dateFolderPath, cleanFileName);

      // If the downloaded file has a different name, rename it
      if (localFilePath !== cleanFilePath && fs.existsSync(localFilePath)) {
        fs.renameSync(localFilePath, cleanFilePath);
        this.logger.log(
          `📝 File renamed: ${remoteFileName} → ${cleanFileName}`,
        );
      }

      // Calculate additional metrics
      const fileSizeMB = result.fileSize / (1024 * 1024);
      const fileSizeGB = fileSizeMB / 1024;
      const durationMinutes = result.duration / 60;

      this.logger.log(`✅ File downloaded: ${cleanFileName}`);
      this.logger.log(`📁 Saved to folder: ${dateFolderName}`);
      this.logger.log(`📊 Performance Summary:`);
      this.logger.log(
        `   • File size: ${fileSizeGB >= 1 ? fileSizeGB.toFixed(2) + ' GB' : fileSizeMB.toFixed(2) + ' MB'}`,
      );
      this.logger.log(
        `   • Duration: ${durationMinutes >= 1 ? durationMinutes.toFixed(2) + ' minutes' : result.duration.toFixed(1) + ' seconds'}`,
      );
      this.logger.log(
        `   • Average speed: ${result.averageSpeed.toFixed(2)} MB/s`,
      );

      return cleanFilePath;
    } catch (error) {
      this.logger.error(`Download failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean filename by removing timestamp/suffix, keeping only base name
   * Examples:
   *   uploads_20251017_235959.zip → uploads.zip
   *   uploads_backup.tar.gz → uploads.tar.gz
   *   database_20251017.zip → uploads.zip (normalize to uploads)
   * @param filename Original filename
   * @returns Cleaned filename
   */
  private getCleanFileName(filename: string): string {
    // Get file extension
    let extension = '';
    let baseName = filename;

    // Handle .tar.gz double extension
    if (filename.endsWith('.tar.gz')) {
      extension = '.tar.gz';
      baseName = filename.slice(0, -7); // Remove .tar.gz
    } else {
      const lastDot = filename.lastIndexOf('.');
      if (lastDot !== -1) {
        extension = filename.substring(lastDot); // .zip, .tar, etc.
        baseName = filename.substring(0, lastDot);
      }
    }

    // Remove timestamp pattern (e.g., _20251017_235959, _20251017, etc.)
    baseName = baseName.replace(/_\d{8}(_\d{6})?$/, '');

    // Remove other common suffixes (_backup, _new, _old, etc.)
    baseName = baseName.replace(/_(backup|new|old|tmp|temp)$/i, '');

    // If basename is empty or unusual, default to 'uploads'
    if (!baseName || baseName.trim() === '') {
      baseName = 'uploads';
    }

    // Normalize to 'uploads' if it contains 'upload' or 'database'
    if (
      baseName.toLowerCase().includes('upload') ||
      baseName.toLowerCase().includes('database')
    ) {
      baseName = 'uploads';
    }

    return `${baseName}${extension}`;
  }

  /**
   * Get file size in MB
   * @param filePath Local file path
   * @returns File size in megabytes
   */
  getFileSizeMB(filePath: string): number {
    const stats = fs.statSync(filePath);
    return stats.size / (1024 * 1024);
  }

  /**
   * Check if local file exists
   * @param filePath Local file path
   * @returns True if file exists
   */
  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Delete local file
   * @param filePath Local file path
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`Deleted file: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`);
      throw error;
    }
  }
}
