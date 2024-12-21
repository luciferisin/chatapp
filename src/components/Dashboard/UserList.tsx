import React from 'react';
import { User } from '../../types';
import { MessageCircle } from 'lucide-react';

interface UserListProps {
  users: User[];
  currentUserId: string;
  onStartChat: (userId: string) => void;
}

export const UserList: React.FC<UserListProps> = ({ users, currentUserId, onStartChat }) => {
  const filteredUsers = users.filter(user => user.uid !== currentUserId);

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h2 className="text-lg font-semibold mb-4">Available Users</h2>
      <div className="space-y-2">
        {filteredUsers.map(user => (
          <div
            key={user.uid}
            className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
            onClick={() => onStartChat(user.uid)}
          >
            <div className="flex items-center space-x-3">
              <div className={`w-2 h-2 rounded-full ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="font-medium">{user.displayName}</span>
            </div>
            <MessageCircle className="h-5 w-5 text-indigo-600" />
          </div>
        ))}
      </div>
    </div>
  );
}; 