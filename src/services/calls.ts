import { ref, push, set, onValue, remove, serverTimestamp } from 'firebase/database';
import { db } from '../config/firebase';
import { getWebRTCConfig, defaultWebRTCConfig } from '../config/webrtc';
import { auth } from '../config/firebase';

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
  private mediaConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 }
    }
  };

  private bufferConfig = {
    audio: {
      maxBufferSize: 50, // milliseconds
      targetDelay: 150   // milliseconds
    },
    video: {
      maxBufferSize: 120, // milliseconds
      targetDelay: 200    // milliseconds
    }
  };

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
      const stream = event.streams[0];
      
      // Configure incoming stream buffering
      if (event.track.kind === 'audio') {
        this.configureIncomingAudioBuffer(event.track);
      } else if (event.track.kind === 'video') {
        this.configureIncomingVideoBuffer(event.track);
      }

      if (this.onRemoteStream) {
        this.onRemoteStream(stream);
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
    try {
      if (this.peerConnection.signalingState === 'stable') {
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
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  private async handleSignal(signal: CallSignal) {
    try {
      // Don't process signals if connection is closed
      if (this.peerConnection.connectionState === 'closed') {
        console.log('Ignoring signal in closed state');
        return;
      }

      if (signal.type === 'offer' || signal.type === 'answer') {
        const description = new RTCSessionDescription(signal.payload);
        
        // Check signaling state before setting remote description
        if (this.peerConnection.signalingState !== 'closed') {
          await this.peerConnection.setRemoteDescription(description);
          
          if (signal.type === 'offer' && 
              this.peerConnection.signalingState === 'have-remote-offer') {
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
        }

        // Process pending candidates after remote description is set
        while (this.pendingCandidates.length && 
               this.peerConnection.remoteDescription) {
          const candidate = this.pendingCandidates.shift();
          if (candidate && this.peerConnection.signalingState !== 'closed') {
            await this.peerConnection.addIceCandidate(candidate);
          }
        }
      } else if (signal.type === 'ice-candidate') {
        const candidate = new RTCIceCandidate(signal.payload);
        if (this.peerConnection.remoteDescription && 
            this.peerConnection.signalingState !== 'closed') {
          await this.peerConnection.addIceCandidate(candidate);
        } else {
          this.pendingCandidates.push(candidate);
        }
      }
    } catch (error) {
      console.error('Error handling signal:', error);
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

  async startCall(isVideo: boolean) {
    try {
      const stream = await this.initializeMediaStream(isVideo);
      
      // Configure WebRTC with proper settings
      const senderOptions = {
        degradationPreference: 'maintain-framerate' as RTCDegradationPreference,
        priority: 'high' as RTCPriorityType
      };

      stream.getTracks().forEach(track => {
        const sender = this.peerConnection.addTrack(track, stream);
        sender.setParameters({
          ...sender.getParameters(),
          ...senderOptions
        });
      });

      // Set bandwidth constraints
      const transceiverInit: RTCRtpTransceiverInit = {
        direction: 'sendrecv',
        streams: [stream],
        sendEncodings: [{
          maxBitrate: isVideo ? 1500000 : 64000, // 1.5 Mbps for video, 64 kbps for audio
          priority: 'high'
        }]
      };

      this.peerConnection.addTransceiver('audio', transceiverInit);
      if (isVideo) {
        this.peerConnection.addTransceiver('video', transceiverInit);
      }

      return stream;
    } catch (error) {
      console.error('Error starting call:', error);
      throw error;
    }
  }

  async createOffer() {
    await this.createAndSendOffer();
  }

  close() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = undefined;
    }
    
    // Remove all event listeners
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.onnegotiationneeded = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.close();
    }
    
    if (this.signalRef) {
      remove(ref(db, `calls/${this.chatId}`)).catch(console.error);
    }
    
    this.isInitialized = false;
    this.pendingCandidates = [];
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

  private async notifyIncomingCall() {
    const callNotificationRef = ref(db, `users/${this.remoteUserId}/incomingCall`);
    await set(callNotificationRef, {
      callId: this.chatId,
      callerId: this.userId,
      callerName: auth.currentUser?.displayName,
      callType: this.isVideo ? 'video' : 'audio',
      timestamp: serverTimestamp()
    });
  }

  private async initializeMediaStream(isVideo: boolean) {
    try {
      const constraints = {
        audio: this.mediaConstraints.audio,
        video: isVideo ? this.mediaConstraints.video : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Configure audio buffering
      stream.getAudioTracks().forEach(track => {
        const settings = track.getSettings();
        if (settings.sampleRate) {
          this.configureAudioBuffer(track, settings.sampleRate);
        }
      });

      return stream;
    } catch (error) {
      console.error('Error getting media stream:', error);
      throw error;
    }
  }

  private configureAudioBuffer(track: MediaStreamTrack, sampleRate: number) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(new MediaStream([track]));
    const buffer = audioContext.createBuffer(1, sampleRate, sampleRate);
    const bufferSource = audioContext.createBufferSource();
    
    bufferSource.buffer = buffer;
    bufferSource.connect(audioContext.destination);

    // Add audio processing for echo cancellation and noise reduction
    const audioProcessor = audioContext.createScriptProcessor(1024, 1, 1);
    audioProcessor.onaudioprocess = (e) => {
      const inputBuffer = e.inputBuffer;
      const outputBuffer = e.outputBuffer;
      
      // Process audio data
      for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
        const inputData = inputBuffer.getChannelData(channel);
        const outputData = outputBuffer.getChannelData(channel);
        
        // Apply audio processing
        this.processAudioData(inputData, outputData);
      }
    };

    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);
  }

  private processAudioData(inputData: Float32Array, outputData: Float32Array) {
    // Simple noise gate
    const threshold = 0.01;
    for (let i = 0; i < inputData.length; i++) {
      outputData[i] = Math.abs(inputData[i]) > threshold ? inputData[i] : 0;
    }
  }

  private configureIncomingAudioBuffer(track: MediaStreamTrack) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(new MediaStream([track]));
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate, audioContext.sampleRate);
    
    // Create a delay node for buffering
    const delayNode = audioContext.createDelay(this.bufferConfig.audio.maxBufferSize / 1000);
    delayNode.delayTime.value = this.bufferConfig.audio.targetDelay / 1000;
    
    source.connect(delayNode);
    delayNode.connect(audioContext.destination);
  }

  private configureIncomingVideoBuffer(track: MediaStreamTrack) {
    // Configure video buffering using requestVideoFrameCallback
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      const video = document.createElement('video');
      video.srcObject = new MediaStream([track]);
      
      let lastFrameTime = 0;
      const frameCallback = (now: number, metadata: any) => {
        const frameDelay = now - lastFrameTime;
        if (frameDelay < this.bufferConfig.video.targetDelay) {
          // Add artificial delay if frames are coming too quickly
          setTimeout(() => {
            video.requestVideoFrameCallback(frameCallback);
          }, this.bufferConfig.video.targetDelay - frameDelay);
        } else {
          video.requestVideoFrameCallback(frameCallback);
        }
        lastFrameTime = now;
      };
      
      video.requestVideoFrameCallback(frameCallback);
    }
  }
}