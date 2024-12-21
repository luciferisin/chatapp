import { ref, set, serverTimestamp } from 'firebase/database';
import { db } from '../config/firebase';

export const updateUserStatus = async (userId: string, status: 'online' | 'offline') => {
  try {
    if (!userId) {
      console.warn('No userId provided to updateUserStatus');
      return;
    }

    // Update status directly in the user's node
    const userStatusRef = ref(db, `users/${userId}/status`);
    const userLastSeenRef = ref(db, `users/${userId}/lastSeen`);

    await Promise.all([
      set(userStatusRef, status),
      set(userLastSeenRef, serverTimestamp())
    ]);
  } catch (error: any) {
    // Log the error but don't throw it as status updates are not critical
    console.error('Error updating user status:', error?.message || error);
    
    // If it's a permission error, we might want to trigger a re-auth
    if (error?.code === 'PERMISSION_DENIED') {
      console.warn('Permission denied while updating status. User might need to re-authenticate.');
    }
  }
};