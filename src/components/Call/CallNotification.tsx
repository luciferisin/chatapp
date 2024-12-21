import React from 'react';
import { Phone, Video, X } from 'lucide-react';

interface CallNotificationProps {
  caller: {
    displayName: string;
    callType: 'audio' | 'video';
  };
  onAccept: () => void;
  onReject: () => void;
}

export const CallNotification: React.FC<CallNotificationProps> = ({
  caller,
  onAccept,
  onReject
}) => {
  return (
    <div className="fixed top-4 right-4 bg-white rounded-lg shadow-lg p-4 w-80">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          {caller.callType === 'video' ? <Video /> : <Phone />}
          <span className="font-medium">{caller.displayName} is calling...</span>
        </div>
      </div>
      <div className="flex justify-end space-x-2">
        <button
          onClick={onReject}
          className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200"
        >
          <X className="h-5 w-5" />
        </button>
        <button
          onClick={onAccept}
          className="p-2 rounded-full bg-green-100 text-green-600 hover:bg-green-200"
        >
          {caller.callType === 'video' ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}; 