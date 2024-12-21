import { 
  ref,
  push,
  set,
  onValue,
  query,
  orderByChild,
  serverTimestamp
} from 'firebase/database';
import { db } from '../config/firebase';
import { Chat, Message } from '../types';

export const createChat = async (participants: string[], type: 'private' | 'group', name?: string) => {
  const chatsRef = ref(db, 'chats');
  const newChatRef = push(chatsRef);
  
  const participantsObject = participants.reduce((acc, id) => ({
    ...acc,
    [id]: true
  }), {});

  await set(newChatRef, {
    participants: participantsObject,
    type,
    name: name || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return newChatRef.key;
};

export const sendMessage = async (chatId: string, senderId: string, content: string, type: 'text' | 'image' | 'file' = 'text') => {
  const messagesRef = ref(db, `chats/${chatId}/messages`);
  const newMessageRef = push(messagesRef);
  
  await set(newMessageRef, {
    senderId,
    content,
    type,
    timestamp: serverTimestamp(),
    readBy: { [senderId]: true }
  });

  return newMessageRef.key;
};

export const subscribeToChat = (chatId: string, callback: (messages: Message[]) => void) => {
  const messagesRef = ref(db, `chats/${chatId}/messages`);
  const messagesQuery = query(messagesRef, orderByChild('timestamp'));

  const unsubscribe = onValue(messagesQuery, (snapshot) => {
    const messages: Message[] = [];
    snapshot.forEach((childSnapshot) => {
      messages.push({
        id: childSnapshot.key!,
        ...childSnapshot.val()
      });
    });
    callback(messages);
  });

  return unsubscribe;
};