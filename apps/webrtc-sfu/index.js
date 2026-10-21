/**
 * WebRTC SFU (Selective Forwarding Unit)
 * Uses mediasoup for real-time video calls and conferencing
 */

const mediasoup = require('mediasoup');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const API_URL = process.env.API_URL || 'http://localhost:8000';
const MEDIASOUP_PORT = process.env.MEDIASOUP_PORT || 4000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let worker;
let router;
let peers = {};  // Map of peerId to peer objects
let rooms = {};   // Map of roomId to room objects

// Initialize mediasoup worker
async function initializeMediasoup() {
  worker = await mediasoup.createWorker({
    logLevel: 'debug',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp']
  });

  worker.on('died', () => {
    console.error('Mediasoup worker died, exiting...');
    process.exit(1);
  });

  // Create router
  router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000
        }
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': '1'
        }
      }
    ]
  });

  console.log('Mediasoup initialized successfully');
}

// WebSocket connection handling
wss.on('connection', async (ws, req) => {
  const peerId = req.url.split('/').pop();
  console.log(`WebSocket connection from peer: ${peerId}`);

  peers[peerId] = {
    ws,
    transports: {},
    producers: {},
    consumers: {},
    roomId: null
  };

  ws.on('message', async (message) => {
    const data = JSON.parse(message);
    await handlePeerMessage(peerId, data);
  });

  ws.on('close', () => {
    console.log(`WebSocket disconnected: ${peerId}`);
    handlePeerDisconnect(peerId);
  });
});

async function handlePeerMessage(peerId, data) {
  const peer = peers[peerId];
  if (!peer) return;

  switch (data.method) {
    case 'join-room':
      await handleJoinRoom(peerId, data);
      break;
    case 'create-transport':
      await handleCreateTransport(peerId, data);
      break;
    case 'connect-transport':
      await handleConnectTransport(peerId, data);
      break;
    case 'produce':
      await handleProduce(peerId, data);
      break;
    case 'consume':
      await handleConsume(peerId, data);
      break;
    default:
      console.log(`Unknown method: ${data.method}`);
  }
}

async function handleJoinRoom(peerId, data) {
  const { roomId } = data;
  const peer = peers[peerId];

  if (!rooms[roomId]) {
    rooms[roomId] = {
      router: await worker.createRouter({ mediaCodecs: router.mediaCodecs }),
      peers: new Set()
    };
  }

  peer.roomId = roomId;
  rooms[roomId].peers.add(peerId);

  // Notify other peers
  rooms[roomId].peers.forEach(otherPeerId => {
    if (otherPeerId !== peerId && peers[otherPeerId]) {
      peers[otherPeerId].ws.send(JSON.stringify({
        method: 'new-peer',
        peerId
      }));
    }
  });

  // Send existing peers to new peer
  const existingPeers = Array.from(rooms[roomId].peers).filter(id => id !== peerId);
  peer.ws.send(JSON.stringify({
    method: 'room-joined',
    roomId,
    peers: existingPeers
  }));

  // Store room info in Redis
  await redis.hset('webrtc_rooms', roomId, JSON.stringify({
    peer_count: rooms[roomId].peers.size,
    created_at: new Date().toISOString()
  }));
}

async function handleCreateTransport(peerId, data) {
  const peer = peers[peerId];
  const { direction } = data;

  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: '0.0.0.0', announcedIp: null }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    enableSctp: true
  });

  peer.transports[transport.id] = transport;

  transport.on('dtlsstatechange', (dtlsState) => {
    if (dtlsState === 'closed') {
      transport.close();
    }
  });

  peer.ws.send(JSON.stringify({
    method: 'transport-created',
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters
  }));
}

async function handleConnectTransport(peerId, data) {
  const peer = peers[peerId];
  const { transportId, dtlsParameters } = data;

  const transport = peer.transports[transportId];
  if (!transport) return;

  await transport.connect({ dtlsParameters });

  peer.ws.send(JSON.stringify({
    method: 'transport-connected',
    transportId
  }));
}

async function handleProduce(peerId, data) {
  const peer = peers[peerId];
  const { transportId, kind, rtpParameters } = data;

  const transport = peer.transports[transportId];
  if (!transport) return;

  const producer = await transport.produce({ kind, rtpParameters });
  peer.producers[producer.id] = producer;

  // Notify other peers in the room
  if (peer.roomId && rooms[peer.roomId]) {
    rooms[peer.roomId].peers.forEach(otherPeerId => {
      if (otherPeerId !== peerId && peers[otherPeerId]) {
        peers[otherPeerId].ws.send(JSON.stringify({
          method: 'new-producer',
          peerId,
          producerId: producer.id,
          kind
        }));
      }
    });
  }

  peer.ws.send(JSON.stringify({
    method: 'producer-created',
    id: producer.id
  }));
}

async function handleConsume(peerId, data) {
  const peer = peers[peerId];
  const { producerPeerId, producerId, rtpCapabilities } = data;

  const producerPeer = peers[producerPeerId];
  if (!producerPeer || !producerPeer.producers[producerId]) return;

  const producer = producerPeer.producers[producerId];

  const canConsume = await router.canConsume({
    producerId: producer.id,
    rtpCapabilities
  });

  if (!canConsume) {
    peer.ws.send(JSON.stringify({
      method: 'consume-error',
      error: 'Cannot consume this producer'
    }));
    return;
  }

  const transport = Object.values(peer.transports).find(t => t.direction === 'recv');
  if (!transport) return;

  const consumer = await transport.consume({
    producerId: producer.id,
    rtpCapabilities,
    paused: false
  });

  peer.consumers[consumer.id] = consumer;

  peer.ws.send(JSON.stringify({
    method: 'consumer-created',
    id: consumer.id,
    producerId: producer.id,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters
  }));
}

function handlePeerDisconnect(peerId) {
  const peer = peers[peerId];
  if (!peer) return;

  // Close all transports
  Object.values(peer.transports).forEach(transport => transport.close());

  // Remove from room
  if (peer.roomId && rooms[peer.roomId]) {
    rooms[peer.roomId].peers.delete(peerId);

    // Notify other peers
    rooms[peer.roomId].peers.forEach(otherPeerId => {
      if (peers[otherPeerId]) {
        peers[otherPeerId].ws.send(JSON.stringify({
          method: 'peer-left',
          peerId
        }));
      }
    });

    // Clean up empty rooms
    if (rooms[peer.roomId].peers.size === 0) {
      rooms[peer.roomId].router.close();
      delete rooms[peer.roomId];
      redis.hdel('webrtc_rooms', peer.roomId);
    }
  }

  delete peers[peerId];
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'webrtc-sfu',
    active_rooms: Object.keys(rooms).length,
    active_peers: Object.keys(peers).length,
    timestamp: new Date().toISOString()
  });
});

app.get('/rooms', async (req, res) => {
  try {
    const roomsData = await redis.hgetall('webrtc_rooms');
    const roomArray = Object.entries(roomsData).map(([roomId, data]) => ({
      roomId,
      ...JSON.parse(data)
    }));
    res.json({ rooms: roomArray });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
async function start() {
  await initializeMediasoup();

  server.listen(MEDIASOUP_PORT, () => {
    console.log(`WebRTC SFU server running on port ${MEDIASOUP_PORT}`);
  });
}

start().catch(console.error);

module.exports = { server, wss };
