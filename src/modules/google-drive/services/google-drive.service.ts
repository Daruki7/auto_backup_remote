import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { backupConfig } from '../../../config/backup.config';

/**
 * Google Drive Service
 * Handles file uploads to Google Drive with flexible configuration
 * Supports both environment variables and per-request configuration
 */
@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);

  /**
   * Upload file to Google Drive
   * Uses environment variables as defaults, can be overridden by parameters
   *
   * @param filePath Local file path to upload
   * @param credentialsPath Optional: Path to credentials JSON (uses env var if not provided)
   * @param folderId Optional: Google Drive folder ID (uses env var if not provided)
   * @returns Uploaded file ID
   */
  async uploadFile(
    filePath: string,
    credentialsPath?: string,
    folderId?: string,
  ): Promise<string> {
    try {
      // Use provided credentials path or fallback to environment variable
      const finalCredentialsPath =
        credentialsPath || backupConfig.googleDrive.credentialsPath;

      // Use provided folder ID or fallback to environment variable
      const finalFolderId =
        folderId || backupConfig.googleDrive.defaultFolderId;

      this.logger.log(
        `Google Drive upload initiated: ${path.basename(filePath)}`,
      );
      this.logger.debug(`Using credentials: ${finalCredentialsPath}`);
      if (finalFolderId) {
        this.logger.debug(`Target folder ID: ${finalFolderId}`);
      }

      // Check if credentials file exists
      if (!fs.existsSync(finalCredentialsPath)) {
        throw new Error(
          `Credentials file not found: ${finalCredentialsPath}. ` +
            `Please ensure GOOGLE_DRIVE_CREDENTIALS_PATH is set correctly in .env or provide credentials path in request.`,
        );
      }

      // Load credentials from file
      const credentials = JSON.parse(
        fs.readFileSync(finalCredentialsPath, 'utf8'),
      );

      // Create OAuth2 client with service account
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });

      const drive = google.drive({ version: 'v3', auth });

      const fileName = path.basename(filePath);
      const fileMetadata: any = {
        name: fileName,
      };

      // Add to specific folder if provided
      if (finalFolderId) {
        fileMetadata.parents = [finalFolderId];
      }

      const media = {
        mimeType: this.getMimeType(filePath),
        body: fs.createReadStream(filePath),
      };

      this.logger.log(`Uploading to Google Drive: ${fileName}`);

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink',
      });

      this.logger.log(
        `✅ File uploaded successfully. File ID: ${response.data.id}`,
      );
      if (response.data.webViewLink) {
        this.logger.log(`📎 Web view link: ${response.data.webViewLink}`);
      }

      return response.data.id;
    } catch (error) {
      this.logger.error(`❌ Google Drive upload failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if Google Drive is enabled in environment configuration
   * @returns True if enabled globally via environment variable
   */
  isEnabledByDefault(): boolean {
    return backupConfig.googleDrive.enabled;
  }

  /**
   * Get default credentials path from environment
   * @returns Credentials file path from config
   */
  getDefaultCredentialsPath(): string {
    return backupConfig.googleDrive.credentialsPath;
  }

  /**
   * Get default folder ID from environment
   * @returns Folder ID from config or undefined
   */
  getDefaultFolderId(): string | undefined {
    return backupConfig.googleDrive.defaultFolderId;
  }

  /**
   * Get MIME type based on file extension
   * @param filePath File path
   * @returns MIME type string
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.zip': 'application/zip',
      '.gz': 'application/gzip',
      '.tar': 'application/x-tar',
      '.tgz': 'application/gzip',
      '.tar.gz': 'application/gzip',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * List files in a Google Drive folder
   * @param credentialsPath Path to credentials JSON (optional, uses env var)
   * @param folderId Folder ID to list files from
   * @returns Array of file metadata
   */
  async listFilesInFolder(
    credentialsPath?: string,
    folderId?: string,
  ): Promise<any[]> {
    try {
      const finalCredentialsPath =
        credentialsPath || backupConfig.googleDrive.credentialsPath;
      const finalFolderId =
        folderId || backupConfig.googleDrive.defaultFolderId;

      if (!finalFolderId) {
        throw new Error('Folder ID is required to list files');
      }

      const credentials = JSON.parse(
        fs.readFileSync(finalCredentialsPath, 'utf8'),
      );

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });

      const drive = google.drive({ version: 'v3', auth });

      const response = await drive.files.list({
        q: `'${finalFolderId}' in parents and trashed=false`,
        fields: 'files(id, name, createdTime, size)',
        orderBy: 'createdTime desc',
      });

      return response.data.files || [];
    } catch (error) {
      this.logger.error(`Failed to list files: ${error.message}`);
      throw error;
    }
  }
}
