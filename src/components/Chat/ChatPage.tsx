import React from 'react';
import { useParams } from 'react-router-dom';
import { ChatContainer } from '../Dashboard/ChatContainer';
import { useAuth } from '../../contexts/AuthContext';

export const ChatPage: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const { currentUser } = useAuth();

  if (!chatId || !currentUser) {
    return <div>Invalid chat</div>;
  }

  return (
    <ChatContainer
      chatId={chatId}
      currentUserId={currentUser.uid}
    />
  );
}; 