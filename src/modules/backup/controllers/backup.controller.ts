import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { BackupService, BackupResult } from '../services/backup.service';
import { CreateBackupDto, BulkBackupDto } from '../dto/backup.dto';
import { BackupConfig } from '../../../config/backup.config';
import { SshCommandService } from '../../shared/services';
import * as Table from 'cli-table3';

/**
 * Bulk Backup Result Interface
 * Contains aggregated results from multiple backup operations
 */
export interface BulkBackupResult {
  totalServers: number;
  successCount: number;
  failureCount: number;
  totalTime?: string;
  results: (BackupResult & { duration?: string })[];
}

/**
 * Backup Controller
 * REST API endpoints for backup operations
 */
@ApiTags('Backup')
@Controller('backup')
export class BackupController {
  private readonly logger = new Logger(BackupController.name);

  constructor(
    private readonly backupService: BackupService,
    private readonly sshCommandService: SshCommandService,
  ) {}

  /**
   * Execute backup for a single server
   */
  @Post('execute')
  @ApiOperation({
    summary: 'Execute backup for a single server',
    description:
      'Connect to server via SSH, compress folder, download to local PC, and optionally upload to Google Drive',
  })
  @ApiResponse({
    status: 200,
    description: 'Backup executed successfully',
    schema: {
      example: {
        success: true,
        serverName: 'production-server',
        localFilePath:
          'H:/Backup/production-server/production-server_20251017_143022.zip',
        googleDriveFileId: '1abc...xyz',
        fileSize: 125.43,
        steps: {
          sshConnection: true,
          directoryCheck: true,
          compression: true,
          download: true,
          googleDriveUpload: true,
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async executeBackup(
    @Body() createBackupDto: CreateBackupDto,
  ): Promise<BackupResult> {
    const startTime = Date.now();

    this.logger.log(
      `Received backup request for server: ${createBackupDto.serverName}`,
    );

    // Initial Info Table
    console.log(
      '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    );
    console.log('🚀 Starting Single Server Backup');
    console.log(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
    );

    const infoTable = new Table({
      head: ['Configuration', 'Value'],
      colWidths: [25, 75],
      style: {
        head: ['cyan', 'bold'],
        border: ['grey'],
      },
    });

    infoTable.push(
      ['🖥️  Server Name', createBackupDto.serverName],
      ['🌐 Host', createBackupDto.sshConfig.host],
      ['👤 Username', createBackupDto.sshConfig.username],
      [
        '📁 Remote Directory',
        `${createBackupDto.remoteDirectory}/${createBackupDto.targetFolder || 'uploads'}`,
      ],
      ['📦 Compression Type', createBackupDto.compressionType || 'zip'],
      ['💾 Local Backup Path', createBackupDto.localBackupPath || 'H:/Backup'],
      [
        '☁️  Google Drive',
        createBackupDto.googleDrive?.enabled ? '✅ Enabled' : '❌ Disabled',
      ],
    );

    console.log(infoTable.toString());
    console.log('\n⏳ Starting backup process...\n');

    const config: BackupConfig = {
      serverName: createBackupDto.serverName,
      sshConfig: {
        host: createBackupDto.sshConfig.host,
        port: createBackupDto.sshConfig.port || 22,
        username: createBackupDto.sshConfig.username,
        password: createBackupDto.sshConfig.password,
        privateKey: createBackupDto.sshConfig.privateKey,
      },
      remoteDirectory: createBackupDto.remoteDirectory,
      targetFolder: createBackupDto.targetFolder || 'uploads',
      compressionType: createBackupDto.compressionType || 'zip',
      localBackupPath: createBackupDto.localBackupPath || 'H:/Backup',
      googleDrive: {
        enabled: createBackupDto.googleDrive?.enabled || false,
        folderId: createBackupDto.googleDrive?.folderId,
        uploadMethod: createBackupDto.googleDrive?.uploadMethod || 'local',
        credentialsPath: createBackupDto.googleDrive?.credentialsPath,
      },
    };

    try {
      const result = await this.backupService.executeBackup(config);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      // Result Table
      console.log(
        '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      );
      console.log('✅ Backup Completed Successfully');
      console.log(
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
      );

      const resultTable = new Table({
        head: ['Step', 'Status'],
        colWidths: [30, 15],
        style: {
          head: ['green', 'bold'],
          border: ['grey'],
        },
      });

      resultTable.push(
        [
          '1. SSH Connection',
          result.steps.sshConnection ? '✅ Success' : '❌ Failed',
        ],
        [
          '2. Directory Check',
          result.steps.directoryCheck ? '✅ Success' : '❌ Failed',
        ],
        [
          '3. Compression',
          result.steps.compression ? '✅ Success' : '❌ Failed',
        ],
        ['4. Download', result.steps.download ? '✅ Success' : '❌ Failed'],
        [
          '5. Google Drive Upload',
          result.steps.googleDriveUpload
            ? '✅ Success'
            : config.googleDrive.enabled
              ? '❌ Failed'
              : '⏭️  Skipped',
        ],
      );

      console.log(resultTable.toString());

      // Details Table
      console.log('\n📊 Backup Details:\n');

      const detailsTable = new Table({
        head: ['Metric', 'Value'],
        colWidths: [30, 70],
        style: {
          head: ['yellow', 'bold'],
          border: ['grey'],
        },
      });

      const avgSpeed = result.fileSize
        ? (result.fileSize / parseFloat(duration)).toFixed(2)
        : '0';

      detailsTable.push(
        ['📁 Local File Path', result.localFilePath || '-'],
        [
          '💾 File Size',
          result.fileSize ? `${result.fileSize.toFixed(2)} MB` : '-',
        ],
        ['⏱️  Duration', `${duration}s`],
        ['⚡ Average Speed', `${avgSpeed} MB/s`],
      );

      if (result.googleDriveFileId) {
        detailsTable.push([
          '☁️  Google Drive File ID',
          result.googleDriveFileId,
        ]);
      }

      console.log(detailsTable.toString());

      console.log(
        '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      );
      console.log('🎉 Backup Process Completed');
      console.log(
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
      );

      return result;
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      // Error Table
      console.log(
        '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      );
      console.log('❌ Backup Failed');
      console.log(
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
      );

      const errorTable = new Table({
        head: ['Error Details', 'Information'],
        colWidths: [25, 75],
        style: {
          head: ['red', 'bold'],
          border: ['grey'],
        },
      });

      errorTable.push(
        ['Server Name', createBackupDto.serverName],
        ['Error Message', error.message],
        ['Duration', `${duration}s`],
      );

      console.log(errorTable.toString());

      console.log(
        '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
      );

      throw error;
    }
  }

  /**
   * Execute backup for multiple servers in parallel
   */
  @Post('bulk-execute')
  @ApiOperation({
    summary: 'Execute backup for multiple servers in parallel',
    description:
      'Process backup for multiple servers simultaneously. Each server will have its own folder.',
  })
  @ApiBody({ type: BulkBackupDto })
  @ApiResponse({
    status: 200,
    description: 'Bulk backup executed',
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async bulkExecuteBackup(
    @Body() bulkBackupDto: BulkBackupDto,
  ): Promise<BulkBackupResult> {
    const startTime = Date.now();

    // Initial table display
    console.log(
      '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    );
    console.log('🚀 Starting PARALLEL Backup');
    console.log(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
    );

    const startTable = new Table({
      head: ['#', 'Server Name', 'Host', 'Directory', 'Status'],
      colWidths: [5, 20, 18, 35, 12],
      style: {
        head: ['cyan', 'bold'],
        border: ['grey'],
      },
    });

    bulkBackupDto.servers.forEach((server, index) => {
      startTable.push([
        (index + 1).toString(),
        server.serverName,
        server.sshConfig.host,
        `${server.remoteDirectory}/${server.targetFolder}`,
        '⏳ Queued',
      ]);
    });

    console.log(startTable.toString());
    console.log(
      `\n⏱️  Estimated time (sequential): ~${bulkBackupDto.servers.length * 40}s`,
    );
    console.log(`⚡ Expected time (parallel): ~40-50s\n`);

    this.logger.log(
      `🚀 Starting PARALLEL backup for ${bulkBackupDto.servers.length} servers`,
    );

    // PARALLEL PROCESSING: Create all backup promises
    const backupPromises = bulkBackupDto.servers.map(async (serverDto) => {
      const serverStartTime = Date.now();
      this.logger.log(`[${serverDto.serverName}] Starting backup...`);

      const config: BackupConfig = {
        serverName: serverDto.serverName,
        sshConfig: {
          host: serverDto.sshConfig.host,
          port: serverDto.sshConfig.port || 22,
          username: serverDto.sshConfig.username,
          password: serverDto.sshConfig.password,
          privateKey: serverDto.sshConfig.privateKey,
        },
        remoteDirectory: serverDto.remoteDirectory,
        targetFolder: serverDto.targetFolder || 'uploads',
        compressionType: serverDto.compressionType || 'zip',
        localBackupPath: serverDto.localBackupPath || 'H:/Backup',
        googleDrive: {
          enabled: serverDto.googleDrive?.enabled || false,
          folderId: serverDto.googleDrive?.folderId,
          uploadMethod: serverDto.googleDrive?.uploadMethod || 'local',
          credentialsPath: serverDto.googleDrive?.credentialsPath,
        },
      };

      try {
        const result = await this.backupService.executeBackup(config);
        const duration = ((Date.now() - serverStartTime) / 1000).toFixed(1);

        this.logger.log(
          `[${serverDto.serverName}] ✅ Completed in ${duration}s`,
        );

        return {
          ...result,
          duration: `${duration}s`,
        };
      } catch (error) {
        const duration = ((Date.now() - serverStartTime) / 1000).toFixed(1);

        this.logger.error(
          `[${serverDto.serverName}] ❌ Failed in ${duration}s: ${error.message}`,
        );

        return {
          success: false,
          serverName: serverDto.serverName,
          error: error.message,
          duration: `${duration}s`,
          steps: {
            sshConnection: false,
            directoryCheck: false,
            compression: false,
            download: false,
            googleDriveUpload: false,
          },
        };
      }
    });

    // Wait for ALL backups to complete in parallel
    const results = await Promise.all(backupPromises);

    // Calculate statistics
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    // Display results (same table logic as before)
    console.log(
      '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    );
    console.log('🎯 Backup Complete - Final Summary');
    console.log(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
    );

    this.logger.log(
      `🎯 Bulk backup completed in ${totalTime}s: ${successCount} succeeded, ${failureCount} failed`,
    );

    return {
      totalServers: bulkBackupDto.servers.length,
      successCount,
      failureCount,
      totalTime: `${totalTime}s`,
      results,
    };
  }

  /**
   * Test SSH connection to a server
   */
  @Post('test-connection')
  @ApiOperation({
    summary: 'Test SSH connection',
    description: 'Test SSH connection to a server without performing backup',
  })
  @ApiResponse({
    status: 200,
    description: 'Connection test result',
  })
  async testConnection(@Body() createBackupDto: CreateBackupDto): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log(
      `Testing SSH connection to: ${createBackupDto.sshConfig.host}`,
    );

    try {
      const result = await this.sshCommandService.testConnection({
        host: createBackupDto.sshConfig.host,
        port: createBackupDto.sshConfig.port || 22,
        username: createBackupDto.sshConfig.username,
        password: createBackupDto.sshConfig.password,
        privateKey: createBackupDto.sshConfig.privateKey,
      });

      return {
        success: result,
        message: result ? 'SSH connection successful' : 'SSH connection failed',
      };
    } catch (error) {
      return {
        success: false,
        message: `SSH connection failed: ${error.message}`,
      };
    }
  }
}
