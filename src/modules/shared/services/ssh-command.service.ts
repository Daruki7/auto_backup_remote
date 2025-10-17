import { Injectable, Logger } from '@nestjs/common';
import { Client, ConnectConfig } from 'ssh2';
import * as fs from 'fs';
import { SshConfig, ToolCheckResult } from '../interfaces';

/**
 * SSH Command Service
 * Handles SSH command execution on remote servers
 * Separated from file transfer operations for better maintainability
 */
@Injectable()
export class SshCommandService {
  private readonly logger = new Logger(SshCommandService.name);

  /**
   * Execute a command on remote server via SSH
   * @param sshConfig SSH connection configuration
   * @param command Command to execute
   * @returns Command output as string
   */
  async executeCommand(sshConfig: SshConfig, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let output = '';
      let errorOutput = '';

      conn
        .on('ready', () => {
          this.logger.log(`SSH Connected to ${sshConfig.host}`);

          // Execute command with bash for Ubuntu compatibility
          const bashCommand = `/bin/bash -c '${command.replace(/'/g, "'\\''")}'`;

          conn.exec(bashCommand, (err, stream) => {
            if (err) {
              conn.end();
              return reject(err);
            }

            stream
              .on('close', (code: number) => {
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
   * Check if a directory exists on remote server
   * @param sshConfig SSH connection configuration
   * @param path Directory path to check
   * @returns True if directory exists
   */
  async directoryExists(sshConfig: SshConfig, path: string): Promise<boolean> {
    try {
      // Use [ -d ] test with proper exit codes
      const result = await this.executeCommand(
        sshConfig,
        `[ -d "${path}" ] && echo "exists" || echo "not_exists"`,
      );
      const exists = result.trim() === 'exists';
      this.logger.log(`Directory ${path}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
      return exists;
    } catch (error) {
      this.logger.error(`Error checking directory: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if required tools are installed on remote server
   * @param sshConfig SSH connection configuration
   * @param compressionType Type of compression (zip or tar.gz)
   * @returns Tool check result with availability status and missing tools
   */
  async checkRequiredTools(
    sshConfig: SshConfig,
    compressionType: 'zip' | 'tar.gz',
  ): Promise<ToolCheckResult> {
    const requiredTools = compressionType === 'zip' ? ['zip'] : ['tar', 'gzip'];
    const missing: string[] = [];

    for (const tool of requiredTools) {
      try {
        await this.executeCommand(sshConfig, `which ${tool}`);
        this.logger.log(`Tool '${tool}' is available`);
      } catch (error) {
        this.logger.warn(`Tool '${tool}' is NOT available`);
        missing.push(tool);
      }
    }

    if (missing.length > 0) {
      this.logger.error(
        `Missing tools: ${missing.join(', ')}. Please install with: sudo apt-get install ${missing.join(' ')}`,
      );
      return { available: false, missing };
    }

    return { available: true };
  }

  /**
   * Test SSH connection
   * @param sshConfig SSH connection configuration
   * @returns True if connection successful
   */
  async testConnection(sshConfig: SshConfig): Promise<boolean> {
    try {
      await this.executeCommand(sshConfig, 'echo "connected"');
      return true;
    } catch (error) {
      this.logger.error(`Connection test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Build SSH connection configuration
   * @param sshConfig SSH configuration
   * @returns SSH2 ConnectConfig object
   */
  private buildConnectConfig(sshConfig: SshConfig): ConnectConfig {
    const config: ConnectConfig = {
      host: sshConfig.host,
      port: sshConfig.port || 22,
      username: sshConfig.username,
      readyTimeout: 30000,
      keepaliveInterval: 10000,
      keepaliveCountMax: 3,
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
