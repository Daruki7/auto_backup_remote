import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BackupModule } from './modules/backup/backup.module';

/**
 * Root Application Module
 * Imports all feature modules for the backup application
 * ConfigModule loads .env file and makes variables available via process.env
 */
@Module({
  imports: [
    // Load .env file globally
    ConfigModule.forRoot({
      isGlobal: true, // Make ConfigModule available everywhere
      envFilePath: '.env', // Path to .env file
      ignoreEnvFile: false, // Load .env file
      cache: true, // Cache env variables for performance
    }),
    BackupModule,
  ],
})
export class AppModule {}
