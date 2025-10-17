export interface SshConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

export interface BackupConfig {
  serverName: string;
  sshConfig: SshConfig;
  remoteDirectory: string;
  targetFolder: string; // Folder to backup (e.g., "uploads")
  compressionType: 'zip' | 'tar.gz';
  localBackupPath: string; // e.g., "H:/Backup"
  googleDrive: {
    enabled: boolean;
    folderId?: string; // Google Drive folder ID
    credentialsPath?: string; // Path to Google credentials JSON
  };
}

export const defaultBackupConfig: Partial<BackupConfig> = {
  compressionType: 'zip',
  localBackupPath: 'H:/Backup',
  googleDrive: {
    enabled: false,
  },
};
