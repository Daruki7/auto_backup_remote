import { Module } from '@nestjs/common';
import { SshCommandService } from './services/ssh-command.service';
import { SftpClientService } from './services/sftp-client.service';

/**
 * Shared Module
 * Provides common services used across multiple modules
 * - SSH command execution
 * - SFTP file operations
 */
@Module({
  providers: [SshCommandService, SftpClientService],
  exports: [SshCommandService, SftpClientService],
})
export class SharedModule {}
