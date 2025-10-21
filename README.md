# 🔄 Auto Backup Thomi - Hệ Thống Backup Server Tự Động

> **✨ LATEST**: Tối ưu cho file lớn 50GB+ với Rclone direct upload và intelligent fallback

Hệ thống backup server tự động với hiệu suất cao, hỗ trợ file siêu lớn, upload trực tiếp lên Google Drive và thông báo Discord real-time.

## ✨ Tính năng nổi bật

### 🚀 **Performance & Upload Methods**

- **🔌 SSH Connection**: Kết nối SSH với password hoặc private key
- **📦 Auto Compression**: Nén folder thành ZIP/TAR.GZ trên remote server
- **💾 Optimized Download**: Download siêu nhanh với concurrent chunks (30-40% faster)
- **🎯 Large File Optimization**: Tự động detect và tối ưu cho file 50GB+ ✨ **NEW**
- **☁️ Google Drive Integration**: 4 phương thức upload thông minh
  - **Rclone Direct** ⭐: Server → Drive trực tiếp (nhanh nhất, không cần local)
  - **gdrive Direct**: Server → Drive qua gdrive CLI (alternative)
  - **Optimized Streaming**: SSH → Drive qua stream (enhanced, 4MB chunks)
  - **Local Fallback**: SSH → Local → Drive (traditional, chỉ dùng cho file < 10GB)

### 🎯 **Smart Features**

- **📁 Date-Based Folders**: Tự động tạo folder: `YYYY_MM_DD-Database_ServerName`
- **🔁 Intelligent Fallback**: Rclone → gdrive → Streaming (NO local fallback cho file lớn)
- **🚀 Multi-Server Backup**: Backup nhiều server song song (70% time reduction)
- **🔄 Auto Retry**: Tự động retry với exponential backoff (10 attempts cho large files)
- **📊 Real-time Progress**: Hiển thị progress download/upload realtime
- **🧹 Auto Cleanup**: Tự động xóa file tạm trên server

### 🔔 **Monitoring & Notifications**

- **Discord Notifications**: Thông báo tự động với rich embeds
  - Hiển thị phương pháp upload (Rclone/gdrive/Streaming)
  - File size, upload time, Google Drive folder
  - Success/failure với troubleshooting info
- **API Documentation**: Swagger UI tích hợp sẵn
- **Environment Config**: Cấu hình linh hoạt qua .env

---

## 📖 Mục lục

1. [Quick Start](#-quick-start)
2. [Installation](#-installation-chi-tiết)
3. [Configuration](#-configuration)
4. [Usage Examples](#-usage-examples)
5. [Upload Methods](#-upload-methods-chi-tiết)
6. [Large File Optimization](#-large-file-optimization-50gb)
7. [Discord Notifications](#-discord-notifications)
8. [API Reference](#-api-reference)
9. [Performance Tips](#-performance-tips)
10. [Troubleshooting](#-troubleshooting)

---

## 🚀 Quick Start

### 1. Cài đặt Dependencies

```bash
# Clone repository
git clone https://github.com/your-repo/auto_backup_thomi.git
cd auto_backup_thomi

# Install dependencies
yarn install
```

### 2. Cấu hình Environment

```bash
# Copy env example
cp env.example .env

# Edit .env với editor của bạn
nano .env  # hoặc code .env
```

**Cấu hình tối thiểu**:

```bash
# Backup path (adjust theo OS của bạn)
BACKUP_LOCAL_PATH=H:/Backup  # Windows
# BACKUP_LOCAL_PATH=/backups  # Linux/macOS

# Google Drive (optional)
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_CREDENTIALS_PATH=credentials/credentials.json
GOOGLE_DRIVE_FOLDER_ID=your-folder-id

# Discord notifications (optional)
DISCORD_ENABLED=true
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### 3. Start Development Server

```bash
# Development with hot reload
yarn dev

# Hoặc production build
yarn build
yarn start:prod
```

### 4. Open Swagger UI

Mở browser và truy cập: **http://localhost:3000/api**

🎉 **Done!** Bạn đã sẵn sàng để backup!

---

## 📦 Installation chi tiết

### Prerequisites

**Local Machine**:

- Node.js 16+ ([Download](https://nodejs.org/))
- Yarn package manager: `npm install -g yarn`
- Git (optional)

**Remote Server** (Ubuntu/Linux):

- SSH access (port 22 hoặc custom)
- `zip` hoặc `tar` + `gzip` installed
- Sufficient disk space cho temp files

### Kiểm tra Remote Server

```bash
# Test SSH connection
ssh user@your-server-ip

# Check compression tools
zip --version
tar --version

# Check disk space
df -h
```

### Install Compression Tools (nếu chưa có)

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install zip gzip tar

# CentOS/RHEL
sudo yum install zip gzip tar
```

### Install Rclone on Remote Server (Optional - cho Large File)

```bash
# Install Rclone
curl https://rclone.org/install.sh | sudo bash

# Verify installation
rclone version
```

---

## ⚙️ Configuration

### 1. Environment Variables (.env)

Copy file `env.example` thành `.env`:

```bash
cp env.example .env
```

**Cấu hình đầy đủ**:

```bash
###################
# BACKUP SETTINGS
###################
BACKUP_LOCAL_PATH=H:/Backup                   # Windows: H:/Backup
# BACKUP_LOCAL_PATH=/backups                  # Linux/macOS: /backups
DEFAULT_COMPRESSION_FORMAT=zip                # zip hoặc tar.gz
MAX_CONCURRENT_BACKUPS=5                      # Số server backup đồng thời
SSH_TIMEOUT=30000                             # SSH timeout (ms)

###################
# SFTP OPTIMIZATION
###################
SFTP_CONCURRENCY=64                           # Parallel chunks (32-128)
SFTP_CHUNK_SIZE=65536                         # 64KB per chunk
SFTP_RETRY_ATTEMPTS=3                         # Auto-retry count
SFTP_RETRY_DELAY=2000                         # Delay between retries (ms)

###################
# GOOGLE DRIVE (Optional)
###################
GOOGLE_DRIVE_ENABLED=true                     # Enable/disable global
GOOGLE_DRIVE_CREDENTIALS_PATH=credentials/credentials.json
GOOGLE_DRIVE_TOKEN_PATH=credentials/token.json
GOOGLE_DRIVE_FOLDER_ID=your-folder-id-here    # Lấy từ Drive URL

###################
# DISCORD NOTIFICATIONS (Optional)
###################
DISCORD_ENABLED=true
DISCORD_BOT_TOKEN=your-bot-token              # Nếu dùng bot
DISCORD_CHANNEL_ID=your-channel-id            # Channel ID
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...  # Webhook URL
DISCORD_BOT_USERNAME=Backup Bot
DISCORD_BOT_AVATAR_URL=https://...            # Avatar URL (optional)

###################
# LARGE FILE OPTIMIZATION (Optional)
###################
LARGE_FILE_THRESHOLD_GB=10                    # Auto-detect large files
LARGE_FILE_CHUNK_SIZE_MB=4                    # Chunk size for large files
LARGE_FILE_TIMEOUT_MINUTES=30                 # Timeout for large files
```

### 2. Google Drive Setup

#### Phương pháp 1: Service Account (Recommended)

**Bước 1: Tạo Service Account**

1. Truy cập [Google Cloud Console](https://console.cloud.google.com)
2. Tạo project mới hoặc chọn project có sẵn
3. Enable **Google Drive API**
4. Tạo **Service Account**:
   - IAM & Admin → Service Accounts → Create Service Account
   - Nhập name: `backup-service`
   - Role: **Editor** hoặc **Owner**
5. Tạo Key (JSON format)
6. Download file JSON → Save as `credentials/credentials.json`

**Bước 2: Share Drive Folder**

1. Mở Google Drive
2. Tạo folder mới: `Server Backups`
3. Click phải folder → Share
4. Paste service account email (từ file JSON: `client_email`)
5. Set permission: **Editor**
6. Copy Folder ID từ URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`

**Bước 3: Cấu hình .env**

```bash
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_CREDENTIALS_PATH=credentials/credentials.json
GOOGLE_DRIVE_FOLDER_ID=1abc...xyz  # Paste folder ID
```

#### Phương pháp 2: OAuth2 (cho personal use)

Xem hướng dẫn chi tiết: [GOOGLE_DRIVE_OAUTH2_SETUP.md](GOOGLE_DRIVE_OAUTH2_SETUP.md)

### 3. Discord Notifications Setup

#### Phương pháp 1: Webhook (Simple - Recommended)

**Bước 1: Tạo Webhook**

1. Mở Discord server
2. Chọn channel muốn nhận notification
3. Click chuột phải channel → **Edit Channel**
4. Chọn **Integrations** → **Webhooks**
5. Click **New Webhook** hoặc **Create Webhook**
6. Đặt tên: `Backup Bot`
7. Click **Copy Webhook URL**

**Bước 2: Cấu hình .env**

```bash
DISCORD_ENABLED=true
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123.../abc...
DISCORD_BOT_USERNAME=Backup Bot
```

#### Phương pháp 2: Bot Token (Advanced)

Xem hướng dẫn chi tiết: [TESTING_DISCORD.md](TESTING_DISCORD.md)

---

## 📝 Usage Examples

### Example 1: Backup đơn giản (chỉ lưu local)

**Request**:

```bash
curl -X POST http://localhost:3000/backup/execute \
  -H "Content-Type: application/json" \
  -d '{
    "serverName": "web-server-01",
    "sshConfig": {
      "host": "192.168.1.100",
      "port": 22,
      "username": "root",
      "password": "your-password"
    },
    "remoteDirectory": "/var/www",
    "targetFolder": "uploads",
    "compressionType": "zip",
    "localBackupPath": "H:/Backup",
    "googleDrive": {
      "enabled": false
    }
  }'
```

**Result**:

- ✅ File nén: `H:/Backup/web-server-01/2025_10_21-Database_web-server-01/uploads.zip`
- ✅ Discord notification: "Backup thành công"

---

### Example 2: Backup + Upload Google Drive (Local Method)

**Request**:

```json
{
  "serverName": "database-server",
  "sshConfig": {
    "host": "192.168.1.101",
    "port": 22,
    "username": "admin",
    "privateKey": "/path/to/id_rsa"
  },
  "remoteDirectory": "/var/backups",
  "targetFolder": "mysql",
  "compressionType": "tar.gz",
  "googleDrive": {
    "enabled": true,
    "uploadMethod": "local" // Tải về local trước (default)
  }
}
```

**Flow**:

1. SSH → Server: Nén `/var/backups/mysql` → `mysql.tar.gz`
2. Download → Local: `H:/Backup/database-server/2025_10_21-Database_database-server/mysql.tar.gz`
3. Upload → Google Drive: `2025_10_21-Database_database-server/mysql.tar.gz`

**Result**:

- ✅ Local file: Có
- ✅ Google Drive: Có
- ✅ Discord: "Backup thành công - Local method"

---

### Example 3: Backup Large File (Direct Method) ⭐ RECOMMENDED

**Request**:

```json
{
  "serverName": "production-db",
  "sshConfig": {
    "host": "192.168.1.102",
    "username": "root",
    "password": "password"
  },
  "remoteDirectory": "/backups",
  "targetFolder": "database",
  "compressionType": "zip",
  "googleDrive": {
    "enabled": true,
    "uploadMethod": "direct" // Upload trực tiếp, KHÔNG lưu local
  }
}
```

**Flow**:

1. SSH → Server: Nén `/backups/database` → `database.zip`
2. **Automatic Detection**: File > 10GB → Use Rclone/gdrive
3. Upload → Direct: Server → Google Drive (NO local)

**Result**:

- ❌ Local file: **KHÔNG** (trừ khi fallback)
- ✅ Google Drive: Có
- ✅ Discord: "Backup thành công - Rclone Direct method"

**Advantages**:

- ✅ **50% nhanh hơn** (1 transfer thay vì 2)
- ✅ **Không tốn disk local** (quan trọng cho file 50GB+)
- ✅ **Auto fallback** nếu direct method fail

---

### Example 4: Multi-Server Backup (Parallel)

**Request**:

```bash
curl -X POST http://localhost:3000/backup/bulk-execute \
  -H "Content-Type: application/json" \
  -d '{
    "servers": [
      {
        "serverName": "web-01",
        "sshConfig": { "host": "192.168.1.100", ... },
        "remoteDirectory": "/var/www",
        "targetFolder": "uploads",
        "compressionType": "zip"
      },
      {
        "serverName": "web-02",
        "sshConfig": { "host": "192.168.1.101", ... },
        "remoteDirectory": "/var/www",
        "targetFolder": "uploads",
        "compressionType": "zip"
      },
      {
        "serverName": "db-01",
        "sshConfig": { "host": "192.168.1.102", ... },
        "remoteDirectory": "/backups",
        "targetFolder": "mysql",
        "compressionType": "tar.gz",
        "googleDrive": { "enabled": true, "uploadMethod": "direct" }
      },
      {
        "serverName": "api-01",
        "sshConfig": { "host": "192.168.1.103", ... },
        "remoteDirectory": "/app",
        "targetFolder": "data",
        "compressionType": "zip"
      }
    ]
  }'
```

**Performance**:

- **Sequential**: 4 × 40s = 160s ❌
- **Parallel**: ~45s ✅ (70% time reduction)

**Result**:

```json
{
  "totalServers": 4,
  "successCount": 4,
  "failureCount": 0,
  "totalTime": "45.2s",
  "results": [...]
}
```

**Discord Notification**: Bulk summary với success/failure count

---

## 📤 Upload Methods chi tiết

### 1. **Rclone Direct** (⭐ Nhanh nhất)

**Khi nào dùng**: File lớn 10GB+, production backups

**Setup**:

```bash
# Trên remote server
curl https://rclone.org/install.sh | sudo bash
rclone config  # Setup Google Drive
```

**Cấu hình**:

```json
{
  "googleDrive": {
    "enabled": true,
    "uploadMethod": "direct"
  }
}
```

**Performance**:

- Speed: ⭐⭐⭐⭐⭐
- Memory: ⭐⭐⭐⭐⭐ (No local storage)
- Reliability: ⭐⭐⭐⭐

**Optimization Flags**:

```bash
--buffer-size 16M      # 16MB buffer
--use-mmap            # Memory mapping
--fast-list           # Fast listing
--transfers 1         # Single transfer
--retries 3           # Auto retry
```

---

### 2. **gdrive CLI Direct** (Alternative)

**Khi nào dùng**: Không có Rclone, cần tool đơn giản

**Setup**:

```bash
# Trên remote server
wget https://github.com/prasmussen/gdrive/releases/latest/download/gdrive_2.1.1_linux_386.tar.gz
tar -xzf gdrive_2.1.1_linux_386.tar.gz
sudo mv gdrive /usr/local/bin/
```

**Performance**:

- Speed: ⭐⭐⭐⭐⭐
- Memory: ⭐⭐⭐⭐⭐
- Reliability: ⭐⭐⭐⭐

---

### 3. **Optimized Streaming** (Enhanced)

**Khi nào dùng**: Không có Rclone/gdrive, file 1-10GB

**Cấu hình**: Automatic fallback

**Performance**:

- Speed: ⭐⭐⭐⭐
- Memory: ⭐⭐⭐⭐ (Streaming chunks)
- Reliability: ⭐⭐⭐⭐⭐

**Optimizations**:

- Dynamic chunk size: 256KB - 4MB (based on file size)
- 30-minute timeout
- 10 retry attempts
- Resumable upload

---

### 4. **Local Fallback** (Traditional)

**Khi nào dùng**: File nhỏ < 10GB, cần local copy

**Cấu hình**:

```json
{
  "googleDrive": {
    "enabled": true,
    "uploadMethod": "local"
  }
}
```

**Performance**:

- Speed: ⭐⭐⭐
- Memory: ⭐⭐ (Full file in RAM + disk)
- Reliability: ⭐⭐⭐⭐⭐

**⚠️ Warning**: Không dùng cho file 50GB+ (sẽ làm đầy RAM/disk)

---

## 📊 Large File Optimization (50GB+)

### Auto Detection

System tự động detect file > 10GB và dùng large file optimization:

```typescript
if (fileSize > 10GB) {
  // Use Rclone Direct → gdrive Direct → Optimized Streaming
  // NO Local Fallback (prevent memory overflow)
}
```

### Dynamic Chunking

Chunk size tự động điều chỉnh:

| File Size  | Chunk Size | Upload Timeout | Retries |
| ---------- | ---------- | -------------- | ------- |
| < 1GB      | 256KB      | 15 minutes     | 5       |
| 1-10GB     | 1MB        | 15 minutes     | 5       |
| 10-50GB    | 2MB        | 30 minutes     | 10      |
| **> 50GB** | **4MB**    | **30 minutes** | **10**  |

### Memory Usage

| File Size | Standard Method | Large File Optimization | Savings  |
| --------- | --------------- | ----------------------- | -------- |
| 50GB      | 50GB+ RAM       | Streaming chunks only   | **95%+** |
| 100GB     | 100GB+ RAM      | Streaming chunks only   | **95%+** |

### Performance Comparison

| Method                  | Speed      | Memory     | Network    | Best For    |
| ----------------------- | ---------- | ---------- | ---------- | ----------- |
| **Rclone Direct**       | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 50GB+ files |
| **Optimized Streaming** | ⭐⭐⭐⭐   | ⭐⭐⭐⭐   | ⭐⭐⭐⭐   | Fallback    |
| **Local Method**        | ⭐⭐⭐     | ⭐⭐       | ⭐⭐       | **AVOID**   |

**📚 Chi tiết**: [LARGE_FILE_OPTIMIZATION.md](LARGE_FILE_OPTIMIZATION.md)

---

## 🔔 Discord Notifications

### Notification Types

#### 1. Success Notification

```
✅ Backup Thành Công

Server production-db đã được backup thành công!

🖥️ Server: production-db
💾 Kích thước: 45.23 GB
⏱️ Thời gian: 1,234.5s (20.6 phút)
📤 Phương pháp: 🚀 Direct (SSH → Drive)
📁 Vị trí file local: KHÔNG (direct upload)
☁️ Google Drive: ✅ Đã upload thành công
📂 Folder trên Drive: 2025_10_21-Database_production-db
```

#### 2. Failure Notification

```
❌ Backup Thất Bại

Backup server production-db đã thất bại!

🖥️ Server: production-db
⏱️ Thời gian: 42.1s
❌ Lỗi: SSH connection timeout after 30s
```

#### 3. Bulk Summary

```
📊 Báo cáo Bulk Backup

Hoàn thành backup 4 servers

📊 Tổng quan: 3/4 servers thành công (75.0%)
⏱️ Tổng thời gian: 45.2s

✅ Thành công:
✅ web-01
✅ web-02
✅ api-01

❌ Thất bại:
❌ db-01
```

### Test Notifications

```bash
# Test webhook
curl -X POST http://localhost:3000/notifications/test-discord

# Test success notification (Local method)
curl -X POST http://localhost:3000/notifications/test-backup-success

# Test success notification (Direct method)
curl -X POST http://localhost:3000/notifications/test-direct-upload

# Check Discord status
curl -X GET http://localhost:3000/notifications/discord-status
```

**📚 Chi tiết**: [TESTING_DISCORD.md](TESTING_DISCORD.md)

---

## 🔌 API Reference

### Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://your-domain.com`

### Swagger UI

**URL**: http://localhost:3000/api

Interactive API documentation với:

- ✅ Try it out functionality
- ✅ Schema definitions
- ✅ Example requests/responses
- ✅ Authentication (future)

### Endpoints

#### 1. **POST /backup/execute**

Backup single server.

**Request Body**:

```json
{
  "serverName": "string",
  "sshConfig": {
    "host": "string",
    "port": 22,
    "username": "string",
    "password": "string (optional)",
    "privateKey": "string (optional)"
  },
  "remoteDirectory": "string",
  "targetFolder": "string",
  "compressionType": "zip | tar.gz",
  "localBackupPath": "string (optional)",
  "googleDrive": {
    "enabled": boolean,
    "uploadMethod": "direct | local (optional)",
    "folderId": "string (optional)",
    "credentialsPath": "string (optional)"
  }
}
```

**Response**:

```json
{
  "success": true,
  "serverName": "string",
  "localFilePath": "string",
  "googleDriveFileId": "string (optional)",
  "fileSize": 125.43,
  "steps": {
    "sshConnection": true,
    "directoryCheck": true,
    "compression": true,
    "download": true,
    "googleDriveUpload": true
  }
}
```

#### 2. **POST /backup/bulk-execute**

Backup multiple servers in parallel.

**Request Body**:

```json
{
  "servers": [
    {
      "serverName": "string",
      "sshConfig": {...},
      "remoteDirectory": "string",
      "targetFolder": "string",
      "compressionType": "zip | tar.gz",
      "googleDrive": {...}
    },
    ...
  ]
}
```

**Response**:

```json
{
  "totalServers": 4,
  "successCount": 3,
  "failureCount": 1,
  "totalTime": "45.2s",
  "results": [
    {
      "success": true,
      "serverName": "web-01",
      "localFilePath": "...",
      "fileSize": 125.43,
      "duration": "42.1s"
    },
    ...
  ]
}
```

#### 3. **POST /backup/test-connection**

Test SSH connection trước khi backup.

**Request Body**:

```json
{
  "serverName": "string",
  "sshConfig": {...},
  "remoteDirectory": "string",
  "targetFolder": "string"
}
```

**Response**:

```json
{
  "success": true,
  "message": "SSH connection successful",
  "serverName": "web-01",
  "checks": {
    "connection": true,
    "directoryExists": true,
    "folderExists": true,
    "compressionToolsAvailable": true
  }
}
```

#### 4. **GET /notifications/discord-status**

Check Discord configuration status.

**Response**:

```json
{
  "enabled": true,
  "configured": true,
  "method": "bot | webhook | none",
  "details": {
    "botToken": "Configured ✓",
    "channelId": "Configured ✓",
    "webhookUrl": "Configured ✓"
  }
}
```

#### 5. **POST /notifications/test-backup-success**

Test Discord success notification.

**Response**:

```json
{
  "success": true,
  "message": "Test notification sent to Discord"
}
```

---

## 📁 Project Structure

```
auto_backup_thomi/
├── src/
│   ├── modules/
│   │   ├── backup/                    # Core backup module
│   │   │   ├── backup.module.ts
│   │   │   ├── controllers/
│   │   │   │   └── backup.controller.ts
│   │   │   ├── services/
│   │   │   │   ├── backup.service.ts         # Main orchestrator
│   │   │   │   ├── compression.service.ts
│   │   │   │   └── file-transfer.service.ts
│   │   │   └── dto/
│   │   │       └── backup.dto.ts
│   │   ├── google-drive/              # Google Drive module
│   │   │   ├── google-drive.module.ts
│   │   │   ├── services/
│   │   │   │   └── google-drive.service.ts
│   │   │   └── dto/
│   │   ├── notifications/             # Discord notifications
│   │   │   ├── notifications.module.ts
│   │   │   ├── controllers/
│   │   │   │   └── notifications.controller.ts
│   │   │   ├── services/
│   │   │   │   └── discord.service.ts
│   │   │   └── dto/
│   │   └── shared/                    # Shared services
│   │       ├── shared.module.ts
│   │       ├── interfaces/
│   │       │   ├── ssh-config.interface.ts
│   │       │   └── transfer-options.interface.ts
│   │       └── services/
│   │           ├── ssh-command.service.ts
│   │           ├── sftp-client.service.ts
│   │           ├── direct-upload.service.ts      ✨ NEW
│   │           ├── hybrid-upload.service.ts      ✨ NEW
│   │           └── large-file-upload.service.ts  ✨ NEW
│   ├── config/
│   │   ├── configuration.ts           # Environment config
│   │   └── backup.config.ts           # Type definitions
│   ├── app.module.ts
│   └── main.ts
├── credentials/                       # Google Drive credentials (gitignored)
│   ├── credentials.json               # Service Account
│   └── token.json                     # OAuth2 token (if using)
├── memory-bank/                       # Project documentation
│   ├── projectbrief.md
│   ├── productContext.md
│   ├── systemPatterns.md
│   ├── techContext.md
│   ├── activeContext.md
│   └── progress.md
├── .env                               # Environment variables (gitignored)
├── env.example                        # Environment template
├── README.md                          # This file
├── BACKUP_LOGIC_FLOW.md              # Backup logic detailed
├── UPLOAD_METHODS_GUIDE.md           # Upload methods guide
├── LARGE_FILE_OPTIMIZATION.md        # Large file optimization ✨ NEW
├── DISCORD_NOTIFICATION_UPDATE.md    # Discord features
├── GOOGLE_DRIVE_OAUTH2_SETUP.md      # Google Drive setup
├── ENV_VARIABLES_GUIDE.md            # Env vars guide
├── TESTING_DISCORD.md                # Discord testing
├── FIXES_AND_DIAGNOSTICS.md          # Troubleshooting
├── package.json
└── tsconfig.json
```

---

## ⚡ Performance Tips

### 1. Network Optimization

**SFTP Concurrency** (adjust based on network):

```bash
# Slow network (< 100Mbps)
SFTP_CONCURRENCY=32

# Medium network (100-500Mbps)
SFTP_CONCURRENCY=64  # Default

# Fast network (1Gbps+)
SFTP_CONCURRENCY=128
```

**Test**: Chạy backup và monitor network usage với `iftop` hoặc Task Manager.

### 2. Compression Selection

| Type       | Speed       | Size       | Use Case                           |
| ---------- | ----------- | ---------- | ---------------------------------- |
| **zip**    | ⚡⚡⚡ Fast | 📦 Medium  | Windows-friendly, general purpose  |
| **tar.gz** | ⚡⚡ Slower | 📦 Smaller | Linux standard, better compression |

**Recommendation**:

- Text files / code: `tar.gz` (better compression)
- Binary files / images: `zip` (faster, similar size)

### 3. Upload Method Selection

| File Size   | Recommended Method             | Reason               |
| ----------- | ------------------------------ | -------------------- |
| < 1GB       | `local` hoặc `streaming`       | Fast, reliable       |
| 1-10GB      | `direct` (streaming fallback)  | Balance speed/memory |
| **10-50GB** | **`direct` (Rclone priority)** | No local storage     |
| **> 50GB**  | **`direct` (Rclone ONLY)**     | Memory efficient ✨  |

### 4. Multi-Server Strategy

**Sequential** (cho server quan trọng):

```json
{
  "servers": [
    { "serverName": "database-prod", ... },  // Chạy trước
    { "serverName": "database-backup", ... } // Chạy sau
  ]
}
```

**Parallel** (cho server độc lập):

```json
{
  "servers": [
    { "serverName": "web-01", ... },  // Cùng lúc
    { "serverName": "web-02", ... },  // Cùng lúc
    { "serverName": "api-01", ... }   // Cùng lúc
  ]
}
```

### 5. Disk Space Management

**Local Backup Path**:

```bash
# Check free space
df -h H:/Backup  # Windows
df -h /backups   # Linux

# Clean old backups (manual)
rm -rf H:/Backup/server-name/2025_09_*
```

**Remote Server**:

```bash
# Check space before backup
ssh user@server "df -h /var/www"

# Auto cleanup enabled (file tạm tự động xóa sau backup)
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. SSH Connection Failed

**Error**: `SSH connection timeout`

**Solutions**:

```bash
# Check network
ping 192.168.1.100

# Check SSH port
telnet 192.168.1.100 22

# Test SSH manually
ssh user@192.168.1.100

# Check firewall
sudo ufw status  # Ubuntu
```

#### 2. Compression Tool Not Found

**Error**: `zip not installed on remote server`

**Solution**:

```bash
# Ubuntu/Debian
ssh user@server "sudo apt-get update && sudo apt-get install -y zip gzip tar"

# CentOS/RHEL
ssh user@server "sudo yum install -y zip gzip tar"
```

#### 3. Google Drive Upload Failed

**Error**: `Upload failed: Invalid credentials`

**Solutions**:

1. Check `credentials/credentials.json` exists
2. Verify service account email has access to folder
3. Check folder ID is correct
4. Test with `/notifications/discord-status`

#### 4. Discord Notification Not Sent

**Error**: `Discord notification failed`

**Solutions**:

```bash
# Test Discord status
curl http://localhost:3000/notifications/discord-status

# Test notification
curl -X POST http://localhost:3000/notifications/test-discord

# Check .env config
DISCORD_ENABLED=true
DISCORD_WEBHOOK_URL=https://...  # Valid URL?
```

#### 5. Large File Memory Issue

**Error**: `Out of memory` or system freeze

**Solution**:

```json
{
  "googleDrive": {
    "enabled": true,
    "uploadMethod": "direct" // ✅ MUST use direct for large files
  }
}
```

**⚠️ NEVER use `local` method for files > 10GB!**

#### 6. Slow Upload Speed

**Solutions**:

1. Use Rclone Direct (fastest)
2. Check network bandwidth
3. Increase chunk size for large files
4. Use wired connection instead of WiFi

**📚 Chi tiết**: [FIXES_AND_DIAGNOSTICS.md](FIXES_AND_DIAGNOSTICS.md)

---

## 📚 Documentation

### Complete Guides

| File                                                             | Description                            |
| ---------------------------------------------------------------- | -------------------------------------- |
| **README.md**                                                    | Main documentation (this file)         |
| [BACKUP_LOGIC_FLOW.md](BACKUP_LOGIC_FLOW.md)                     | Complete backup logic with 3-case flow |
| [UPLOAD_METHODS_GUIDE.md](UPLOAD_METHODS_GUIDE.md)               | Detailed upload methods comparison     |
| [LARGE_FILE_OPTIMIZATION.md](LARGE_FILE_OPTIMIZATION.md)         | Large file (50GB+) optimization ✨ NEW |
| [DISCORD_NOTIFICATION_UPDATE.md](DISCORD_NOTIFICATION_UPDATE.md) | Discord features & examples            |
| [GOOGLE_DRIVE_OAUTH2_SETUP.md](GOOGLE_DRIVE_OAUTH2_SETUP.md)     | OAuth2 setup guide                     |
| [ENV_VARIABLES_GUIDE.md](ENV_VARIABLES_GUIDE.md)                 | Environment variables reference        |
| [TESTING_DISCORD.md](TESTING_DISCORD.md)                         | Discord testing guide                  |
| [FIXES_AND_DIAGNOSTICS.md](FIXES_AND_DIAGNOSTICS.md)             | Troubleshooting & diagnostics          |

### Memory Bank (Detailed)

Comprehensive documentation in `memory-bank/`:

- **projectbrief.md** - Project overview
- **productContext.md** - User problems & solutions
- **systemPatterns.md** - Architecture & patterns
- **techContext.md** - Technologies & setup
- **activeContext.md** - Recent changes
- **progress.md** - Status & roadmap

---

## 🛠️ Technology Stack

- **Framework**: NestJS 10.x (Node.js)
- **Language**: TypeScript 5.x
- **SSH Commands**: ssh2 ^1.11.0
- **File Transfer**: ssh2-sftp-client ^10.0.0 (Optimized)
- **Google Drive**: googleapis ^126.0.0
- **Discord**: discord.js ^14.0.0
- **Validation**: class-validator, class-transformer
- **Documentation**: @nestjs/swagger

---

## 🚀 Development

### Scripts

```bash
# Development
yarn dev              # Start with hot reload
yarn build            # Production build
yarn start:prod       # Run production

# Testing
yarn test             # Run unit tests
yarn test:watch       # Watch mode
yarn test:cov         # Coverage report
yarn test:e2e         # E2E tests

# Linting
yarn lint             # Run ESLint
yarn format           # Format with Prettier

# Utilities
yarn generate-token   # Generate Google Drive OAuth2 token
```

### Building for Production

```bash
# Build
yarn build

# Copy credentials
cp credentials/* dist/credentials/

# Copy .env
cp .env dist/

# Start production
NODE_ENV=production yarn start:prod
```

---

## 📝 Changelog

### v2.3.0 (October 2025) - Large File Optimization ✨ **NEW**

- ✅ **Large File Optimization** cho file 50GB+
- ✅ **Auto Detection** file > 10GB
- ✅ **Dynamic Chunking** (256KB - 4MB based on file size)
- ✅ **Enhanced Rclone Integration** với optimized flags
- ✅ **Intelligent Fallback** (NO local fallback cho large files)
- ✅ **Memory Efficient** (95%+ memory reduction)
- ✅ **30-minute Timeout** cho large file uploads
- ✅ **10 Retry Attempts** với exponential backoff

### v2.2.0 (October 2025) - Direct Upload & Hybrid Approach ✨

- ✅ **True Direct Upload** với Rclone và gdrive CLI
- ✅ **Hybrid Upload Service** với 4-level fallback
- ✅ **Optimized Streaming** với enhanced performance
- ✅ **Smart Method Selection** based on file size
- ✅ **Enhanced Google Drive Service** với large file support
- ✅ **Discord Notifications Update** với upload method display

### v2.1.0 (October 2025) - Discord Notifications

- ✅ Discord webhook integration
- ✅ Auto-notify on backup success/failure
- ✅ Rich embeds với colors và details
- ✅ Bulk backup summary notifications
- ✅ Configurable via environment variables

### v2.0.0 (October 2025) - Performance Update

- ✅ Migrated to ssh2-sftp-client (30-40% faster)
- ✅ Modular architecture với feature-based modules
- ✅ Concurrent chunk downloads (64 parallel reads)
- ✅ Automatic retry logic (3 attempts)
- ✅ Real-time progress tracking
- ✅ Environment variable configuration
- ✅ Comprehensive TypeScript interfaces

### v1.0.0 (Previous)

- ✅ Basic SSH backup functionality
- ✅ Google Drive integration
- ✅ Multi-server support
- ✅ Swagger documentation

---

## 🔒 Security Notes

### Development

- ✅ OK to use without authentication (internal network)
- ✅ No HTTPS required (localhost)

### Production

- ⚠️ **MUST add API authentication** (JWT/API keys)
- ⚠️ **MUST use HTTPS**
- ⚠️ **MUST secure environment variables**
- ⚠️ **MUST restrict network access**

### Best Practices

1. **Never commit credentials** to git
2. **Use environment variables** for all secrets
3. **Rotate credentials** regularly
4. **Limit SSH key permissions**
5. **Monitor backup logs** for suspicious activity
6. **Use service accounts** instead of personal accounts

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create feature branch: `git checkout -b feature/AmazingFeature`
3. Commit changes: `git commit -m 'Add AmazingFeature'`
4. Push to branch: `git push origin feature/AmazingFeature`
5. Open Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Follow NestJS conventions
- Write unit tests for new features
- Update documentation
- Use conventional commits

---

## 📄 License

UNLICENSED

---

## 💬 Support

### Need Help?

1. **Documentation**: Read guides in `memory-bank/` and documentation files
2. **API Docs**: Check Swagger UI at http://localhost:3000/api
3. **Troubleshooting**: See [FIXES_AND_DIAGNOSTICS.md](FIXES_AND_DIAGNOSTICS.md)
4. **Issues**: Open GitHub issue with details

### Quick Links

- 🌟 **Swagger UI**: http://localhost:3000/api
- 📚 **Documentation**: [memory-bank/](memory-bank/)
- 🐛 **Troubleshooting**: [FIXES_AND_DIAGNOSTICS.md](FIXES_AND_DIAGNOSTICS.md)
- 💬 **Discord Setup**: [TESTING_DISCORD.md](TESTING_DISCORD.md)

---

**Made with ❤️ using NestJS**

**⚡ Performance**: 30-40% faster downloads | 50% bandwidth savings for large files

**🚀 Optimized for**: Large files (50GB+) | Multi-server | Production workloads

**Last Updated**: October 21, 2025 | Version 2.3.0
