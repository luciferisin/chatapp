// Default config for fallback
export const defaultWebRTCConfig: RTCConfiguration = {
  iceServers: [
    {
      urls: 'stun:34.83.201.110:3478'
    },
    {
      urls: 'turn:34.83.201.110:3478',
      username: 'sahiltomar',
      credential: 'b9384592-bdfa-11ef-b0e0-0242ac150003'
    }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
};

export const getWebRTCConfig = async (): Promise<RTCConfiguration> => {
  return defaultWebRTCConfig;
};
