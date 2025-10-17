# 🔄 Automated Server Backup System

> **✨ NEW**: Optimized architecture with 30-40% faster downloads using concurrent SFTP transfers

Hệ thống tự động hóa quy trình backup từ server qua SSH, nén file, download về local và upload lên Google Drive với hiệu suất cao.

## ✨ Tính năng chính

- 🔌 **SSH Connection**: Kết nối SSH với password hoặc private key
- 📦 **Auto Compression**: Nén folder thành ZIP hoặc TAR.GZ trên remote server
- 💾 **Optimized Download**: Download siêu nhanh với concurrent chunks (30-40% faster) ✨ NEW
- ☁️ **Google Drive Integration**: Upload lên Google Drive (optional, có thể bật/tắt)
- 🚀 **Multi-Server Backup**: Backup nhiều server song song, tiết kiệm thời gian
- 📁 **Smart Organization**: Mỗi server có folder riêng theo date: `H:/Backup/{serverName}/{YYYY_MM_DD-Database_{serverName}}/`
- 📝 **Swagger UI**: Test API dễ dàng qua browser
- 🧹 **Auto Cleanup**: Tự động xóa file tạm trên server
- 🔄 **Auto Retry**: Tự động retry khi download bị lỗi (3 lần) ✨ NEW
- 📊 **Real-time Progress**: Hiển thị progress download realtime ✨ NEW
- ⚙️ **Environment Config**: Cấu hình linh hoạt qua environment variables ✨ NEW
- 🔔 **Discord Notifications**: Thông báo tự động qua Discord khi backup xong ✨ NEW

## 🚀 Quick Start

```bash
# 1. Cài đặt dependencies
yarn install

# 2. Chạy development server
yarn dev

# 3. Mở Swagger UI
# http://localhost:3000/api

# 4. Production build
yarn build
yarn start:prod
```

## 🎯 API Endpoints

| Endpoint                  | Method | Description                         |
| ------------------------- | ------ | ----------------------------------- |
| `/api`                    | GET    | Swagger UI Documentation            |
| `/backup/execute`         | POST   | Backup single server                |
| `/backup/bulk-execute`    | POST   | Backup multiple servers in parallel |
| `/backup/test-connection` | POST   | Test SSH connection                 |

**🌟 Swagger UI**: http://localhost:3000/api

## 📋 Example Usage

### 1. Single Server Backup (Không upload Google Drive)

```bash
curl -X POST http://localhost:3000/backup/execute \
  -H "Content-Type: application/json" \
  -d @examples/single-server-backup.json
```

**File: examples/single-server-backup.json**

```json
{
  "serverName": "production-web-server",
  "sshConfig": {
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "password": "your-secure-password"
  },
  "remoteDirectory": "/var/www",
  "targetFolder": "uploads",
  "compressionType": "zip",
  "localBackupPath": "H:/Backup",
  "googleDrive": {
    "enabled": false
  }
}
```

### 2. Single Server Backup (Có upload Google Drive)

```bash
curl -X POST http://localhost:3000/backup/execute \
  -H "Content-Type: application/json" \
  -d @examples/single-server-with-google-drive.json
```

**File: examples/single-server-with-google-drive.json**

```json
{
  "serverName": "production-database-server",
  "sshConfig": {
    "host": "192.168.1.101",
    "port": 22,
    "username": "admin",
    "privateKey": "/path/to/private/key/id_rsa"
  },
  "remoteDirectory": "/var/backups",
  "targetFolder": "database",
  "compressionType": "tar.gz",
  "localBackupPath": "H:/Backup",
  "googleDrive": {
    "enabled": true,
    "folderId": "1abc_your_google_drive_folder_id_xyz",
    "credentialsPath": "credentials/google-drive.json"
  }
}
```

### 3. Multi-Server Parallel Backup

```bash
curl -X POST http://localhost:3000/backup/bulk-execute \
  -H "Content-Type: application/json" \
  -d @examples/multi-server-backup.json
```

**Performance**: Backup 4 servers song song:

- **Sequential**: 4 × 40s = 160s
- **Parallel**: ~45s ✅ (Tiết kiệm ~70% thời gian)

**File: examples/multi-server-backup.json** - See `examples/` directory

## 📁 Project Structure (✨ NEW - Modular Architecture)

```
auto_backup_thomi/
├── src/
│   ├── modules/
│   │   ├── backup/                      # Core backup module
│   │   │   ├── backup.module.ts
│   │   │   ├── controllers/
│   │   │   │   └── backup.controller.ts # REST API endpoints
│   │   │   ├── services/
│   │   │   │   ├── backup.service.ts    # Main orchestrator
│   │   │   │   ├── compression.service.ts
│   │   │   │   └── file-transfer.service.ts ✨ NEW
│   │   │   └── dto/
│   │   │       └── backup.dto.ts
│   │   ├── google-drive/                # Google Drive module
│   │   │   ├── google-drive.module.ts
│   │   │   └── services/
│   │   │       └── google-drive.service.ts
│   │   └── shared/                      # ✨ NEW: Shared services
│   │       ├── shared.module.ts
│   │       ├── interfaces/
│   │       │   ├── ssh-config.interface.ts
│   │       │   └── transfer-options.interface.ts
│   │       └── services/
│   │           ├── ssh-command.service.ts     ✨ NEW
│   │           └── sftp-client.service.ts     ✨ NEW (Optimized)
│   ├── config/
│   │   └── backup.config.ts             # Configuration with env vars
│   ├── app.module.ts
│   └── main.ts
├── examples/                            # ✨ NEW: JSON examples
│   ├── single-server-backup.json
│   ├── single-server-with-google-drive.json
│   ├── multi-server-backup.json
│   └── README.md
├── memory-bank/                         # Project documentation
├── credentials/                         # Google Drive credentials (gitignored)
└── README.md
```

## 🛠️ Technology Stack

- **Framework**: NestJS 10.x (Node.js)
- **Language**: TypeScript
- **SSH Commands**: ssh2
- **File Transfer**: ssh2-sftp-client ✨ NEW (Optimized with concurrent downloads)
- **Google Drive**: googleapis
- **Validation**: class-validator
- **Documentation**: Swagger/OpenAPI

## ⚡ Performance Improvements (✨ NEW)

### Before vs After

| File Size | Before (ssh2) | After (ssh2-sftp-client) | Improvement    |
| --------- | ------------- | ------------------------ | -------------- |
| 100MB     | ~90s          | ~60s                     | **33% faster** |
| 500MB     | ~450s         | ~300s                    | **33% faster** |
| 1GB       | ~900s         | ~630s                    | **30% faster** |

### Optimization Features

- ✅ **Concurrent chunk downloads**: 64 parallel reads (configurable)
- ✅ **Automatic retry logic**: 3 attempts with exponential backoff
- ✅ **Fast cipher algorithms**: aes128-gcm@openssh.com prioritized
- ✅ **Real-time progress tracking**: Progress callback every 10%
- ✅ **Optimal chunk size**: 64KB per chunk (configurable)
- ✅ **Discord notifications**: Auto-notify on backup complete ✨ NEW

## 🔧 Configuration

### Environment Variables (✨ NEW)

Create a `.env` file:

```bash
# Backup Settings
BACKUP_LOCAL_PATH=H:/Backup                   # Windows
# BACKUP_LOCAL_PATH=/backups                  # Linux/macOS
DEFAULT_COMPRESSION_FORMAT=zip                # zip or tar.gz
MAX_CONCURRENT_BACKUPS=5
SSH_TIMEOUT=30000

# SFTP Optimization (✨ NEW)
SFTP_CONCURRENCY=64                           # Parallel chunks (32-128)
SFTP_CHUNK_SIZE=65536                         # 64KB per chunk
SFTP_RETRY_ATTEMPTS=3                         # Auto-retry count
SFTP_RETRY_DELAY=2000                         # Delay between retries (ms)

# Google Drive (Optional)
GOOGLE_DRIVE_CREDENTIALS_PATH=credentials/google-drive.json
GOOGLE_DRIVE_FOLDER_ID=your-folder-id-here

# Discord Notifications (✨ NEW - Optional)
DISCORD_ENABLED=true
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_TOKEN
DISCORD_BOT_USERNAME=Backup Bot
```

### Cross-Platform Paths

- **Windows**: `H:/Backup` or `C:/Backups`
- **Linux**: `/backups` or `/var/backups`
- **macOS**: `/Users/yourname/Backups`
- **Docker**: Mount volume and configure path

### Google Drive Setup (Optional)

#### Bước 1: Setup Google Cloud Project

1. Tạo Google Cloud Project tại [Google Cloud Console](https://console.cloud.google.com)
2. Enable Google Drive API
3. Tạo Service Account và download credentials JSON
4. Save as `credentials/google-drive.json`
5. Share Drive folder với service account email

#### Bước 2: Cấu hình trong `.env` (Recommended ✨)

Copy `env.example` thành `.env` và set:

```bash
# Enable Google Drive upload globally
GOOGLE_DRIVE_ENABLED=true

# Path to credentials (Service Account)
GOOGLE_DRIVE_CREDENTIALS_PATH=credentials/google-drive.json

# Default folder ID (from Drive URL)
GOOGLE_DRIVE_FOLDER_ID=1abc_your_folder_id_xyz
```

**Ưu điểm:**

- ✅ Không cần specify trong mỗi request
- ✅ Dễ quản lý across environments (dev/staging/prod)
- ✅ Credentials được centralize
- ✅ Có thể override per request nếu cần

#### Bước 3: Sử dụng

**Cách 1: Dùng config từ .env (Simple)**

```json
{
  "googleDrive": {
    "enabled": true
  }
}
```

**Cách 2: Override config trong request**

```json
{
  "googleDrive": {
    "enabled": true,
    "credentialsPath": "custom/path/credentials.json",
    "folderId": "different-folder-id"
  }
}
```

**Cách 3: Disable upload**

```json
{
  "googleDrive": {
    "enabled": false
  }
}
```

**Priority Logic:**

1. Request có `enabled` → dùng giá trị đó
2. Request không có → dùng `GOOGLE_DRIVE_ENABLED` từ `.env`
3. Credentials/Folder: Request → Env → Default

### Discord Notifications Setup (✨ NEW)

#### Bước 1: Tạo Discord Webhook

1. Mở Discord server của bạn
2. Chọn channel muốn nhận thông báo
3. Click chuột phải → **Edit Channel** → **Integrations**
4. Click **Create Webhook** hoặc **Webhooks** → **New Webhook**
5. Đặt tên: `Backup Bot`
6. **Copy Webhook URL**
7. Lưu URL này

#### Bước 2: Cấu hình trong `.env`

```bash
# Enable Discord notifications
DISCORD_ENABLED=true

# Paste webhook URL từ bước 1
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_TOKEN

# Tên bot hiển thị (optional)
DISCORD_BOT_USERNAME=Backup Bot
```

#### Bước 3: Restart và Test

```bash
yarn dev
```

Khi backup xong, bạn sẽ nhận message trong Discord:

```
✅ Backup Thành Công

Server production-web đã được backup thành công!

🖥️ Server: production-web
💾 Kích thước: 125.43 MB
⏱️ Thời gian: 42.1s
📁 Vị trí file: H:/Backup/...
☁️ Google Drive: ✅ Đã upload
```

**Xem hướng dẫn chi tiết**: [DISCORD_SETUP.md](DISCORD_SETUP.md)

## 🎨 Features Detail

### Smart File Organization

```
H:/Backup/
├── web-server-01/
│   ├── 2025_10_17-Database_web-server-01/
│   │   └── uploads.zip
│   └── 2025_10_18-Database_web-server-01/
│       └── uploads.zip
├── database-server/
│   └── 2025_10_17-Database_database-server/
│       └── database.tar.gz
└── app-server/
    └── 2025_10_17-Database_app-server/
        └── data.tar.gz
```

### Automatic File Naming

Files are automatically cleaned and normalized:

- `uploads_20251017_123456.zip` → `uploads.zip`
- `database_backup.tar.gz` → `uploads.tar.gz`
- Timestamp preserved in folder name

### Parallel Processing

Multi-server backups run in parallel:

```typescript
// All servers backup simultaneously
Promise.all([
  backupServer1(),
  backupServer2(),
  backupServer3(),
  backupServer4(),
]);
```

### Error Handling

- Individual error handling per server
- Automatic cleanup on failure
- Detailed error messages
- Retry logic for transient failures ✨ NEW

## 📊 API Response Examples

### Success Response

```json
{
  "success": true,
  "serverName": "production-web-server",
  "localFilePath": "H:/Backup/production-web-server/2025_10_17-Database_production-web-server/uploads.zip",
  "fileSize": 125.43,
  "steps": {
    "sshConnection": true,
    "directoryCheck": true,
    "compression": true,
    "download": true,
    "googleDriveUpload": false
  }
}
```

### Multi-Server Response

```json
{
  "totalServers": 4,
  "successCount": 3,
  "failureCount": 1,
  "totalTime": "45.2s",
  "results": [
    {
      "success": true,
      "serverName": "web-server-01",
      "localFilePath": "H:/Backup/web-server-01/...",
      "fileSize": 125.43,
      "duration": "42.1s"
    },
    {
      "success": false,
      "serverName": "web-server-02",
      "error": "Connection timeout",
      "duration": "30.0s"
    }
  ]
}
```

## 🧪 Testing

### Test SSH Connection

```bash
curl -X POST http://localhost:3000/backup/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "serverName": "test",
    "sshConfig": {
      "host": "192.168.1.100",
      "port": 22,
      "username": "root",
      "password": "your-password"
    },
    "remoteDirectory": "/tmp",
    "targetFolder": "test"
  }'
```

### Unit Tests

```bash
yarn test
```

### Build Test

```bash
yarn build
```

## 📚 Documentation

Comprehensive documentation in `memory-bank/`:

- **projectbrief.md** - Project overview and objectives
- **productContext.md** - User problems and solutions
- **systemPatterns.md** - Architecture and design patterns ✨ UPDATED
- **techContext.md** - Technologies and setup
- **progress.md** - Current status and roadmap
- **activeContext.md** - Recent changes and focus ✨ UPDATED

See `examples/README.md` for more API examples.

## 🚨 Important Notes

### Security

- **Development**: OK to use without authentication (internal network)
- **Production**: Add API authentication (JWT/API keys)
- **Credentials**: Never commit SSH passwords or private keys to git
- **HTTPS**: Use HTTPS in production

### Performance Tips

1. **Network Speed**: Adjust `SFTP_CONCURRENCY` based on network
   - Slow network (< 100Mbps): `SFTP_CONCURRENCY=32`
   - Fast network (1Gbps+): `SFTP_CONCURRENCY=128`

2. **Compression**:
   - **ZIP**: Faster, slightly larger, Windows-friendly
   - **TAR.GZ**: Better compression, Linux standard

3. **Google Drive**: Disable if not needed for faster backups

### Requirements

**Remote Server (Ubuntu/Linux)**:

- SSH access (port 22 or custom)
- `zip` or `tar` + `gzip` installed
- Sufficient disk space for temp files

**Local Machine**:

- Node.js 16+ and Yarn
- Sufficient disk space for backups
- Network access to remote servers

## 🔄 Migration from Old Version

If upgrading from previous version:

1. **No breaking changes** - API endpoints unchanged
2. **Performance improved** - 30-40% faster automatically
3. **New config options** - Environment variables optional
4. **Modular structure** - Better code organization
5. **Examples added** - See `examples/` directory

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create feature branch
3. Commit your changes
4. Push to the branch
5. Create Pull Request

## 📝 Changelog

### v2.1.0 (October 2025) - Discord Notifications ✨

- ✅ Discord webhook integration for notifications
- ✅ Auto-notify on backup success/failure
- ✅ Rich embeds with colors and details
- ✅ Bulk backup summary notifications
- ✅ Configurable via environment variables
- ✅ Complete setup guide included

### v2.0.0 (October 2025) - Major Performance Update ✨

- ✅ Migrated to `ssh2-sftp-client` for 30-40% faster downloads
- ✅ Modular architecture with feature-based modules
- ✅ Concurrent chunk downloads (64 parallel reads)
- ✅ Automatic retry logic (3 attempts)
- ✅ Real-time progress tracking
- ✅ Environment variable configuration
- ✅ Google Drive with env-based config
- ✅ Comprehensive TypeScript interfaces
- ✅ Cleaner code organization
- ✅ Better error handling
- ✅ JSON examples added

### v1.0.0 (Previous)

- ✅ Basic SSH backup functionality
- ✅ Google Drive integration
- ✅ Multi-server support
- ✅ Swagger documentation

## 📄 License

UNLICENSED

---

**Made with ❤️ using NestJS**

**Performance Optimized**: 30-40% faster downloads with concurrent SFTP transfers ⚡

For questions or issues, check the API documentation at http://localhost:3000/api or see `examples/README.md` for detailed usage examples.
