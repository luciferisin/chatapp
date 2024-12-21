import { EventEmitter } from 'events';
import { CallService } from './calls';

export enum CallState {
  Idle = 'idle',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Failed = 'failed',
  Closed = 'closed'
}

export class CallManager extends EventEmitter {
  private callService: CallService | null = null;
  private state: CallState = CallState.Idle;
  private connectionMonitor: number | null = null;

  constructor(private userId: string) {
    super();
  }

  async startCall(chatId: string, isVideo: boolean) {
    try {
      this.setState(CallState.Connecting);
      
      // Create call service
      this.callService = new CallService(chatId, this.userId);
      
      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo
      });

      // Start monitoring connection state
      this.startConnectionMonitoring();

      // Start the call
      await this.callService.startCall(stream);
      
      this.setState(CallState.Connected);
      
      return stream;
    } catch (error) {
      this.setState(CallState.Failed);
      throw error;
    }
  }

  private startConnectionMonitoring() {
    if (this.connectionMonitor) {
      clearInterval(this.connectionMonitor);
    }

    this.connectionMonitor = window.setInterval(() => {
      if (!this.callService) return;

      const state = this.callService.getConnectionState();
      
      switch (state) {
        case 'connected':
          this.setState(CallState.Connected);
          break;
        case 'connecting':
          this.setState(CallState.Connecting);
          break;
        case 'disconnected':
        case 'new':
          this.setState(CallState.Reconnecting);
          break;
        case 'failed':
        case 'closed':
          this.setState(CallState.Failed);
          this.endCall();
          break;
      }
    }, 1000);
  }

  private setState(state: CallState) {
    if (this.state !== state) {
      this.state = state;
      this.emit('stateChanged', state);
    }
  }

  getState(): CallState {
    return this.state;
  }

  async endCall() {
    if (this.connectionMonitor) {
      clearInterval(this.connectionMonitor);
      this.connectionMonitor = null;
    }

    if (this.callService) {
      await this.callService.close();
      this.callService = null;
    }

    this.setState(CallState.Closed);
  }

  onRemoteStream(callback: (stream: MediaStream) => void) {
    if (this.callService) {
      this.callService.onRemoteStream = callback;
    }
  }
} 