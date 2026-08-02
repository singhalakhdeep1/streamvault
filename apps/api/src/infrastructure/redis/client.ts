// Redis client for streamvault

import { createClient } from 'redis';

class RedisService {
  private client: any;

  constructor(url: string) {
    this.client = createClient({ url });
  }

  async connect() {
    await this.client.connect();
  }

  async disconnect() {
    await this.client.disconnect();
  }

  async set(key: string, value: string, expiry?: number) {
    if (expiry) {
      await this.client.setEx(key, expiry, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string) {
    return await this.client.get(key);
  }

  async del(key: string) {
    return await this.client.del(key);
  }

  async exists(key: string) {
    return await this.client.exists(key);
  }

  async expire(key: string, seconds: number) {
    return await this.client.expire(key, seconds);
  }

  async hset(key: string, field: string, value: string) {
    await this.client.hSet(key, field, value);
  }

  async hget(key: string, field: string) {
    return await this.client.hGet(key, field);
  }

  async hgetAll(key: string) {
    return await this.client.hGetAll(key);
  }

  async hdel(key: string, field: string) {
    await this.client.hDel(key, field);
  }

  async lpush(key: string, ...values: string[]) {
    await this.client.lPush(key, values);
  }

  async lrange(key: string, start: number, stop: number) {
    return await this.client.lRange(key, start, stop);
  }

  async lpop(key: string) {
    return await this.client.lPop(key);
  }

  async sadd(key: string, ...members: string[]) {
    await this.client.sAdd(key, members);
  }

  async smembers(key: string) {
    return await this.client.sMembers(key);
  }

  async srem(key: string, ...members: string[]) {
    await this.client.sRem(key, members);
  }

  async zadd(key: string, score: number, member: string) {
    await this.client.zAdd(key, { score, value: member });
  }

  async zrange(key: string, start: number, stop: number) {
    return await this.client.zRange(key, start, stop);
  }

  async zrem(key: string, ...members: string[]) {
    await this.client.zRem(key, members);
  }

  async cacheStream(streamId: string, streamData: any, expiry = 3600) {
    await this.set(`stream:${streamId}`, JSON.stringify(streamData), expiry);
  }

  async getCachedStream(streamId: string) {
    const data = await this.get(`stream:${streamId}`);
    return data ? JSON.parse(data) : null;
  }

  async incrementViewerCount(streamId: string) {
    const key = `stream:${streamId}:viewers`;
    const count = await this.client.incr(key);
    await this.client.expire(key, 3600);
    return count;
  }

  async getViewerCount(streamId: string) {
    const count = await this.get(`stream:${streamId}:viewers`);
    return count ? parseInt(count) : 0;
  }

  async addToActiveStreams(streamId: string) {
    await this.sadd('active_streams', streamId);
  }

  async removeFromActiveStreams(streamId: string) {
    await this.srem('active_streams', streamId);
  }

  async getActiveStreams() {
    return await this.smembers('active_streams');
  }

  async cacheVideoMetadata(videoId: string, metadata: any, expiry = 86400) {
    await this.set(`video:${videoId}:metadata`, JSON.stringify(metadata), expiry);
  }

  async getCachedVideoMetadata(videoId: string) {
    const data = await this.get(`video:${videoId}:metadata`);
    return data ? JSON.parse(data) : null;
  }

  async addToProcessingQueue(jobId: string, jobData: any) {
    await this.lpush('processing_queue', jobData);
  }

  async getNextProcessingJob() {
    return await this.rpop('processing_queue');
  }

  async setProcessingStatus(jobId: string, status: string) {
    await this.hset(`job:${jobId}`, 'status', status);
  }

  async getProcessingStatus(jobId: string) {
    return await this.hget(`job:${jobId}`, 'status');
  }
}

export default RedisService;
