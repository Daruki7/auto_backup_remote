import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BackupModule } from './modules/backup/backup.module';
import configuration from './config/configuration';

/**
 * Root Application Module
 * Imports all feature modules for the backup application
 * ConfigModule loads .env file and provides ConfigService
 */
@Module({
  imports: [
    // Load .env file globally with configuration factory
    ConfigModule.forRoot({
      isGlobal: true, // Make ConfigModule available everywhere
      envFilePath: '.env', // Path to .env file
      load: [configuration], // Load configuration factory
      cache: true, // Cache env variables for performance
      expandVariables: true, // Allow variable expansion
    }),
    BackupModule,
  ],
})
export class AppModule {}
