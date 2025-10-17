import { Injectable, Logger } from '@nestjs/common';
import { SshCommandService } from '../../shared/services';
import { SshConfig } from '../../shared/interfaces';

/**
 * Compression Service
 * Handles file compression operations on remote servers
 */
@Injectable()
export class CompressionService {
  private readonly logger = new Logger(CompressionService.name);

  constructor(private readonly sshCommandService: SshCommandService) {}

  /**
   * Compress a folder on remote server (Ubuntu optimized)
   * PRODUCTION-SAFE: Uses nice command to reduce CPU priority
   * @param sshConfig SSH connection configuration
   * @param folderPath Full path to folder to compress
   * @param compressionType Type of compression (zip or tar.gz)
   * @returns Path to the compressed file on remote server
   */
  async compressFolder(
    sshConfig: SshConfig,
    folderPath: string,
    compressionType: 'zip' | 'tar.gz',
  ): Promise<string> {
    const timestamp = new Date().getTime();
    const folderName = folderPath.split('/').pop();
    const parentDir = folderPath.substring(0, folderPath.lastIndexOf('/'));
    let compressedFileName: string;
    let command: string;

    if (compressionType === 'zip') {
      compressedFileName = `${folderName}_${timestamp}.zip`;
      // Ubuntu: cd to parent directory and use zip with nice
      // nice -n 19: lowest CPU priority (won't affect production)
      // -r: recursive, -q: quiet mode
      command = `cd "${parentDir}" && nice -n 19 zip -rq "${compressedFileName}" "${folderName}"`;
    } else {
      // tar.gz
      compressedFileName = `${folderName}_${timestamp}.tar.gz`;
      // Ubuntu: cd to parent directory and use tar with nice
      // nice -n 19: lowest CPU priority (won't affect production)
      // -c: create, -z: gzip, -f: file
      command = `cd "${parentDir}" && nice -n 19 tar -czf "${compressedFileName}" "${folderName}"`;
    }

    this.logger.log(
      `Compressing folder: ${folderPath} as ${compressionType} (low priority)`,
    );
    this.logger.debug(`Command: ${command}`);

    try {
      await this.sshCommandService.executeCommand(sshConfig, command);
      const compressedFilePath = `${parentDir}/${compressedFileName}`;
      this.logger.log(`Compression completed: ${compressedFilePath}`);
      return compressedFilePath;
    } catch (error) {
      this.logger.error(`Compression failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a file from remote server
   * @param sshConfig SSH connection configuration
   * @param filePath Remote file path to delete
   */
  async deleteRemoteFile(
    sshConfig: SshConfig,
    filePath: string,
  ): Promise<void> {
    try {
      // Ubuntu: rm -f (force delete without prompt)
      await this.sshCommandService.executeCommand(
        sshConfig,
        `rm -f "${filePath}"`,
      );
      this.logger.log(`Deleted remote file: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete remote file: ${error.message}`);
      // Don't throw - cleanup failure shouldn't stop the backup process
      this.logger.warn(`Continuing despite cleanup failure`);
    }
  }
}
