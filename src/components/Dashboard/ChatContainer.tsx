import React, { useState, useEffect, useRef } from 'react';
import { Send, Phone, Video, Smile } from 'lucide-react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Message } from '../../types';
import { subscribeToChat, sendMessage } from '../../services/chat';
import { CallInterface } from '../Call/CallInterface';
import { ref, get, set, serverTimestamp } from 'firebase/database';
import { db } from '../../config/firebase';
import { auth } from '../../config/firebase';

interface ChatContainerProps {
  chatId: string;
  currentUserId: string;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  chatId,
  currentUserId,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [remoteUserId, setRemoteUserId] = useState<string>('');
  const [callChatId, setCallChatId] = useState<string>('');

  useEffect(() => {
    const getChatParticipants = async () => {
      const chatRef = ref(db, `chats/${chatId}`);
      const snapshot = await get(chatRef);
      if (snapshot.exists()) {
        const chatData = snapshot.val();
        const participants = Object.keys(chatData.participants || {});
        const otherUserId = participants.find(id => id !== currentUserId);
        if (otherUserId) {
          setRemoteUserId(otherUserId);
          const sortedIds = [currentUserId, otherUserId].sort();
          setCallChatId(`${sortedIds[0]}_${sortedIds[1]}`);
        }
      }
    };

    getChatParticipants();
  }, [chatId, currentUserId]);

  useEffect(() => {
    const unsubscribe = subscribeToChat(chatId, (messages) => {
      setMessages(messages);
    });

    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await sendMessage(chatId, currentUserId, newMessage);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleEmojiSelect = (emoji: any) => {
    setNewMessage(prev => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  const startCall = async (type: 'audio' | 'video') => {
    if (!remoteUserId) return;
    
    try {
      // Notify the other user
      const callNotificationRef = ref(db, `users/${remoteUserId}/incomingCall`);
      await set(callNotificationRef, {
        callId: callChatId,
        callerId: currentUserId,
        callerName: auth.currentUser?.displayName,
        callType: type,
        timestamp: serverTimestamp()
      });

      setCallType(type);
      setIsInCall(true);
    } catch (error) {
      console.error('Error starting call:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm">
      {isInCall && callType && remoteUserId && callChatId && (
        <CallInterface
          chatId={callChatId}
          callType={callType}
          remoteUserId={remoteUserId}
          currentUserId={currentUserId}
          onEndCall={() => {
            setIsInCall(false);
            setCallType(null);
          }}
        />
      )}

      {/* Chat header with call controls */}
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold">Chat</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => startCall('audio')}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <Phone className="h-5 w-5" />
          </button>
          <button
            onClick={() => startCall('video')}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <Video className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.senderId === currentUserId ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-lg ${
                message.senderId === currentUserId
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <form onSubmit={handleSend} className="p-4 border-t">
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <Smile className="h-5 w-5" />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Type a message..."
          />
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>

        {/* Emoji picker */}
        {showEmojiPicker && (
          <div className="absolute bottom-20 right-4">
            <Picker data={data} onEmojiSelect={handleEmojiSelect} />
          </div>
        )}
      </form>
    </div>
  );
};