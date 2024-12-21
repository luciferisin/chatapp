import React from 'react';
import { Chat, Message, User } from '../../types';

interface ChatListProps {
  chats: Chat[];
  onSelectChat: (chatId: string) => void;
  selectedChatId: string | null;
  currentUserId: string;
  users: User[];
}

export const ChatList: React.FC<ChatListProps> = ({ 
  chats, 
  onSelectChat, 
  selectedChatId,
  currentUserId,
  users 
}) => {
  const getChatName = (chat: Chat): string => {
    if (chat.name) return chat.name;
    
    // For private chats, show the other participant's name
    if (chat.type === 'private') {
      const otherParticipantId = Object.keys(chat.participants)
        .find(id => id !== currentUserId);
      if (otherParticipantId) {
        const otherUser = users.find(u => u.uid === otherParticipantId);
        return otherUser?.displayName || 'Unknown User';
      }
    }
    return 'Chat';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h2 className="text-lg font-semibold mb-4">Recent Chats</h2>
      <div className="space-y-2">
        {chats.map(chat => (
          <div
            key={chat.id}
            className={`p-3 rounded-lg cursor-pointer ${
              selectedChatId === chat.id ? 'bg-indigo-50' : 'hover:bg-gray-50'
            }`}
            onClick={() => onSelectChat(chat.id)}
          >
            <div className="font-medium">{getChatName(chat)}</div>
            {chat.lastMessage && (
              <div className="text-sm text-gray-500 truncate">
                {chat.lastMessage.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}; 