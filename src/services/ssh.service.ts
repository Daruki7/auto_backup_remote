import { Injectable, Logger } from '@nestjs/common';
import { Client, ConnectConfig } from 'ssh2';
import { SshConfig } from '../config/backup.config';
import * as fs from 'fs';

@Injectable()
export class SshService {
  private readonly logger = new Logger(SshService.name);

  /**
   * Execute a command on remote Ubuntu server via SSH
   */
  async executeCommand(sshConfig: SshConfig, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let output = '';
      let errorOutput = '';

      conn
        .on('ready', () => {
          this.logger.log(`SSH Connected to ${sshConfig.host}`);

          // Execute command with bash to ensure Ubuntu compatibility
          const bashCommand = `/bin/bash -c '${command.replace(/'/g, "'\\''")}'`;

          conn.exec(bashCommand, (err, stream) => {
            if (err) {
              conn.end();
              return reject(err);
            }

            stream
              .on('close', (code: number, signal: string) => {
                conn.end();
                if (code !== 0) {
                  this.logger.error(
                    `Command failed with code ${code}: ${errorOutput}`,
                  );
                  reject(
                    new Error(
                      `Command failed with code ${code}: ${errorOutput}`,
                    ),
                  );
                } else {
                  resolve(output);
                }
              })
              .on('data', (data: Buffer) => {
                output += data.toString();
              })
              .stderr.on('data', (data: Buffer) => {
                errorOutput += data.toString();
              });
          });
        })
        .on('error', (err) => {
          this.logger.error(`SSH Connection error: ${err.message}`);
          reject(err);
        })
        .connect(this.buildConnectConfig(sshConfig));
    });
  }

  /**
   * Check if a directory exists on remote Ubuntu server
   */
  async directoryExists(sshConfig: SshConfig, path: string): Promise<boolean> {
    try {
      // Ubuntu: use [ -d ] test with proper exit codes
      const result = await this.executeCommand(
        sshConfig,
        `[ -d "${path}" ] && echo "exists" || echo "not_exists"`,
      );
      const exists = result.trim() === 'exists';
      this.logger.log(
        `[Ubuntu] Directory ${path}: ${exists ? 'EXISTS' : 'NOT FOUND'}`,
      );
      return exists;
    } catch (error) {
      this.logger.error(`Error checking directory: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if required tools are installed on Ubuntu server
   */
  async checkRequiredTools(
    sshConfig: SshConfig,
    compressionType: 'zip' | 'tar.gz',
  ): Promise<{ available: boolean; missing?: string[] }> {
    const requiredTools = compressionType === 'zip' ? ['zip'] : ['tar', 'gzip'];
    const missing: string[] = [];

    for (const tool of requiredTools) {
      try {
        await this.executeCommand(sshConfig, `which ${tool}`);
        this.logger.log(`[Ubuntu] Tool '${tool}' is available`);
      } catch (error) {
        this.logger.warn(`[Ubuntu] Tool '${tool}' is NOT available`);
        missing.push(tool);
      }
    }

    if (missing.length > 0) {
      this.logger.error(
        `[Ubuntu] Missing tools: ${missing.join(', ')}. Please install with: sudo apt-get install ${missing.join(' ')}`,
      );
      return { available: false, missing };
    }

    return { available: true };
  }

  /**
   * Download a file from remote server via SFTP with maximum speed optimization
   * OPTIMIZED: Removes logging overhead, increases buffer, uses direct piping
   */
  async downloadFile(
    sshConfig: SshConfig,
    remotePath: string,
    localPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      const startTime = Date.now();

      conn
        .on('ready', () => {
          this.logger.log('SFTP connection ready');
          conn.sftp((err, sftp) => {
            if (err) {
              conn.end();
              return reject(err);
            }

            // Get file size for final log only
            sftp.stat(remotePath, (statErr, stats) => {
              if (statErr) {
                conn.end();
                return reject(statErr);
              }

              const totalSize = stats.size;

              this.logger.log(
                `Downloading: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`,
              );

              // 🚀 MAXIMUM SPEED OPTIMIZATION
              // 1. Larger buffer size (512KB - optimal for most networks)
              // 2. No progress tracking overhead
              // 3. Direct piping for maximum throughput
              const readStream = sftp.createReadStream(remotePath, {
                highWaterMark: 512 * 1024, // 512KB - optimal balance
                autoClose: true,
              });

              const writeStream = fs.createWriteStream(localPath, {
                highWaterMark: 512 * 1024, // 512KB matching read buffer
                autoClose: true,
              });

              // Minimal error handling - no overhead
              readStream.on('error', (err) => {
                writeStream.destroy();
                conn.end();
                reject(err);
              });

              writeStream.on('error', (err) => {
                readStream.destroy();
                conn.end();
                reject(err);
              });

              writeStream.on('close', () => {
                conn.end();
                const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(
                  1,
                );
                const avgSpeedMBps = (
                  totalSize /
                  1024 /
                  1024 /
                  parseFloat(totalSeconds)
                ).toFixed(2);

                this.logger.log(
                  `✅ Download completed: ${totalSeconds}s - ${avgSpeedMBps} MB/s`,
                );
                resolve();
              });

              // 🚀 Direct piping - no data event listener overhead
              readStream.pipe(writeStream);
            });
          });
        })
        .on('error', (err) => {
          this.logger.error(`SFTP Connection error: ${err.message}`);
          reject(err);
        })
        .connect(this.buildConnectConfig(sshConfig));
    });
  }

  /**
   * Build SSH connection config with maximum speed optimizations
   */
  private buildConnectConfig(sshConfig: SshConfig): ConnectConfig {
    const config: ConnectConfig = {
      host: sshConfig.host,
      port: sshConfig.port || 22,
      username: sshConfig.username,
      // 🚀 SPEED OPTIMIZATION: Timeout settings
      readyTimeout: 30000, // 30 seconds timeout
      // 🚀 SPEED OPTIMIZATION: Keep connection alive
      keepaliveInterval: 10000, // Send keepalive every 10 seconds
      keepaliveCountMax: 3, // Allow 3 missed keepalives before disconnect
      // 🚀 SPEED OPTIMIZATION: Use fastest cipher algorithms
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
        compress: ['none', 'zlib@openssh.com', 'zlib'], // No compression for already compressed files
      },
    };

    if (sshConfig.password) {
      config.password = sshConfig.password;
    }

    if (sshConfig.privateKey) {
      config.privateKey = fs.readFileSync(sshConfig.privateKey);
    }

    return config;
  }
}
