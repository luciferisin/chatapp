import React from 'react';
import { Users, UserCheck } from 'lucide-react';

interface UserStatsProps {
  totalUsers: number;
  onlineUsers: number;
}

export const UserStats: React.FC<UserStatsProps> = ({ totalUsers, onlineUsers }) => {
  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center">
          <Users className="h-8 w-8 text-indigo-600" />
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">Total Users</p>
            <p className="text-2xl font-semibold text-gray-900">{totalUsers}</p>
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center">
          <UserCheck className="h-8 w-8 text-green-600" />
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">Online Users</p>
            <p className="text-2xl font-semibold text-gray-900">{onlineUsers}</p>
          </div>
        </div>
      </div>
    </div>
  );
};