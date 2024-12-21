export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  status: 'online' | 'offline';
  lastSeen: Date;
  createdAt?: number;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'file';
  readBy: string[];
}

export interface Chat {
  id: string;
  type: 'private' | 'group';
  participants: Record<string, boolean>;
  lastMessage?: Message;
  createdAt: Date;
  updatedAt: Date;
  name?: string;
  photoURL?: string;
}