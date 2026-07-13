/**
 * RTMP Live Streaming Server
 * Uses Node-Media-Server for RTMP ingest and HTTP-FLV playback
 */

const NodeMediaServer = require('node-media-server');
const Redis = require('ioredis');
const axios = require('axios');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const API_URL = process.env.API_URL || 'http://localhost:8000';

const config = {
  rtmp: {
    port: process.env.RTMP_PORT || 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: process.env.HTTP_PORT || 8888,
    allow_origin: '*',
    mediaroot: './media'
  },
  https: {
    port: process.env.HTTPS_PORT || 8443,
    mediaroot: './media',
    key: './ssl/private.key',
    cert: './ssl/certificate.crt'
  },
  trans: {
    ffmpeg: '/usr/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        dash: true,
        dashFlags: '[f=dash:window_size=3:extra_window_size=5]',
        audio: true,
        audioCodec: 'aac',
        video: true,
        videoCodec: 'libx264',
        videoBitrate: 1024,
        videoFramerate: 30,
        videoResolution: '1280x720'
      }
    ]
  }
};

const nms = new NodeMediaServer(config);

nms.on('prePublish', async (id, StreamPath, args) => {
  console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  
  // Extract stream key from path
  const streamKey = StreamPath.split('/').pop();
  
  try {
    // Validate stream key with API
    const response = await axios.post(`${API_URL}/live/validate`, {
      stream_key: streamKey
    });
    
    if (!response.data.valid) {
      console.log('Invalid stream key, rejecting connection');
      const session = nms.getSession(id);
      session.reject();
    } else {
      console.log('Stream validated successfully');
      
      // Notify API that stream is starting
      await axios.post(`${API_URL}/live/start`, {
        stream_key: streamKey,
        stream_path: StreamPath
      });
    }
  } catch (error) {
    console.error('Error validating stream:', error.message);
    const session = nms.getSession(id);
    session.reject();
  }
});

nms.on('postPublish', async (id, StreamPath, args) => {
  console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  
  const streamKey = StreamPath.split('/').pop();
  
  // Store stream info in Redis
  await redis.hset('streams', streamKey, JSON.stringify({
    stream_path: StreamPath,
    started_at: new Date().toISOString(),
    status: 'live'
  }));
  
  // Publish stream start event
  await redis.publish('stream_events', JSON.stringify({
    event: 'stream_started',
    stream_key: streamKey,
    stream_path: StreamPath,
    timestamp: new Date().toISOString()
  }));
});

nms.on('done', async (id, StreamPath, args) => {
  console.log('[NodeEvent on done]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  
  const streamKey = StreamPath.split('/').pop();
  
  // Update stream status in Redis
  await redis.hset('streams', streamKey, JSON.stringify({
    stream_path: StreamPath,
    ended_at: new Date().toISOString(),
    status: 'ended'
  }));
  
  // Notify API that stream has ended
  try {
    await axios.post(`${API_URL}/live/end`, {
      stream_key: streamKey,
      stream_path: StreamPath
    });
  } catch (error) {
    console.error('Error notifying API of stream end:', error.message);
  }
  
  // Publish stream end event
  await redis.publish('stream_events', JSON.stringify({
    event: 'stream_ended',
    stream_key: streamKey,
    stream_path: StreamPath,
    timestamp: new Date().toISOString()
  }));
});

nms.on('prePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  
  // Increment viewer count in Redis
  const streamKey = StreamPath.split('/').pop();
  redis.incr(`viewers:${streamKey}`);
});

nms.on('donePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  
  // Decrement viewer count in Redis
  const streamKey = StreamPath.split('/').pop();
  redis.decr(`viewers:${streamKey}`);
});

// Health check endpoint
nms.run();

const express = require('express');
const healthApp = express();

healthApp.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'rtmp-server',
    timestamp: new Date().toISOString()
  });
});

healthApp.get('/streams', async (req, res) => {
  try {
    const streams = await redis.hgetall('streams');
    const streamArray = Object.values(streams).map(JSON.parse);
    res.json({ streams: streamArray });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

healthApp.get('/viewers/:streamKey', async (req, res) => {
  try {
    const count = await redis.get(`viewers:${req.params.streamKey}`);
    res.json({ stream_key: req.params.streamKey, viewer_count: parseInt(count) || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

healthApp.listen(3000, () => {
  console.log('Health check server running on port 3000');
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  nms.stop();
  process.exit(0);
});

module.exports = nms;
