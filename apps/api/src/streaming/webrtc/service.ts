// WebRTC service for streamvault

class WebRTCService {
  private peerConnections: Map<string, any> = new Map();

  async createPeerConnection(config: any) {
    const RTCPeerConnection = (global as any).RTCPeerConnection || (global as any).webkitRTCPeerConnection;
    const pc = new RTCPeerConnection(config);
    return pc;
  }

  async createOffer(peerConnection: any, options: any) {
    const offer = await peerConnection.createOffer(options);
    await peerConnection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(peerConnection: any, offer: any, options: any) {
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer(options);
    await peerConnection.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(peerConnection: any, description: any) {
    await peerConnection.setRemoteDescription(description);
  }

  async addIceCandidate(peerConnection: any, candidate: any) {
    await peerConnection.addIceCandidate(candidate);
  }

  async addTrack(peerConnection: any, track: any, stream: any) {
    peerConnection.addTrack(track, stream);
  }

  async getStats(peerConnection: any) {
    const stats = await peerConnection.getStats();
    return stats;
  }

  async closePeerConnection(sessionId: string) {
    const pc = this.peerConnections.get(sessionId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(sessionId);
    }
  }

  async createDataChannel(peerConnection: any, label: string, options: any) {
    return peerConnection.createDataChannel(label, options);
  }

  async setupSignalingServer(io: any) {
    io.on('connection', (socket: any) => {
      socket.on('join-room', (roomId: string) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-joined', socket.id);
      });

      socket.on('offer', async (data: any) => {
        socket.to(data.roomId).emit('offer', {
          offer: data.offer,
          socketId: socket.id
        });
      });

      socket.on('answer', async (data: any) => {
        socket.to(data.socketId).emit('answer', data.answer);
      });

      socket.on('ice-candidate', async (data: any) => {
        socket.to(data.socketId).emit('ice-candidate', data.candidate);
      });

      socket.on('disconnect', () => {
        socket.broadcast.emit('user-left', socket.id);
      });
    });
  }

  async getSupportedCodecs() {
    return [
      'video/H264',
      'video/VP8',
      'video/VP9',
      'video/AV1',
      'audio/opus',
      'audio/PCMU',
      'audio/PCMA'
    ];
  }

  async getBandwidthEstimation(peerConnection: any) {
    const stats = await this.getStats(peerConnection);
    let bandwidth = 0;
    
    stats.forEach((report: any) => {
      if (report.type === 'inbound-rtp' && report.kind === 'video') {
        bandwidth = report.bitrate || 0;
      }
    });
    
    return bandwidth;
  }
}

export default WebRTCService;
