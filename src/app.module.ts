import { Module } from '@nestjs/common';
import { BackupModule } from './modules/backup/backup.module';

/**
 * Root Application Module
 * Imports all feature modules for the backup application
 */
@Module({
  imports: [BackupModule],
})
export class AppModule {}
