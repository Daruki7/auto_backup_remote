/**
 * Configuration Factory
 * Used by ConfigModule to load and validate environment variables
 * This ensures type-safe access to configuration via ConfigService
 */
export default () => ({
  // Application settings
  app: {
    port: parseInt(process.env.PORT, 10) || 3000,
    environment: process.env.NODE_ENV || 'development',
  },

  // Backup settings
  backup: {
    localBackupPath: process.env.BACKUP_LOCAL_PATH || 'H:/Backup',
    defaultCompressionFormat:
      (process.env.DEFAULT_COMPRESSION_FORMAT as 'zip' | 'tar.gz') || 'zip',
    maxConcurrentBackups: parseInt(process.env.MAX_CONCURRENT_BACKUPS, 10) || 5,
    sshTimeout: parseInt(process.env.SSH_TIMEOUT, 10) || 30000,
  },

  // SFTP optimization settings
  sftp: {
    concurrency: parseInt(process.env.SFTP_CONCURRENCY, 10) || 64,
    chunkSize: parseInt(process.env.SFTP_CHUNK_SIZE, 10) || 65536,
    retryAttempts: parseInt(process.env.SFTP_RETRY_ATTEMPTS, 10) || 3,
    retryDelay: parseInt(process.env.SFTP_RETRY_DELAY, 10) || 2000,
  },

  // Google Drive settings
  googleDrive: {
    enabled: process.env.GOOGLE_DRIVE_ENABLED === 'true',
    credentialsPath:
      process.env.GOOGLE_DRIVE_CREDENTIALS_PATH ||
      'credentials/credentials.json',
    tokenPath: process.env.GOOGLE_DRIVE_TOKEN_PATH || 'credentials/token.json',
    defaultFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || undefined,
  },

  // Discord notification settings
  discord: {
    enabled: process.env.DISCORD_ENABLED === 'true',
    // Method 1: Bot Token
    botToken: process.env.DISCORD_BOT_TOKEN || undefined,
    channelId: process.env.DISCORD_CHANNEL_ID || undefined,
    // Method 2: Webhook
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || undefined,
    botUsername: process.env.DISCORD_BOT_USERNAME || 'Backup Bot',
    botAvatarUrl: process.env.DISCORD_BOT_AVATAR_URL || undefined,
  },
});
