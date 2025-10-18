import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Google Drive Service
 * Supports TWO authentication methods:
 * 1. OAuth2 Client Credentials (credentials.json from Google Cloud Console)
 * 2. Service Account (legacy, still supported)
 *
 * Method selection:
 * - Checks credentials file format automatically
 * - OAuth2: Has 'installed' or 'web' key
 * - Service Account: Has 'type': 'service_account'
 */
@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Upload file to Google Drive
   * Automatically detects credential type (OAuth2 or Service Account)
   *
   * @param filePath Local file path to upload
   * @param serverName Server name for folder structure (e.g., "Production_Server")
   * @param credentialsPath Optional: Path to credentials JSON (uses env var if not provided)
   * @param parentFolderId Optional: Parent folder ID where date folder will be created (uses env var if not provided)
   * @returns Object with fileId and folderId
   */
  async uploadFile(
    filePath: string,
    serverName: string,
    credentialsPath?: string,
    parentFolderId?: string,
  ): Promise<{ fileId: string; folderId: string }> {
    try {
      const finalCredentialsPath =
        credentialsPath ||
        this.configService.get<string>('googleDrive.credentialsPath');

      this.logger.log(`Uploading file to Google Drive: ${filePath}`);

      // Create date-based folder
      const folderId = await this.createDateFolder(
        serverName,
        finalCredentialsPath,
        parentFolderId,
      );

      const credentials = JSON.parse(
        fs.readFileSync(finalCredentialsPath, 'utf8'),
      );
      const auth = await this.createAuthClient(credentials);

      const drive = google.drive({ version: 'v3', auth });

      const fileMetadata: any = {
        name: path.basename(filePath),
        parents: [folderId],
      };

      const media = {
        mimeType: this.getMimeType(filePath),
        body: fs.createReadStream(filePath),
      };

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

      return { fileId: response.data.id, folderId };
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create appropriate auth client based on credentials type
   * Supports both OAuth2 and Service Account
   *
   * @param credentials Credentials object from JSON file
   * @returns Auth client
   */
  private async createAuthClient(credentials: any): Promise<any> {
    // Method 1: OAuth2 Client Credentials (credentials.json from Google Cloud Console)
    if (credentials.installed || credentials.web) {
      this.logger.log('Using OAuth2 Client Credentials');

      const oauth2Credentials = credentials.installed || credentials.web;

      // Create OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        oauth2Credentials.client_id,
        oauth2Credentials.client_secret,
        oauth2Credentials.redirect_uris
          ? oauth2Credentials.redirect_uris[0]
          : undefined,
      );

      // Check if we have a token file (token.json)
      const tokenPath =
        this.configService.get<string>('googleDrive.tokenPath') ||
        'credentials/token.json';

      if (fs.existsSync(tokenPath)) {
        const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        oauth2Client.setCredentials(token);
        this.logger.log('OAuth2 token loaded from file');
      } else {
        throw new Error(
          `OAuth2 token file not found: ${tokenPath}. ` +
            `Please run 'yarn generate-token' to generate token first. ` +
            `Or use Service Account credentials instead.`,
        );
      }

      return oauth2Client;
    }

    // Method 2: Service Account (legacy support)
    if (credentials.type === 'service_account') {
      this.logger.log('Using Service Account Credentials');

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });

      return auth;
    }

    // Unknown format
    throw new Error(
      'Unknown credentials format. ' +
        'Expected OAuth2 Client (credentials.json) or Service Account. ' +
        'Please download correct credentials from Google Cloud Console.',
    );
  }

  /**
   * Check if Google Drive is enabled in environment configuration
   * @returns True if enabled globally via environment variable
   */
  isEnabledByDefault(): boolean {
    return this.configService.get<boolean>('googleDrive.enabled');
  }

  /**
   * Get default credentials path from environment
   * @returns Credentials file path from config
   */
  getDefaultCredentialsPath(): string {
    return this.configService.get<string>('googleDrive.credentialsPath');
  }

  /**
   * Get default folder ID from environment
   * @returns Folder ID from config or undefined
   */
  getDefaultFolderId(): string | undefined {
    return this.configService.get<string>('googleDrive.defaultFolderId');
  }

  /**
   * Create folder in Google Drive with specific name
   * Creates folder structure: YYYY_MM_DD-Database_{serverName}
   * @param serverName Server name
   * @param credentialsPath Optional: Path to credentials
   * @param parentFolderId Optional: Parent folder ID
   * @returns Created folder ID
   */
  async createDateFolder(
    serverName: string,
    credentialsPath?: string,
    parentFolderId?: string,
  ): Promise<string> {
    try {
      // Create folder name: 2025_10_18-Database_ServerName
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const folderName = `${year}_${month}_${day}-Database_${serverName}`;

      const finalCredentialsPath =
        credentialsPath ||
        this.configService.get<string>('googleDrive.credentialsPath');
      const finalParentFolderId =
        parentFolderId ||
        this.configService.get<string>('googleDrive.defaultFolderId');

      this.logger.log(`Creating Google Drive folder: ${folderName}`);

      const credentials = JSON.parse(
        fs.readFileSync(finalCredentialsPath, 'utf8'),
      );
      const auth = await this.createAuthClient(credentials);
      const drive = google.drive({ version: 'v3', auth });

      // Check if folder already exists
      const searchQuery = finalParentFolderId
        ? `name='${folderName}' and '${finalParentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
        : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      const existingFolders = await drive.files.list({
        q: searchQuery,
        fields: 'files(id, name)',
      });

      // If folder exists, return its ID
      if (existingFolders.data.files && existingFolders.data.files.length > 0) {
        const existingFolderId = existingFolders.data.files[0].id;
        this.logger.log(
          `Folder already exists: ${folderName} (ID: ${existingFolderId})`,
        );
        return existingFolderId;
      }

      // Create new folder
      const folderMetadata: any = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      };

      if (finalParentFolderId) {
        folderMetadata.parents = [finalParentFolderId];
      }

      const response = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id, name',
      });

      this.logger.log(
        `✅ Folder created: ${folderName} (ID: ${response.data.id})`,
      );

      return response.data.id;
    } catch (error) {
      this.logger.error(`Failed to create folder: ${error.message}`);
      throw error;
    }
  }

  /**
   * Upload file from stream to Google Drive
   * Allows direct upload from SSH without saving to local disk
   * @param fileStream Readable stream
   * @param fileName File name
   * @param mimeType MIME type
   * @param folderId Folder ID to upload to
   * @param credentialsPath Optional: Path to credentials
   * @returns Uploaded file ID
   */
  async uploadFromStream(
    fileStream: any,
    fileName: string,
    mimeType: string,
    folderId?: string,
    credentialsPath?: string,
  ): Promise<string> {
    try {
      const finalCredentialsPath =
        credentialsPath ||
        this.configService.get<string>('googleDrive.credentialsPath');

      this.logger.log(`Uploading from stream to Google Drive: ${fileName}`);

      const credentials = JSON.parse(
        fs.readFileSync(finalCredentialsPath, 'utf8'),
      );
      const auth = await this.createAuthClient(credentials);
      const drive = google.drive({ version: 'v3', auth });

      const fileMetadata: any = {
        name: fileName,
      };

      if (folderId) {
        fileMetadata.parents = [folderId];
      }

      const media = {
        mimeType: mimeType,
        body: fileStream,
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink',
      });

      this.logger.log(
        `✅ File uploaded from stream. File ID: ${response.data.id}`,
      );
      if (response.data.webViewLink) {
        this.logger.log(`📎 Web view link: ${response.data.webViewLink}`);
      }

      return response.data.id;
    } catch (error) {
      this.logger.error(`Upload from stream failed: ${error.message}`);
      throw error;
    }
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
   * Get MIME type from filename
   * @param fileName File name
   * @returns MIME type string
   */
  getMimeTypeFromFilename(fileName: string): string {
    return this.getMimeType(fileName);
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
        credentialsPath ||
        this.configService.get<string>('googleDrive.credentialsPath');
      const finalFolderId =
        folderId ||
        this.configService.get<string>('googleDrive.defaultFolderId');

      if (!finalFolderId) {
        throw new Error('Folder ID is required to list files');
      }

      const credentials = JSON.parse(
        fs.readFileSync(finalCredentialsPath, 'utf8'),
      );

      const auth = await this.createAuthClient(credentials);
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
