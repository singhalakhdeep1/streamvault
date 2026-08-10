import { describe, it, expect } from 'vitest';
import { RtmpServerGateway } from '../apps/rtmp-server/src';

describe('StreamVault RTMP & Transcoding Engine', () => {
  it('should accept new RTMP publisher sessions', () => {
    const gateway = new RtmpServerGateway();
    const started = gateway.startStream('live_stream_101', 'user_pub_99');
    expect(started).toBe(true);
    expect(gateway.getActiveStreamsCount()).toBe(1);
  });

  it('should prevent duplicate streaming on the same stream key', () => {
    const gateway = new RtmpServerGateway();
    gateway.startStream('live_stream_101', 'user_pub_99');
    const duplicate = gateway.startStream('live_stream_101', 'user_pub_99');
    expect(duplicate).toBe(false);
  });
});
