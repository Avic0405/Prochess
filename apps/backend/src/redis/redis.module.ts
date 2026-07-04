import { Global, Module } from '@nestjs/common';

export const REDIS_CLIENT = 'REDIS_CLIENT';

// In-memory Redis mock — covers every Redis operation used in this codebase.
// No Docker / Redis server required for local development.
//
// TO SWITCH BACK TO REAL REDIS:
//   1. Start Docker Desktop and run: docker compose up -d
//   2. Replace this entire file with the version that uses ioredis (see comment below)
//
// Real Redis version (drop-in replacement for this file):
//   import Redis from 'ioredis';
//   providers: [{ provide: REDIS_CLIENT, inject: [ConfigService],
//     useFactory: (cfg) => new Redis({ host: cfg.get('redis.host'), port: cfg.get('redis.port'), password: cfg.get('redis.password') }) }]

class InMemoryRedis {
  private store = new Map<string, string>();
  private sortedSets = new Map<string, Map<string, number>>();
  private sets = new Map<string, Set<string>>();
  private expiries = new Map<string, ReturnType<typeof setTimeout>>();

  async set(key: string, value: string, ...args: any[]): Promise<string> {
    this.store.set(key, value);
    const exIdx = args.findIndex((a) => a === 'EX' || a === 'ex');
    if (exIdx !== -1 && args[exIdx + 1]) {
      this._expireKey(key, Number(args[exIdx + 1]) * 1000);
    }
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
      this._clearExpiry(key);
    }
    return count;
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    this.store.set(key, value);
    this._expireKey(key, seconds * 1000);
    return 'OK';
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.sortedSets.has(key)) this.sortedSets.set(key, new Map());
    const isNew = !this.sortedSets.get(key)!.has(member);
    this.sortedSets.get(key)!.set(member, score);
    return isNew ? 1 : 0;
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    const set = this.sortedSets.get(key);
    if (!set) return [];
    const sorted = [...set.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);
    return stop === -1 ? sorted.slice(start) : sorted.slice(start, stop + 1);
  }

  async zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]> {
    const set = this.sortedSets.get(key);
    if (!set) return [];
    const lo = min === '-inf' ? -Infinity : Number(min);
    const hi = max === '+inf' ? Infinity : Number(max);
    return [...set.entries()]
      .filter(([, s]) => s >= lo && s <= hi)
      .sort((a, b) => a[1] - b[1])
      .map(([k]) => k);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    const set = this.sortedSets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const m of members) if (set.delete(m)) removed++;
    return removed;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    let added = 0;
    for (const m of members) {
      if (!this.sets.get(key)!.has(m)) { this.sets.get(key)!.add(m); added++; }
    }
    return added;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const m of members) if (set.delete(m)) removed++;
    return removed;
  }

  async ping(): Promise<string> { return 'PONG'; }

  on(_event: string, _handler: any): this { return this; }

  private _expireKey(key: string, ms: number) {
    this._clearExpiry(key);
    this.expiries.set(key, setTimeout(() => { this.store.delete(key); this.expiries.delete(key); }, ms));
  }

  private _clearExpiry(key: string) {
    const t = this.expiries.get(key);
    if (t) { clearTimeout(t); this.expiries.delete(key); }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useValue: new InMemoryRedis(),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
