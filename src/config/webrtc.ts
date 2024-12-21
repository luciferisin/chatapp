const getXirSysIceServers = async () => {
  const xirsysUrl = 'https://global.xirsys.net/_turn';
  const xirsysAuth = {
    ident: 'sahiltomar',
    secret: 'b9384592-bdfa-11ef-b0e0-0242ac150003',
    domain: 'localhost',
    application: 'ChatApp',
    channel: 'ChatApp',
    room: 'default',
    secure: 1
  };

  try {
    const response = await fetch(xirsysUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(xirsysAuth)
    });

    if (!response.ok) {
      throw new Error('Failed to get ICE servers from XIRSYS');
    }

    const data = await response.json();
    return data.v.iceServers;
  } catch (error) {
    console.error('Error fetching XIRSYS ICE servers:', error);
    // Fallback to public STUN servers if XIRSYS fails
    return [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302'
        ]
      }
    ];
  }
};

export const getWebRTCConfig = async () => {
  const iceServers = await getXirSysIceServers();
  return {
    iceServers,
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  } as RTCConfiguration;
};

// Default config for fallback
export const defaultWebRTCConfig: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302'
      ]
    }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
};