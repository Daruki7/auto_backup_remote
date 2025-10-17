import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);

  /**
   * Upload file to Google Drive
   */
  async uploadFile(
    filePath: string,
    credentialsPath: string,
    folderId?: string,
  ): Promise<string> {
    try {
      // Load credentials
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

      // Create OAuth2 client
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });

      const drive = google.drive({ version: 'v3', auth });

      const fileName = path.basename(filePath);
      const fileMetadata: any = {
        name: fileName,
      };

      if (folderId) {
        fileMetadata.parents = [folderId];
      }

      const media = {
        mimeType: this.getMimeType(filePath),
        body: fs.createReadStream(filePath),
      };

      this.logger.log(`Uploading file to Google Drive: ${fileName}`);

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink',
      });

      this.logger.log(
        `File uploaded successfully. File ID: ${response.data.id}`,
      );
      this.logger.log(`Web view link: ${response.data.webViewLink}`);

      return response.data.id;
    } catch (error) {
      this.logger.error(`Google Drive upload failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get MIME type based on file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.zip': 'application/zip',
      '.gz': 'application/gzip',
      '.tar': 'application/x-tar',
      '.tgz': 'application/gzip',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * List files in a Google Drive folder
   */
  async listFilesInFolder(
    credentialsPath: string,
    folderId: string,
  ): Promise<any[]> {
    try {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });

      const drive = google.drive({ version: 'v3', auth });

      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
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
