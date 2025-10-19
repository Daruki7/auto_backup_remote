import { Injectable, Logger } from '@nestjs/common';
import * as SftpClient from 'ssh2-sftp-client';
import * as fs from 'fs';
import {
  SshConfig,
  SftpConnectionOptions,
  DownloadOptions,
  DownloadResult,
  UploadOptions,
  UploadResult,
} from '../interfaces';

/**
 * SFTP Client Service
 * Optimized wrapper around ssh2-sftp-client with enhanced features:
 * - Concurrent chunk downloads/uploads
 * - Automatic retry logic
 * - Progress tracking
 * - Performance-optimized algorithms
 */
@Injectable()
export class SftpClientService {
  private readonly logger = new Logger(SftpClientService.name);

  /**
   * Download a file from remote server using optimized SFTP
   * Uses fastGet for concurrent chunk downloads
   * @param sshConfig SSH connection configuration
   * @param remotePath Remote file path
   * @param localPath Local destination path
   * @param options Download options (concurrency, chunk size, progress callback)
   * @returns Download result with performance metrics
   */
  async downloadFile(
    sshConfig: SshConfig,
    remotePath: string,
    localPath: string,
    options?: DownloadOptions,
  ): Promise<DownloadResult> {
    const startTime = Date.now();
    const client = new SftpClient();

    // Default options with performance optimizations
    const downloadOptions = {
      concurrency: options?.concurrency || 64,
      chunkSize: options?.chunkSize || 65536, // 64KB
      retryAttempts: options?.retryAttempts || 3,
      retryDelay: options?.retryDelay || 2000,
    };

    try {
      // Connect with optimized configuration
      await client.connect(this.buildConnectionConfig(sshConfig));
      this.logger.log(`SFTP connected to ${sshConfig.host}`);

      // Get file size for metrics
      const stats = await client.stat(remotePath);
      const fileSize = stats.size;
      this.logger.log(
        `Downloading: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`,
      );

      // Download with retry logic
      await this.executeWithRetry(
        async () => {
          await client.fastGet(remotePath, localPath, {
            concurrency: downloadOptions.concurrency,
            chunkSize: downloadOptions.chunkSize,
            step: (transferred: number, chunk: number, total: number) => {
              if (options?.onProgress) {
                options.onProgress(transferred, chunk, total);
              }

              // Log progress every 10%
              const progress = (transferred / total) * 100;
              if (Math.floor(progress) % 10 === 0) {
                this.logger.debug(
                  `Progress: ${progress.toFixed(1)}% (${(transferred / (1024 * 1024)).toFixed(2)} MB)`,
                );
              }
            },
          });
        },
        downloadOptions.retryAttempts,
        downloadOptions.retryDelay,
      );

      await client.end();

      // Calculate metrics
      const duration = (Date.now() - startTime) / 1000;
      const averageSpeed = fileSize / (1024 * 1024) / duration;

      this.logger.log(
        `✅ Download completed: ${duration.toFixed(1)}s - ${averageSpeed.toFixed(2)} MB/s`,
      );

      return {
        localPath,
        fileSize,
        duration,
        averageSpeed,
        success: true,
      };
    } catch (error) {
      this.logger.error(`Download failed: ${error.message}`);

      try {
        await client.end();
      } catch (endError) {
        // Ignore end errors
      }

      return {
        localPath,
        fileSize: 0,
        duration: (Date.now() - startTime) / 1000,
        averageSpeed: 0,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Upload a file to remote server using optimized SFTP
   * Uses fastPut for concurrent chunk uploads
   * @param localPath Local file path
   * @param remotePath Remote destination path
   * @param sshConfig SSH connection configuration
   * @param options Upload options
   * @returns Upload result with performance metrics
   */
  async uploadFile(
    localPath: string,
    remotePath: string,
    sshConfig: SshConfig,
    options?: UploadOptions,
  ): Promise<UploadResult> {
    const startTime = Date.now();
    const client = new SftpClient();

    // Default options with performance optimizations
    const uploadOptions = {
      concurrency: options?.concurrency || 64,
      chunkSize: options?.chunkSize || 32768, // 32KB for uploads
      mode: options?.mode || 0o644,
      retryAttempts: options?.retryAttempts || 3,
      retryDelay: options?.retryDelay || 2000,
    };

    try {
      // Get local file size
      const stats = fs.statSync(localPath);
      const fileSize = stats.size;

      // Connect with optimized configuration
      await client.connect(this.buildConnectionConfig(sshConfig));
      this.logger.log(`SFTP connected to ${sshConfig.host}`);
      this.logger.log(`Uploading: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);

      // Upload with retry logic
      await this.executeWithRetry(
        async () => {
          await client.fastPut(localPath, remotePath, {
            concurrency: uploadOptions.concurrency,
            chunkSize: uploadOptions.chunkSize,
            mode: uploadOptions.mode,
            step: (transferred: number, chunk: number, total: number) => {
              if (options?.onProgress) {
                options.onProgress(transferred, chunk, total);
              }
            },
          });
        },
        uploadOptions.retryAttempts,
        uploadOptions.retryDelay,
      );

      await client.end();

      // Calculate metrics
      const duration = (Date.now() - startTime) / 1000;
      const averageSpeed = fileSize / (1024 * 1024) / duration;

      this.logger.log(
        `✅ Upload completed: ${duration.toFixed(1)}s - ${averageSpeed.toFixed(2)} MB/s`,
      );

      return {
        remotePath,
        fileSize,
        duration,
        averageSpeed,
        success: true,
      };
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`);

      try {
        await client.end();
      } catch (endError) {
        // Ignore end errors
      }

      return {
        remotePath,
        fileSize: 0,
        duration: (Date.now() - startTime) / 1000,
        averageSpeed: 0,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get a readable stream from remote file
   * Used for direct upload to Google Drive without local storage
   * @param sshConfig SSH connection configuration
   * @param remotePath Remote file path
   * @returns Object with stream and client (caller must close client)
   */
  async getReadStream(
    sshConfig: SshConfig,
    remotePath: string,
  ): Promise<{
    stream: NodeJS.ReadableStream;
    client: SftpClient;
    fileSize: number;
  }> {
    const client = new SftpClient();
    try {
      await client.connect(this.buildConnectionConfig(sshConfig));
      this.logger.log(`SFTP connected to ${sshConfig.host} for streaming`);

      // Get file size
      const stats = await client.stat(remotePath);
      const fileSize = stats.size;
      this.logger.log(
        `Creating read stream for: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`,
      );

      // Create read stream
      const stream = client.createReadStream(remotePath);

      return { stream, client, fileSize };
    } catch (error) {
      this.logger.error(`Failed to create read stream: ${error.message}`);
      try {
        await client.end();
      } catch (endError) {
        // Ignore end errors
      }
      throw error;
    }
  }

  /**
   * Check if a file or directory exists on remote server
   * @param sshConfig SSH connection configuration
   * @param remotePath Remote path to check
   * @returns True if exists, false otherwise
   */
  async exists(sshConfig: SshConfig, remotePath: string): Promise<boolean> {
    const client = new SftpClient();
    try {
      await client.connect(this.buildConnectionConfig(sshConfig));
      const result = await client.exists(remotePath);
      await client.end();
      return result !== false;
    } catch (error) {
      this.logger.error(`Error checking existence: ${error.message}`);
      try {
        await client.end();
      } catch (endError) {
        // Ignore end errors
      }
      return false;
    }
  }

  /**
   * Build optimized SFTP connection configuration
   * @param sshConfig SSH configuration
   * @returns SFTP connection options with performance optimizations
   */
  private buildConnectionConfig(sshConfig: SshConfig): any {
    const config: any = {
      host: sshConfig.host,
      port: sshConfig.port || 22,
      username: sshConfig.username,
      readyTimeout: 30000,
      keepaliveInterval: 10000,
      keepaliveCountMax: 10,
      // Performance-optimized algorithms
      algorithms: {
        cipher: [
          'aes128-gcm@openssh.com', // Fastest cipher
          'aes128-ctr',
          'aes192-ctr',
          'aes256-ctr',
        ],
        serverHostKey: [
          'ssh-ed25519', // Fastest key type
          'ecdsa-sha2-nistp256',
          'ecdsa-sha2-nistp384',
          'ecdsa-sha2-nistp521',
          'rsa-sha2-512',
          'rsa-sha2-256',
        ],
        hmac: [
          'hmac-sha2-256-etm@openssh.com', // Fastest HMAC
          'hmac-sha2-512-etm@openssh.com',
          'hmac-sha2-256',
          'hmac-sha2-512',
        ],
        compress: ['none'], // No compression for already compressed files
      },
    };

    if (sshConfig.password) {
      config.password = sshConfig.password;
    }

    if (sshConfig.privateKey) {
      config.privateKey = fs.readFileSync(sshConfig.privateKey, 'utf8');
    }

    return config;
  }

  /**
   * Execute an operation with automatic retry logic
   * @param operation Operation to execute
   * @param maxAttempts Maximum number of attempts
   * @param delayMs Delay between attempts in milliseconds
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number,
    delayMs: number,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt < maxAttempts) {
          this.logger.warn(
            `Attempt ${attempt} failed: ${error.message}. Retrying in ${delayMs}ms...`,
          );
          await this.delay(delayMs);
        }
      }
    }

    throw lastError;
  }

  /**
   * Delay helper for retry logic
   * @param ms Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
