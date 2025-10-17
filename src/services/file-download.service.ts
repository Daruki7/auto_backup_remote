import { Injectable, Logger } from '@nestjs/common';
import { SshService } from './ssh.service';
import { SshConfig } from '../config/backup.config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileDownloadService {
  private readonly logger = new Logger(FileDownloadService.name);

  constructor(private readonly sshService: SshService) {}

  /**
   * Download file from remote server with original filename
   * File structure: H:/Backup/{serverName}/{YYYY_MM_DD-Database_{serverName}}/uploads.tar.gz
   */
  async downloadAndRenameFile(
    sshConfig: SshConfig,
    remoteFilePath: string,
    localBackupPath: string,
    serverName: string,
  ): Promise<string> {
    // Create date folder name: 2025_10_02-Database_Alo_Ship_2
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateFolderName = `${year}_${month}_${day}-Database_${serverName}`;

    // Create full path: H:/Backup/{serverName}/{YYYY_MM_DD-Database_{serverName}}/
    const serverBackupPath = path.join(localBackupPath, serverName);
    const dateFolderPath = path.join(serverBackupPath, dateFolderName);

    // Ensure date-specific backup directory exists
    if (!fs.existsSync(dateFolderPath)) {
      fs.mkdirSync(dateFolderPath, { recursive: true });
      this.logger.log(`Created backup directory: ${dateFolderPath}`);
    }

    // Keep original filename from server (e.g., uploads.tar.gz)
    const remoteFileName = remoteFilePath.split('/').pop();
    const localFilePath = path.join(dateFolderPath, remoteFileName);

    this.logger.log(
      `Downloading file from ${remoteFilePath} to ${localFilePath}`,
    );

    try {
      await this.sshService.downloadFile(
        sshConfig,
        remoteFilePath,
        localFilePath,
      );

      // Rename file to clean format (remove timestamp/suffix, keep only base name)
      const cleanFileName = this.getCleanFileName(remoteFileName);
      const cleanFilePath = path.join(dateFolderPath, cleanFileName);

      // If the downloaded file has a different name, rename it
      if (localFilePath !== cleanFilePath && fs.existsSync(localFilePath)) {
        fs.renameSync(localFilePath, cleanFilePath);
        this.logger.log(`File renamed: ${remoteFileName} → ${cleanFileName}`);
      }

      this.logger.log(`File downloaded: ${cleanFileName}`);
      this.logger.log(`Saved to folder: ${dateFolderName}`);
      return cleanFilePath;
    } catch (error) {
      this.logger.error(`Download failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean filename by removing timestamp/suffix, keeping only base name
   * Examples:
   *   uploads_20251006_235959.zip → uploads.zip
   *   uploads_backup.tar.gz → uploads.tar.gz
   *   database_20251006.zip → uploads.zip (normalize to uploads)
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

    // Remove timestamp pattern (e.g., _20251006_235959, _20251006, etc.)
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
   */
  getFileSizeMB(filePath: string): number {
    const stats = fs.statSync(filePath);
    return stats.size / (1024 * 1024);
  }
}
