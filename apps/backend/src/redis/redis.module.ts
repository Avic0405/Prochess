import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

function buildClient(configService: ConfigService): Redis {
  const log = new Logger('Redis');
  const url = configService.get<string>('redis.url');

  const sharedOptions: RedisOptions = {
    maxRetriesPerRequest: 3,
    connectTimeout: 10_000,
    enableOfflineQueue: true,
    retryStrategy: (times: number) =>
      times > 10 ? null : Math.min(times * 200, 2_000),
  };

  let client: Redis;

  if (url) {
    client = new Redis(url, sharedOptions);
  } else {
    client = new Redis({
      host: configService.get<string>('redis.host', 'localhost'),
      port: configService.get<number>('redis.port', 6379),
      password: configService.get<string>('redis.password'),
      ...sharedOptions,
    });
  }

  client.on('connect',      () => log.log('✓ Connected'));
  client.on('ready',        () => log.log('✓ Ready'));
  client.on('error',        (err: Error) => log.error(`Error: ${err.message}`));
  client.on('close',        () => log.warn('Connection closed'));
  client.on('reconnecting', () => log.warn('Reconnecting…'));

  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => buildClient(cfg),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
