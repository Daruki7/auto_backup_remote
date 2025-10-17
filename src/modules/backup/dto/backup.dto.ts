import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SshConfigDto {
  @ApiProperty({
    description: 'SSH server hostname or IP address',
    example: '192.168.1.100',
  })
  @IsString()
  host: string;

  @ApiPropertyOptional({
    description: 'SSH port',
    example: 22,
    default: 22,
  })
  @IsNumber()
  @IsOptional()
  port?: number = 22;

  @ApiProperty({
    description: 'SSH username',
    example: 'root',
  })
  @IsString()
  username: string;

  @ApiPropertyOptional({
    description: 'SSH password (if not using private key)',
    example: 'your-password',
  })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({
    description: 'Path to SSH private key file',
    example: 'C:/Users/YourName/.ssh/id_rsa',
  })
  @IsString()
  @IsOptional()
  privateKey?: string;
}

export class GoogleDriveConfigDto {
  @ApiPropertyOptional({
    description: 'Enable Google Drive upload',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean = false;

  @ApiPropertyOptional({
    description: 'Google Drive folder ID',
    example: '1abc...xyz',
  })
  @IsString()
  @IsOptional()
  folderId?: string;

  @ApiPropertyOptional({
    description: 'Path to Google Drive credentials JSON file',
    example: 'credentials/google-drive.json',
  })
  @IsString()
  @IsOptional()
  credentialsPath?: string;
}

export class CreateBackupDto {
  @ApiProperty({
    description: 'Server name (used for file naming)',
    example: 'production-server',
  })
  @IsString()
  serverName: string;

  @ApiProperty({
    description: 'SSH configuration',
    type: SshConfigDto,
  })
  @ValidateNested()
  @Type(() => SshConfigDto)
  sshConfig: SshConfigDto;

  @ApiProperty({
    description: 'Remote directory path on server',
    example: '/var/www/html',
  })
  @IsString()
  remoteDirectory: string;

  @ApiPropertyOptional({
    description: 'Target folder to backup',
    example: 'uploads',
    default: 'uploads',
  })
  @IsString()
  @IsOptional()
  targetFolder?: string = 'uploads';

  @ApiPropertyOptional({
    description: 'Compression type',
    enum: ['zip', 'tar.gz'],
    example: 'zip',
    default: 'zip',
  })
  @IsEnum(['zip', 'tar.gz'])
  @IsOptional()
  compressionType?: 'zip' | 'tar.gz' = 'zip';

  @ApiPropertyOptional({
    description: 'Local backup path (base directory)',
    example: 'H:/Backup',
    default: 'H:/Backup',
  })
  @IsString()
  @IsOptional()
  localBackupPath?: string = 'H:/Backup';

  @ApiPropertyOptional({
    description: 'Google Drive configuration',
    type: GoogleDriveConfigDto,
  })
  @ValidateNested()
  @Type(() => GoogleDriveConfigDto)
  @IsOptional()
  googleDrive?: GoogleDriveConfigDto;
}

export class BulkBackupDto {
  @ApiProperty({
    description: 'Array of server backup configurations',
    type: [CreateBackupDto],
    example: [
      {
        serverName: 'server-1',
        sshConfig: {
          host: '192.168.1.100',
          username: 'root',
          password: 'password',
        },
        remoteDirectory: '/var/www/html',
        targetFolder: 'uploads',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBackupDto)
  servers: CreateBackupDto[];
}
