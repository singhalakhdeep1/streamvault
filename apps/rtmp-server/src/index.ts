export interface RtmpStreamSession {
  streamKey: string;
  publisherId: string;
  startedAt: number;
}

export class RtmpServerGateway {
  private activeStreams: Map<string, RtmpStreamSession> = new Map();

  startStream(streamKey: string, publisherId: string): boolean {
    if (this.activeStreams.has(streamKey)) {
      console.warn(`Stream key ${streamKey} is already broadcasting.`);
      return false;
    }
    this.activeStreams.set(streamKey, {
      streamKey,
      publisherId,
      startedAt: Date.now(),
    });
    console.log(`[RTMP] Stream ${streamKey} started by publisher ${publisherId}`);
    return true;
  }

  stopStream(streamKey: string): boolean {
    const deleted = this.activeStreams.delete(streamKey);
    if (deleted) {
      console.log(`[RTMP] Stream ${streamKey} stopped.`);
    }
    return deleted;
  }

  getActiveStreamsCount(): number {
    return this.activeStreams.size;
  }
}
