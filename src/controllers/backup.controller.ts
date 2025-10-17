import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { BackupService, BackupResult } from '../services/backup.service';
import { CreateBackupDto, BulkBackupDto } from '../dto/backup.dto';
import { BackupConfig } from '../config/backup.config';
import * as Table from 'cli-table3';

export interface BulkBackupResult {
  totalServers: number;
  successCount: number;
  failureCount: number;
  totalTime?: string; // Time taken for all backups in parallel
  results: (BackupResult & { duration?: string })[];
}

@ApiTags('Backup')
@Controller('backup')
export class BackupController {
  private readonly logger = new Logger(BackupController.name);

  constructor(private readonly backupService: BackupService) {}

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
          'H:/Backup/production-server/production-server_20251005_143022.zip',
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

    // 📊 Initial Info Table
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
        credentialsPath: createBackupDto.googleDrive?.credentialsPath,
      },
    };

    try {
      const result = await this.backupService.executeBackup(config);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      // 📊 Result Table
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

      // 📊 Details Table
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

      // 📊 Error Table
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

  @Post('bulk-execute')
  @ApiOperation({
    summary: 'Execute backup for multiple servers in parallel',
    description:
      'Process backup for multiple servers simultaneously. Each server will have its own folder in H:/Backup/{serverName}/{YYYY_MM_DD-Database_{serverName}}/',
  })
  @ApiBody({ type: BulkBackupDto })
  @ApiResponse({
    status: 200,
    description: 'Bulk backup executed',
    schema: {
      example: {
        totalServers: 4,
        successCount: 3,
        failureCount: 1,
        totalTime: '45.2s',
        results: [
          {
            success: true,
            serverName: 'Alo_Ship_2',
            localFilePath:
              'H:/Backup/Alo_Ship_2/2025_10_06-Database_Alo_Ship_2/Alo_Ship_2_20251006_143022.zip',
            fileSize: 125.43,
            duration: '42.1s',
          },
          {
            success: true,
            serverName: 'Alo_Ship_1',
            localFilePath:
              'H:/Backup/Alo_Ship_1/2025_10_06-Database_Alo_Ship_1/Alo_Ship_1_20251006_143025.zip',
            fileSize: 98.76,
            duration: '38.5s',
          },
          {
            success: false,
            serverName: 'GiaoNhanh',
            error: 'Connection timeout',
            duration: '30.0s',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async bulkExecuteBackup(
    @Body() bulkBackupDto: BulkBackupDto,
  ): Promise<BulkBackupResult> {
    const startTime = Date.now();

    // 📊 Initial table display
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

    // 🚀 PARALLEL PROCESSING: Create all backup promises
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

    // 🚀 Wait for ALL backups to complete in parallel
    const results = await Promise.all(backupPromises);

    // Calculate statistics
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    // 📊 FINAL SUMMARY TABLE
    console.log(
      '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    );
    console.log('🎯 Backup Complete - Final Summary');
    console.log(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
    );

    const summaryTable = new Table({
      head: ['#', 'Server', 'Status', 'File Size', 'Duration', 'Avg Speed'],
      colWidths: [5, 20, 12, 12, 10, 12],
      style: {
        head: ['cyan', 'bold'],
        border: ['grey'],
      },
    });

    results.forEach((result, index) => {
      const status = result.success ? '✅ Success' : '❌ Failed';
      const fileSize =
        result.success && 'fileSize' in result && result.fileSize
          ? `${result.fileSize.toFixed(2)} MB`
          : '-';
      const speed =
        result.success &&
        'fileSize' in result &&
        result.fileSize &&
        result.duration
          ? `${(result.fileSize / parseFloat(result.duration)).toFixed(2)} MB/s`
          : '-';

      summaryTable.push([
        (index + 1).toString(),
        result.serverName,
        status,
        fileSize,
        result.duration || '-',
        speed,
      ]);
    });

    console.log(summaryTable.toString());

    // 📊 DETAILED RESULTS TABLE (for successful backups)
    const successfulResults = results.filter((r) => r.success);
    if (successfulResults.length > 0) {
      console.log('\n📁 Backup Files Location:\n');

      const locationTable = new Table({
        head: ['Server', 'Local Path'],
        colWidths: [20, 80],
        style: {
          head: ['green', 'bold'],
          border: ['grey'],
        },
      });

      successfulResults.forEach((result) => {
        if ('localFilePath' in result) {
          locationTable.push([result.serverName, result.localFilePath || '-']);
        }
      });

      console.log(locationTable.toString());
    }

    // 📊 STATISTICS TABLE
    console.log('\n📊 Statistics:\n');

    const statsTable = new Table({
      head: ['Metric', 'Value'],
      colWidths: [35, 20],
      style: {
        head: ['yellow', 'bold'],
        border: ['grey'],
      },
    });

    const totalSize = results
      .reduce(
        (sum, r) =>
          sum + (r.success && 'fileSize' in r && r.fileSize ? r.fileSize : 0),
        0,
      )
      .toFixed(2);
    const successRate = (
      (successCount / bulkBackupDto.servers.length) *
      100
    ).toFixed(1);
    const avgSpeed =
      successfulResults.length > 0
        ? (
            successfulResults.reduce((sum, r) => {
              const hasFileSize = 'fileSize' in r;
              return (
                sum +
                (hasFileSize && r.fileSize && r.duration
                  ? (r as any).fileSize / parseFloat(r.duration)
                  : 0)
              );
            }, 0) / successfulResults.length
          ).toFixed(2)
        : '0';

    statsTable.push(
      ['Total Servers', bulkBackupDto.servers.length.toString()],
      ['✅ Successful Backups', successCount.toString()],
      ['❌ Failed Backups', failureCount.toString()],
      ['⏱️  Total Time (Parallel)', `${totalTime}s`],
      [
        '⏱️  Saved Time vs Sequential',
        `~${(bulkBackupDto.servers.length * 40 - parseFloat(totalTime)).toFixed(0)}s`,
      ],
      ['📊 Success Rate', `${successRate}%`],
      ['💾 Total Data Backed Up', `${totalSize} MB`],
      ['⚡ Average Download Speed', `${avgSpeed} MB/s`],
    );

    console.log(statsTable.toString());

    // 📊 FAILED BACKUPS TABLE (if any)
    const failedResults = results.filter((r) => !r.success);
    if (failedResults.length > 0) {
      console.log('\n❌ Failed Backups Details:\n');

      const failedTable = new Table({
        head: ['Server', 'Error Message'],
        colWidths: [20, 80],
        style: {
          head: ['red', 'bold'],
          border: ['grey'],
        },
      });

      failedResults.forEach((result) => {
        failedTable.push([result.serverName, result.error || 'Unknown error']);
      });

      console.log(failedTable.toString());
    }

    console.log(
      '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    );
    console.log(
      `${successCount === bulkBackupDto.servers.length ? '🎉' : '⚠️'} Bulk Backup Process Completed`,
    );
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

  @Post('test-connection')
  @ApiOperation({
    summary: 'Test SSH connection',
    description: 'Test SSH connection to a server without performing backup',
  })
  @ApiResponse({
    status: 200,
    description: 'Connection test result',
    schema: {
      example: {
        success: true,
        message: 'SSH connection successful',
      },
    },
  })
  async testConnection(@Body() createBackupDto: CreateBackupDto): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log(
      `Testing SSH connection to: ${createBackupDto.sshConfig.host}`,
    );

    try {
      const sshService = new (
        await import('../services/ssh.service')
      ).SshService();
      await sshService.executeCommand(
        {
          host: createBackupDto.sshConfig.host,
          port: createBackupDto.sshConfig.port || 22,
          username: createBackupDto.sshConfig.username,
          password: createBackupDto.sshConfig.password,
          privateKey: createBackupDto.sshConfig.privateKey,
        },
        'echo "Connection successful"',
      );

      return {
        success: true,
        message: 'SSH connection successful',
      };
    } catch (error) {
      return {
        success: false,
        message: `SSH connection failed: ${error.message}`,
      };
    }
  }
}
