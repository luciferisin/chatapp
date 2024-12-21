import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { ref, set, serverTimestamp } from 'firebase/database';
import { auth, db } from '../config/firebase';
import { User } from '../types';

export const signIn = async (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const signUp = async (email: string, password: string, displayName: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update the user's profile with display name
    await updateProfile(userCredential.user, {
      displayName
    });

    // Create user profile in Realtime Database
    const userRef = ref(db, `users/${userCredential.user.uid}`);
    await set(userRef, {
      uid: userCredential.user.uid,
      email,
      displayName,
      status: 'online',
      lastSeen: serverTimestamp(),
      photoURL: null,
      createdAt: serverTimestamp()
    });

    return userCredential;
  } catch (error) {
    console.error('Error in signUp:', error);
    throw error;
  }
};

export const signOut = () => firebaseSignOut(auth);

export const onAuthStateChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};