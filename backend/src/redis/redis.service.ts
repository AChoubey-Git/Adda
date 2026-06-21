import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get('REDIS_URL');

    const options: any = {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    };

    if (!redisUrl) {
      options.host = this.configService.get('REDIS_HOST', 'localhost');
      options.port = this.configService.get<number>('REDIS_PORT', 6379);
      options.password = this.configService.get('REDIS_PASSWORD') || undefined;
      // If host contains upstash, it requires TLS
      if (options.host.includes('upstash.io')) {
        options.tls = {};
      }
    }

    this.client = redisUrl ? new Redis(redisUrl, options) : new Redis(options);
    this.subscriber = redisUrl ? new Redis(redisUrl, options) : new Redis(options);
    this.publisher = redisUrl ? new Redis(redisUrl, options) : new Redis(options);

    this.client.on('error', (err) => this.logger.error('Redis client error', err));
    this.subscriber.on('error', (err) => this.logger.error('Redis subscriber error', err));
  }

  onModuleDestroy() {
    this.client.disconnect();
    this.subscriber.disconnect();
    this.publisher.disconnect();
  }

  // ─── Presence ──────────────────────────────────────────────────────

  async setUserOnline(userId: string, socketId: string): Promise<void> {
    await this.client.setex(`presence:${userId}`, 300, JSON.stringify({ socketId, online: true, timestamp: Date.now() }));
  }

  async setUserOffline(userId: string): Promise<void> {
    await this.client.del(`presence:${userId}`);
    await this.client.set(`lastSeen:${userId}`, Date.now().toString());
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const val = await this.client.get(`presence:${userId}`);
    return !!val;
  }

  async getUserPresence(userId: string): Promise<any> {
    const val = await this.client.get(`presence:${userId}`);
    return val ? JSON.parse(val) : null;
  }

  // ─── Pub/Sub for scaling ────────────────────────────────────────────

  async publish(channel: string, message: any): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        callback(JSON.parse(msg));
      }
    });
  }

  // ─── Cache ──────────────────────────────────────────────────────────

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const val = await this.client.get(key);
    return val ? JSON.parse(val) : null;
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  // ─── Rate limiting ──────────────────────────────────────────────────

  async incrementCounter(key: string, windowSeconds: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) await this.client.expire(key, windowSeconds);
    return count;
  }

  // ─── Typing indicators ──────────────────────────────────────────────

  async setTyping(conversationId: string, userId: string): Promise<void> {
    await this.client.setex(`typing:${conversationId}:${userId}`, 5, '1');
  }

  // Bug #8 fix: KEYS is O(N) and blocks Redis; SCAN iterates in non-blocking batches
  async getTypingUsers(conversationId: string): Promise<string[]> {
    const pattern = `typing:${conversationId}:*`;
    const result: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor, 'MATCH', pattern, 'COUNT', 100,
      );
      cursor = nextCursor;
      keys.forEach((k) => result.push(k.split(':').pop()));
    } while (cursor !== '0');
    return result;
  }
}
