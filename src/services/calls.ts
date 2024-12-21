import { ref, push, set, onValue, remove, serverTimestamp } from 'firebase/database';
import { db } from '../config/firebase';
import { getWebRTCConfig, defaultWebRTCConfig } from '../config/webrtc';

interface CallSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: any;
  from: string;
  to: string;
  timestamp: number;
}

export class CallService {
  private peerConnection!: RTCPeerConnection;
  private localStream?: MediaStream;
  private remoteStream?: MediaStream;
  private signalRef: any;
  private isInitialized = false;
  private remoteUserId: string;
  private pendingCandidates: RTCIceCandidate[] = [];
  private isNegotiating = false;

  constructor(private chatId: string, private userId: string) {
    if (!chatId || !userId) {
      throw new Error('ChatId and userId are required');
    }
    
    this.remoteUserId = this.getRemoteUserId();
    this.initializeCall();
  }

  private async initializeCall() {
    try {
      const callRef = ref(db, `calls/${this.chatId}`);
      await set(callRef, {
        participants: {
          [this.userId]: true,
          [this.remoteUserId]: true
        },
        startedAt: serverTimestamp()
      });

      const config = await getWebRTCConfig().catch(() => defaultWebRTCConfig);
      this.initializePeerConnection(config);
    } catch (error) {
      console.error('Error initializing call:', error);
      throw error;
    }
  }

  private initializePeerConnection(config: RTCConfiguration) {
    this.peerConnection = new RTCPeerConnection(config);
    this.signalRef = ref(db, `calls/${this.chatId}/signaling`);
    this.isInitialized = true;

    // Handle negotiation needed
    this.peerConnection.onnegotiationneeded = async () => {
      try {
        if (this.isNegotiating) return;
        this.isNegotiating = true;

        await this.createAndSendOffer();
      } catch (error) {
        console.error('Error handling negotiation:', error);
      } finally {
        this.isNegotiating = false;
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'ice-candidate',
          payload: event.candidate.toJSON(),
          from: this.userId,
          to: this.remoteUserId,
          timestamp: Date.now()
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log('Connection state changed:', state);
      
      // Handle failed state
      if (state === 'failed') {
        this.tryReconnect();
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE Connection state:', this.peerConnection.iceConnectionState);
    };

    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };

    // Listen for signaling messages
    onValue(this.signalRef, (snapshot) => {
      if (snapshot.exists()) {
        const signals = snapshot.val();
        Object.values(signals).forEach((signal: any) => {
          if (signal && signal.to === this.userId && signal.from) {
            this.handleSignal(signal as CallSignal).catch(console.error);
          }
        });
      }
    });
  }

  private async createAndSendOffer() {
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    
    await this.sendSignal({
      type: 'offer',
      payload: {
        type: offer.type,
        sdp: offer.sdp
      },
      from: this.userId,
      to: this.remoteUserId,
      timestamp: Date.now()
    });
  }

  private async handleSignal(signal: CallSignal) {
    try {
      if (signal.type === 'offer' || signal.type === 'answer') {
        const description = new RTCSessionDescription(signal.payload);
        const shouldSetRemote = !this.peerConnection.remoteDescription ||
          this.peerConnection.remoteDescription.type !== description.type;

        if (shouldSetRemote) {
          await this.peerConnection.setRemoteDescription(description);
        }

        if (signal.type === 'offer') {
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);
          
          await this.sendSignal({
            type: 'answer',
            payload: {
              type: answer.type,
              sdp: answer.sdp
            },
            from: this.userId,
            to: this.remoteUserId,
            timestamp: Date.now()
          });
        }

        // Process any pending candidates
        while (this.pendingCandidates.length) {
          const candidate = this.pendingCandidates.shift();
          if (candidate) {
            await this.peerConnection.addIceCandidate(candidate);
          }
        }
      } else if (signal.type === 'ice-candidate') {
        const candidate = new RTCIceCandidate(signal.payload);
        if (this.peerConnection.remoteDescription) {
          await this.peerConnection.addIceCandidate(candidate);
        } else {
          this.pendingCandidates.push(candidate);
        }
      }
    } catch (error) {
      console.error('Error handling signal:', error);
      throw error;
    }
  }

  private getRemoteUserId(): string {
    const [user1, user2] = this.chatId.split('_');
    if (!user1 || !user2) {
      throw new Error('Invalid chat ID format. Expected format: user1_user2');
    }
    return user1 === this.userId ? user2 : user1;
  }

  private async sendSignal(signal: CallSignal) {
    if (!signal.from || !signal.to || !signal.type || !signal.payload) {
      console.error('Invalid signal:', signal);
      return;
    }

    try {
      const signalRef = ref(db, `calls/${this.chatId}/signaling`);
      await push(signalRef, {
        ...signal,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error sending signal:', error);
      throw error;
    }
  }

  public onRemoteStream?: (stream: MediaStream) => void;

  async startCall(localStream: MediaStream) {
    if (!this.isInitialized) {
      this.initializePeerConnection();
    }

    this.localStream = localStream;
    this.localStream.getTracks().forEach(track => {
      if (this.peerConnection.connectionState !== 'closed') {
        this.peerConnection.addTrack(track, this.localStream!);
      }
    });
  }

  async createOffer() {
    await this.createAndSendOffer();
  }

  close() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = undefined;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    
    if (this.signalRef) {
      remove(ref(db, `calls/${this.chatId}`)).catch(console.error);
    }
    
    this.isInitialized = false;
  }

  getConnectionState(): RTCPeerConnectionState {
    return this.peerConnection.connectionState;
  }

  private async tryReconnect() {
    try {
      if (this.peerConnection.iceConnectionState !== 'failed') {
        return;
      }

      console.log('Attempting to reconnect...');
      
      // Create new offer to restart ICE
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);
      
      await this.sendSignal({
        type: 'offer',
        payload: {
          type: offer.type,
          sdp: offer.sdp
        },
        from: this.userId,
        to: this.remoteUserId,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Reconnection failed:', error);
    }
  }
}