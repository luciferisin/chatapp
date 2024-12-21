import React, { useState, useEffect } from 'react';
import { ref, onValue, query, orderByChild } from 'firebase/database';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { UserStats } from './UserStats';
import { ChatContainer } from './ChatContainer';
import { UserList } from './UserList';
import { ChatList } from './ChatList';
import { User, Chat } from '../../types';
import { createChat } from '../../services/chat';

export const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [totalUsers, setTotalUsers] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch users
  useEffect(() => {
    if (!currentUser) return;

    const usersRef = ref(db, 'users');
    
    const unsubscribe = onValue(usersRef, (snapshot) => {
      setLoading(false);
      try {
        if (snapshot.exists()) {
          const usersData = snapshot.val();
          const usersList = Object.values(usersData) as User[];
          setUsers(usersList);
          setTotalUsers(usersList.length);
          setOnlineUsers(usersList.filter(user => user.status === 'online').length);
          setError(null);
        }
      } catch (error) {
        console.error('Error processing users data:', error);
        setError('Failed to load user data. Please try again later.');
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch chats
  useEffect(() => {
    if (!currentUser) return;

    const chatsRef = ref(db, 'chats');
    const userChatsQuery = query(chatsRef, orderByChild(`participants/${currentUser.uid}`));

    const unsubscribe = onValue(userChatsQuery, (snapshot) => {
      try {
        const chatsData: Chat[] = [];
        snapshot.forEach((childSnapshot) => {
          const chat = childSnapshot.val();
          if (chat.participants[currentUser.uid]) {
            chatsData.push({
              id: childSnapshot.key!,
              ...chat
            });
          }
        });
        setChats(chatsData);
      } catch (error) {
        console.error('Error fetching chats:', error);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleStartChat = async (userId: string) => {
    try {
      // Check if chat already exists
      const existingChat = chats.find(chat => {
        const participants = chat.participants as Record<string, boolean>;
        return chat.type === 'private' && 
          participants[userId] && 
          participants[currentUser!.uid];
      });

      if (existingChat) {
        setSelectedChat(existingChat.id);
        return;
      }

      // Create new chat
      const chatId = await createChat(
        [currentUser!.uid, userId],
        'private',
        // Optional: Add user's name as chat name
        users.find(u => u.uid === userId)?.displayName
      );
      setSelectedChat(chatId);
    } catch (error) {
      console.error('Error starting chat:', error);
      setError('Failed to start chat. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        <p>{error}</p>
        <button 
          onClick={() => setError(null)}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <UserStats totalUsers={totalUsers} onlineUsers={onlineUsers} />
        
        <div className="grid grid-cols-12 gap-6 mt-6">
          <div className="col-span-3">
            <UserList 
              users={users}
              currentUserId={currentUser.uid}
              onStartChat={handleStartChat}
            />
            <div className="mt-6">
              <ChatList
                chats={chats}
                onSelectChat={setSelectedChat}
                selectedChatId={selectedChat}
                currentUserId={currentUser.uid}
                users={users}
              />
            </div>
          </div>
          
          <div className="col-span-9">
            {selectedChat ? (
              <ChatContainer
                chatId={selectedChat}
                currentUserId={currentUser.uid}
              />
            ) : (
              <div className="text-center text-gray-500 bg-white p-8 rounded-lg shadow-sm">
                Select a user to start chatting or click on an existing chat
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};