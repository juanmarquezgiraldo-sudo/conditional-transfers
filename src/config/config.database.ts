import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { User } from '../entities/user.entity';
import { ConditionalTransfer } from 'src/entities/conditional-transfer.entity';

config();

const configService = new ConfigService();

export default new DataSource({
  type: 'postgres',
  host: configService.get('DATABASE_HOST') || 'localhost',
  port: parseInt(configService.get('DATABASE_PORT')) || 5432,
  username: configService.get('DATABASE_USERNAME') || 'postgres',
  password: configService.get('DATABASE_PASSWORD') || 'postgres',
  database: configService.get('DATABASE_NAME') || 'database',
  entities: [User, ConditionalTransfer],
  migrations: ['src/migrations/*{.ts,.js}'],
  synchronize: true, // Set to false when using migrations
  logging: configService.get('NODE_ENV') === 'development',
});