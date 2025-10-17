/**
 * Download Options Interface
 * Configuration options for file download operations
 */
export interface DownloadOptions {
  /** Number of concurrent reads (default: 64) */
  concurrency?: number;

  /** Size of each read chunk in bytes (default: 65536 = 64KB) */
  chunkSize?: number;

  /** Progress callback function */
  onProgress?: (transferred: number, chunk: number, total: number) => void;

  /** Number of retry attempts on failure (default: 3) */
  retryAttempts?: number;

  /** Delay between retry attempts in milliseconds (default: 2000) */
  retryDelay?: number;
}

/**
 * Upload Options Interface
 * Configuration options for file upload operations
 */
export interface UploadOptions {
  /** Number of concurrent writes (default: 64) */
  concurrency?: number;

  /** Size of each write chunk in bytes (default: 32768 = 32KB) */
  chunkSize?: number;

  /** File mode/permissions (default: 0o644) */
  mode?: string | number;

  /** Progress callback function */
  onProgress?: (transferred: number, chunk: number, total: number) => void;

  /** Number of retry attempts on failure (default: 3) */
  retryAttempts?: number;

  /** Delay between retry attempts in milliseconds (default: 2000) */
  retryDelay?: number;
}

/**
 * Download Result Interface
 * Result information from a file download operation
 */
export interface DownloadResult {
  /** Local file path where file was saved */
  localPath: string;

  /** File size in bytes */
  fileSize: number;

  /** Download duration in seconds */
  duration: number;

  /** Average download speed in MB/s */
  averageSpeed: number;

  /** Success status */
  success: boolean;

  /** Error message if failed */
  error?: string;
}

/**
 * Upload Result Interface
 * Result information from a file upload operation
 */
export interface UploadResult {
  /** Remote file path where file was saved */
  remotePath: string;

  /** File size in bytes */
  fileSize: number;

  /** Upload duration in seconds */
  duration: number;

  /** Average upload speed in MB/s */
  averageSpeed: number;

  /** Success status */
  success: boolean;

  /** Error message if failed */
  error?: string;
}

/**
 * Tool Check Result Interface
 * Result from checking required tools on remote server
 */
export interface ToolCheckResult {
  /** Whether all required tools are available */
  available: boolean;

  /** List of missing tools (if any) */
  missing?: string[];
}
