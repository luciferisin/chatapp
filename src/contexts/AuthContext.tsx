import React, { createContext, useContext, useEffect, useState } from 'react';
import { ref, set, serverTimestamp, update } from 'firebase/database';
import { onAuthStateChange } from '../services/auth';
import { updateUserStatus } from '../services/userStatus';
import { User } from '../types';
import { signIn, signOut as firebaseSignOut } from '../services/auth';
import { db } from '../config/firebase';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      try {
        if (user) {
          // First, set the basic user data
          const userRef = ref(db, `users/${user.uid}`);
          await set(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email?.split('@')[0],
            photoURL: user.photoURL,
            createdAt: serverTimestamp()
          });

          // Then, update the status separately
          const userData: User = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || '',
            status: 'online',
            lastSeen: new Date()
          };

          setCurrentUser(userData);
          
          // Update status after setting currentUser
          await updateUserStatus(user.uid, 'online');
        } else {
          if (currentUser?.uid) {
            await updateUserStatus(currentUser.uid, 'offline');
          }
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
      } finally {
        setLoading(false);
      }
    });

    // Handle page unload
    const handleUnload = () => {
      if (currentUser?.uid) {
        // Use synchronous version for unload
        const userStatusRef = ref(db, `users/${currentUser.uid}/status`);
        const userLastSeenRef = ref(db, `users/${currentUser.uid}/lastSeen`);
        
        set(userStatusRef, 'offline');
        set(userLastSeenRef, serverTimestamp());
      }
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', handleUnload);
      if (currentUser?.uid) {
        updateUserStatus(currentUser.uid, 'offline');
      }
    };
  }, [currentUser?.uid]);

  const handleSignIn = async (email: string, password: string) => {
    await signIn(email, password);
  };

  const handleSignOut = async () => {
    try {
      if (currentUser) {
        await updateUserStatus(currentUser.uid, 'offline');
      }
      await firebaseSignOut();
      setCurrentUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      loading,
      signIn: handleSignIn,
      signOut: handleSignOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};