import type { User } from '@supabase/supabase-js';
import { User as UserIcon } from 'lucide-react';
import React from 'react';
import LoadingSpinner from '../../../components/LoadingSpinner';

interface ProfileTabProps {
  user: User;
  displayName: string;
  email: string;
  isLoading: boolean;
  onDisplayNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onUpdateProfile: () => void;
}

const ProfileTab: React.FC<ProfileTabProps> = ({
  user,
  displayName,
  email,
  isLoading,
  onDisplayNameChange,
  onEmailChange,
  onUpdateProfile,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your display name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email"
            />
            <p className="text-xs text-gray-500 mt-1">
              Changing your email will require verification
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Account Created:</span>
              <p className="font-medium">{new Date(user.created_at!).toLocaleDateString()}</p>
            </div>
            <div>
              <span className="text-gray-600">Last Sign In:</span>
              <p className="font-medium">
                {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}
              </p>
            </div>
          </div>

          <button
            onClick={onUpdateProfile}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <LoadingSpinner size="sm" color="white" /> : <UserIcon className="w-4 h-4" />}
            Update Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileTab;
