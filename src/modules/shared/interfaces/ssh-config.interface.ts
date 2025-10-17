/**
 * SSH Configuration Interface
 * Defines the configuration options for SSH connections
 */
export interface SshConfig {
  /** SSH server hostname or IP address */
  host: string;

  /** SSH port (default: 22) */
  port?: number;

  /** SSH username for authentication */
  username: string;

  /** Password for password-based authentication (optional) */
  password?: string;

  /** Path to private key file for key-based authentication (optional) */
  privateKey?: string;
}

/**
 * Algorithm Options for SSH/SFTP Connections
 * Optimized for maximum performance
 */
export interface AlgorithmOptions {
  /** Cipher algorithms (ordered by preference) */
  cipher?: string[];

  /** Server host key algorithms */
  serverHostKey?: string[];

  /** HMAC algorithms */
  hmac?: string[];

  /** Compression algorithms */
  compress?: string[];
}

/**
 * SFTP Connection Options
 * Extended SSH configuration with SFTP-specific options
 */
export interface SftpConnectionOptions extends SshConfig {
  /** Connection ready timeout in milliseconds (default: 30000) */
  readyTimeout?: number;

  /** Keepalive interval in milliseconds (default: 10000) */
  keepaliveInterval?: number;

  /** Maximum keepalive count before disconnect (default: 3) */
  keepaliveCountMax?: number;

  /** Algorithm options for optimized performance */
  algorithms?: AlgorithmOptions;

  /** Debug callback function for logging (optional) */
  debug?: (message: string) => void;
}
