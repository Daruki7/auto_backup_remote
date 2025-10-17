# 🔄 Automated Server Backup System

Hệ thống tự động hóa quy trình backup từ server qua SSH, nén file, download về local và upload lên Google Drive.

## ✨ Tính năng chính

- 🔌 **SSH Connection**: Kết nối SSH với password hoặc private key
- 📦 **Auto Compression**: Nén folder thành ZIP hoặc TAR.GZ
- 💾 **Auto Download**: Download về local PC với auto-rename
- ☁️ **Google Drive Integration**: Upload lên Google Drive (optional)
- 🚀 **Multi-Server Backup**: Backup nhiều server cùng lúc từ JSON file
- 📁 **Smart Organization**: Mỗi server có folder riêng `H:/Backup/{serverName}/`
- 📝 **Swagger UI**: Test API dễ dàng qua browser
- 🧹 **Auto Cleanup**: Tự động xóa file tạm trên server

## 🚀 Quick Start

```bash
# 1. Cài đặt dependencies
yarn install

# 2. Chạy server
yarn start:dev

# 3. Mở Swagger UI
# http://localhost:3000/api
```

## 📖 Documentation

- 📘 **[Quick Start Guide](QUICKSTART.md)** - Bắt đầu nhanh trong 5 phút
- 📗 **[Complete Guide](README_BACKUP.md)** - Hướng dẫn đầy đủ
- 📙 **[Multi-Server Backup](MULTI_SERVER_BACKUP.md)** - Backup nhiều server
- � **[Ubuntu Requirements](UBUNTU_REQUIREMENTS.md)** - Yêu cầu cho Ubuntu Server
- �📕 **[Google Drive Setup](GOOGLE_DRIVE_SETUP.md)** - Cấu hình Google Drive
- 📔 **[Changelog](CHANGELOG.md)** - Lịch sử phát triển

## 🎯 API Endpoints

| Endpoint                  | Method | Description              |
| ------------------------- | ------ | ------------------------ |
| `/api`                    | GET    | Swagger UI Documentation |
| `/backup/execute`         | POST   | Backup single server     |
| `/backup/bulk-execute`    | POST   | Backup multiple servers  |
| `/backup/test-connection` | POST   | Test SSH connection      |

**🌟 Swagger UI**: http://localhost:3000/api

## 📋 Example Usage

### Single Server Backup

```bash
curl -X POST http://localhost:3000/backup/execute \
  -H "Content-Type: application/json" \
  -d '{
    "serverName": "production-web",
    "sshConfig": {
      "host": "192.168.1.100",
      "username": "root",
      "password": "your-password"
    },
    "remoteDirectory": "/var/www/html",
    "targetFolder": "uploads"
  }'
```

### Multi-Server Backup

```bash
curl -X POST http://localhost:3000/backup/bulk-execute \
  -H "Content-Type: application/json" \
  -d @examples/bulk-backup-multiple-servers.json
```

## 📁 Project Structure

```
auto_backup_thomi/
├── src/
│   ├── services/          # Business logic
│   ├── controllers/       # API endpoints
│   ├── dto/              # Data validation
│   └── config/           # Configuration
├── examples/             # JSON examples
├── credentials/          # Google Drive credentials (gitignored)
├── QUICKSTART.md         # Quick start guide
├── README_BACKUP.md      # Complete documentation
└── MULTI_SERVER_BACKUP.md # Multi-server guide
```

## 🛠️ Technology Stack

- **Framework**: NestJS (Node.js)
- **Language**: TypeScript
- **SSH**: ssh2
- **Google Drive**: googleapis
- **Validation**: class-validator
- **Documentation**: Swagger/OpenAPI

## 📦 Installation

```bash
# Development
yarn install
yarn start:dev

# Production
yarn build
yarn start:prod
```

## 🔧 Configuration

1. Copy `.env.example` to `.env`
2. (Optional) Setup Google Drive credentials
3. Run the application

## 🎨 Features

### Server-Specific Folders

```
H:/Backup/
├── web-server-01/
│   ├── web-server-01_20251005_143022.zip
│   └── web-server-01_20251005_153045.zip
├── web-server-02/
│   └── web-server-02_20251005_143030.zip
└── database-server/
    └── database-server_20251005_143045.tar.gz
```

### Bulk Backup Result

```json
{
  "totalServers": 3,
  "successCount": 2,
  "failureCount": 1,
  "results": [...]
}
```

## 📚 Learn More

- [NestJS Documentation](https://docs.nestjs.com)
- [SSH2 Documentation](https://github.com/mscdex/ssh2)
- [Google Drive API](https://developers.google.com/drive)

## 🤝 Contributing

Contributions are welcome! Please check the issues or create a new one.

## 📄 License

UNLICENSED

---

**Made with ❤️ using NestJS**
