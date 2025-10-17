import { Module } from '@nestjs/common';
import { BackupController } from './controllers/backup.controller';
import { BackupService } from './services/backup.service';
import { SshService } from './services/ssh.service';
import { CompressionService } from './services/compression.service';
import { FileDownloadService } from './services/file-download.service';
import { GoogleDriveService } from './services/google-drive.service';

@Module({
  imports: [],
  controllers: [BackupController],
  providers: [
    BackupService,
    SshService,
    CompressionService,
    FileDownloadService,
    GoogleDriveService,
  ],
})
export class AppModule {}
