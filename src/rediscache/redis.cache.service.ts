// redis.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  onModuleInit() {
    this.client = new Redis(process.env.REDIS_URL);
    this.client.on('connect', () => console.log('Redis connected'));
    this.client.on('error', err =>
      console.error('Redis connection error:', err)
    );
  }

  onModuleDestroy() {
    this.client.disconnect();
  }

  async set(key: string, value: any, ttlSeconds = 3600): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async get<T = any>(key: string): Promise<T | null> {
    const val = await this.client.get(key);
    return val ? JSON.parse(val) : null;
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds = 3600,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached) {
      return cached;
    }

    const freshValue = await fetchFn();
    await this.set(key, freshValue, ttlSeconds);
    return freshValue;
  }
}
