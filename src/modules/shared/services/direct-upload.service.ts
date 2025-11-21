import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SshCommandService } from './ssh-command.service';
import { SshConfig } from '../interfaces';

/**
 * Direct Upload Service
 * Handles true direct upload from remote server to Google Drive
 * without going through local machine
 */
@Injectable()
export class DirectUploadService {
  private readonly logger = new Logger(DirectUploadService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly sshCommandService: SshCommandService,
  ) {}

  /**
   * Upload file directly from remote server to Google Drive using Rclone
   * @param sshConfig SSH connection configuration
   * @param remoteFilePath Path to file on remote server
   * @param googleDriveConfig Google Drive configuration
   * @returns Upload result with file ID and folder name
   */
  async uploadWithRclone(
    sshConfig: SshConfig,
    remoteFilePath: string,
    googleDriveConfig: {
      credentialsPath: string;
      folderId?: string;
      serverName: string;
    },
  ): Promise<{ fileId: string; folderName: string; method: 'rclone' }> {
    try {
      this.logger.log(
        `[${googleDriveConfig.serverName}] 🚀 Starting Rclone direct upload: ${remoteFilePath}`,
      );

      // Use existing rclone config on server (assumed pre-configured as 'gdrive')
      const rcloneRemote = 'gdrive';

      // Generate date-based folder name
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const folderName = `${year}_${month}_${day}-Database_${googleDriveConfig.serverName}`;

      // Create folder in Google Drive
      const createFolderCmd = googleDriveConfig.folderId
        ? `rclone mkdir ${rcloneRemote}:${folderName} --drive-root-folder-id ${googleDriveConfig.folderId}`
        : `rclone mkdir ${rcloneRemote}:${folderName}`;

      await this.sshCommandService.executeCommand(sshConfig, createFolderCmd);
      this.logger.log(
        `[${googleDriveConfig.serverName}] 📁 Created folder: ${folderName}`,
      );

      // Upload file to Google Drive with optimizations
      const uploadCmd = `rclone copy "${remoteFilePath}" ${rcloneRemote}:${folderName}/ --verbose --progress --stats 10s`;
      await this.sshCommandService.executeCommand(sshConfig, uploadCmd);

      const fileId = `rclone_${Date.now()}`;

      this.logger.log(
        `[${googleDriveConfig.serverName}] ✅ Rclone upload successful: ${fileId}`,
      );

      return { fileId, folderName, method: 'rclone' };
    } catch (error) {
      this.logger.error(
        `[${googleDriveConfig.serverName}] ❌ Rclone upload failed: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Check if Rclone is available on remote server
   * @param sshConfig SSH connection configuration
   * @returns True if Rclone is available
   */
  async isRcloneAvailable(sshConfig: SshConfig): Promise<boolean> {
    try {
      const result = await this.sshCommandService.executeCommand(
        sshConfig,
        'which rclone',
      );
      return result.trim() !== '';
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if gdrive CLI is available on remote server
   * @param sshConfig SSH connection configuration
   * @returns True if gdrive is available
   */
  async isGdriveAvailable(sshConfig: SshConfig): Promise<boolean> {
    try {
      const result = await this.sshCommandService.executeCommand(
        sshConfig,
        'which gdrive',
      );
      return result.trim() !== '';
    } catch (error) {
      return false;
    }
  }

  /**
   * Install Rclone on remote server
   * @param sshConfig SSH connection configuration
   */
  async installRclone(sshConfig: SshConfig): Promise<void> {
    this.logger.log('📦 Installing Rclone...');

    const installCommand = `
      curl https://rclone.org/install.sh | sudo bash
    `;

    await this.sshCommandService.executeCommand(sshConfig, installCommand);

    this.logger.log('✅ Rclone installed successfully');
  }

  /**
   * Install gdrive CLI on remote server
   * @param sshConfig SSH connection configuration
   */
  async installGdrive(sshConfig: SshConfig): Promise<void> {
    this.logger.log('📦 Installing gdrive CLI...');

    const installCommand = `
      wget -O /tmp/gdrive "https://github.com/prasmussen/gdrive/releases/download/2.1.1/gdrive_2.1.1_linux_386.tar.gz"
      tar -xf /tmp/gdrive -C /tmp/
      sudo mv /tmp/gdrive /usr/local/bin/
      sudo chmod +x /usr/local/bin/gdrive
      rm /tmp/gdrive
    `;

    await this.sshCommandService.executeCommand(sshConfig, installCommand);

    this.logger.log('✅ gdrive CLI installed successfully');
  }
}
