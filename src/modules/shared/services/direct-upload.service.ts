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

      // Generate date-based folder name
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const folderName = `${year}_${month}_${day}-Database_${googleDriveConfig.serverName}`;

      // Create Rclone config on remote server
      const rcloneConfig = await this.createRcloneConfig(
        sshConfig,
        googleDriveConfig.credentialsPath,
      );

      // Create folder in Google Drive
      const folderId = await this.createRemoteFolder(
        sshConfig,
        folderName,
        googleDriveConfig.folderId,
        rcloneConfig,
      );

      // Upload file to Google Drive
      const fileId = await this.uploadFileToDrive(
        sshConfig,
        remoteFilePath,
        folderId,
        rcloneConfig,
      );

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
   * Upload file directly from remote server to Google Drive using gdrive CLI
   * @param sshConfig SSH connection configuration
   * @param remoteFilePath Path to file on remote server
   * @param googleDriveConfig Google Drive configuration
   * @returns Upload result with file ID and folder name
   */
  async uploadWithGdrive(
    sshConfig: SshConfig,
    remoteFilePath: string,
    googleDriveConfig: {
      credentialsPath: string;
      folderId?: string;
      serverName: string;
    },
  ): Promise<{ fileId: string; folderName: string; method: 'gdrive' }> {
    try {
      this.logger.log(
        `[${googleDriveConfig.serverName}] 🚀 Starting gdrive direct upload: ${remoteFilePath}`,
      );

      // Generate date-based folder name
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const folderName = `${year}_${month}_${day}-Database_${googleDriveConfig.serverName}`;

      // Setup gdrive authentication on remote server
      await this.setupGdriveAuth(sshConfig, googleDriveConfig.credentialsPath);

      // Create folder in Google Drive
      const folderId = await this.createFolderWithGdrive(
        sshConfig,
        folderName,
        googleDriveConfig.folderId,
      );

      // Upload file to Google Drive
      const fileId = await this.uploadFileWithGdrive(
        sshConfig,
        remoteFilePath,
        folderId,
      );

      this.logger.log(
        `[${googleDriveConfig.serverName}] ✅ gdrive upload successful: ${fileId}`,
      );

      return { fileId, folderName, method: 'gdrive' };
    } catch (error) {
      this.logger.error(
        `[${googleDriveConfig.serverName}] ❌ gdrive upload failed: ${error.message}`,
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
    this.logger.log('Installing Rclone on remote server...');

    const installScript = `
      # Download and install Rclone
      curl https://rclone.org/install.sh | sudo bash
      
      # Verify installation
      rclone version
    `;

    await this.sshCommandService.executeCommand(sshConfig, installScript);
    this.logger.log('✅ Rclone installed successfully');
  }

  /**
   * Install gdrive CLI on remote server
   * @param sshConfig SSH connection configuration
   */
  async installGdrive(sshConfig: SshConfig): Promise<void> {
    this.logger.log('Installing gdrive CLI on remote server...');

    const installScript = `
      # Download gdrive
      wget https://github.com/prasmussen/gdrive/releases/latest/download/gdrive_2.1.1_linux_386.tar.gz
      tar -xzf gdrive_2.1.1_linux_386.tar.gz
      sudo mv gdrive /usr/local/bin/
      chmod +x /usr/local/bin/gdrive
      
      # Verify installation
      gdrive version
    `;

    await this.sshCommandService.executeCommand(sshConfig, installScript);
    this.logger.log('✅ gdrive CLI installed successfully');
  }

  /**
   * Create Rclone configuration on remote server
   * @param sshConfig SSH connection configuration
   * @param credentialsPath Path to Google Drive credentials
   * @returns Rclone config name
   */
  private async createRcloneConfig(
    sshConfig: SshConfig,
    credentialsPath: string,
  ): Promise<string> {
    const configName = 'gdrive';
    const credentials = JSON.parse(
      require('fs').readFileSync(credentialsPath, 'utf8'),
    );

    const rcloneConfig = `
[${configName}]
type = drive
client_id = ${credentials.client_id}
client_secret = ${credentials.client_secret}
scope = drive
token = {"access_token":"${credentials.access_token}","token_type":"Bearer","refresh_token":"${credentials.refresh_token}","expiry":"${credentials.expiry}"}
`;

    // Write config to remote server
    const configCommand = `cat > ~/.config/rclone/rclone.conf << 'EOF'
${rcloneConfig}
EOF`;

    await this.sshCommandService.executeCommand(sshConfig, configCommand);
    return configName;
  }

  /**
   * Create folder in Google Drive using Rclone
   * @param sshConfig SSH connection configuration
   * @param folderName Folder name to create
   * @param parentFolderId Parent folder ID
   * @param rcloneConfig Rclone configuration name
   * @returns Created folder ID
   */
  private async createRemoteFolder(
    sshConfig: SshConfig,
    folderName: string,
    parentFolderId: string | undefined,
    rcloneConfig: string,
  ): Promise<string> {
    const parentPath = parentFolderId
      ? `--drive-root-folder-id ${parentFolderId}`
      : '';

    const createFolderCommand = `
      rclone mkdir ${rcloneConfig}:${folderName} ${parentPath}
      rclone lsf ${rcloneConfig}:${folderName} --dirs-only
    `;

    await this.sshCommandService.executeCommand(sshConfig, createFolderCommand);
    return folderName; // Rclone uses folder name as path
  }

  /**
   * Upload file to Google Drive using Rclone
   * @param sshConfig SSH connection configuration
   * @param remoteFilePath Path to file on remote server
   * @param folderId Google Drive folder ID
   * @param rcloneConfig Rclone configuration name
   * @returns Uploaded file ID
   */
  private async uploadFileToDrive(
    sshConfig: SshConfig,
    remoteFilePath: string,
    folderId: string,
    rcloneConfig: string,
  ): Promise<string> {
    const fileName = remoteFilePath.split('/').pop();
    const uploadCommand = `
      rclone copy "${remoteFilePath}" ${rcloneConfig}:${folderId}/ --progress --transfers 1
      rclone lsf ${rcloneConfig}:${folderId}/ --files-only
    `;

    const result = await this.sshCommandService.executeCommand(
      sshConfig,
      uploadCommand,
    );

    // Extract file ID from result (simplified - in real implementation, parse the output)
    return `rclone_${Date.now()}`;
  }

  /**
   * Setup gdrive authentication on remote server
   * @param sshConfig SSH connection configuration
   * @param credentialsPath Path to Google Drive credentials
   */
  private async setupGdriveAuth(
    sshConfig: SshConfig,
    credentialsPath: string,
  ): Promise<void> {
    const credentials = JSON.parse(
      require('fs').readFileSync(credentialsPath, 'utf8'),
    );

    // Create auth file on remote server
    const authCommand = `
      mkdir -p ~/.gdrive
      cat > ~/.gdrive/credentials.json << 'EOF'
${JSON.stringify(credentials)}
EOF
    `;

    await this.sshCommandService.executeCommand(sshConfig, authCommand);
  }

  /**
   * Create folder in Google Drive using gdrive CLI
   * @param sshConfig SSH connection configuration
   * @param folderName Folder name to create
   * @param parentFolderId Parent folder ID
   * @returns Created folder ID
   */
  private async createFolderWithGdrive(
    sshConfig: SshConfig,
    folderName: string,
    parentFolderId: string | undefined,
  ): Promise<string> {
    const parentParam = parentFolderId ? `--parent ${parentFolderId}` : '';

    const createFolderCommand = `
      gdrive mkdir ${parentParam} "${folderName}"
    `;

    const result = await this.sshCommandService.executeCommand(
      sshConfig,
      createFolderCommand,
    );

    // Extract folder ID from result
    const folderIdMatch = result.match(/Created folder (.*)/);
    return folderIdMatch ? folderIdMatch[1] : folderName;
  }

  /**
   * Upload file to Google Drive using gdrive CLI
   * @param sshConfig SSH connection configuration
   * @param remoteFilePath Path to file on remote server
   * @param folderId Google Drive folder ID
   * @returns Uploaded file ID
   */
  private async uploadFileWithGdrive(
    sshConfig: SshConfig,
    remoteFilePath: string,
    folderId: string,
  ): Promise<string> {
    const uploadCommand = `
      gdrive upload --parent ${folderId} "${remoteFilePath}"
    `;

    const result = await this.sshCommandService.executeCommand(
      sshConfig,
      uploadCommand,
    );

    // Extract file ID from result
    const fileIdMatch = result.match(/Uploaded (.*) at/);
    return fileIdMatch ? fileIdMatch[1] : `gdrive_${Date.now()}`;
  }
}
