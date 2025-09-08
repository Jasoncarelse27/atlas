import { Eye, EyeOff, Shield } from 'lucide-react';
import React from 'react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import type { SoundType } from '../../../hooks/useSoundEffects';

interface SecurityTabProps {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  showPasswords: boolean;
  isLoading: boolean;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onTogglePasswordVisibility: () => void;
  onChangePassword: () => void;
  onSoundPlay?: (soundType: SoundType) => void;
}

const SecurityTab: React.FC<SecurityTabProps> = ({
  currentPassword,
  newPassword,
  confirmPassword,
  showPasswords,
  isLoading,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onTogglePasswordVisibility,
  onChangePassword,
  onSoundPlay,
}) => {
  const isPasswordValid = newPassword.length >= 8;
  const doPasswordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => onCurrentPasswordChange(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => {
                  if (onSoundPlay) {
                    onSoundPlay('click');
                  }
                  onTogglePasswordVisibility();
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => onNewPasswordChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter new password"
            />
            {newPassword.length > 0 && (
              <p className={`text-xs mt-1 ${isPasswordValid ? 'text-green-600' : 'text-red-600'}`}>
                {isPasswordValid ? 'Password is strong' : 'Password must be at least 8 characters'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm New Password
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Confirm new password"
            />
            {confirmPassword.length > 0 && (
              <p className={`text-xs mt-1 ${doPasswordsMatch ? 'text-green-600' : 'text-red-600'}`}>
                {doPasswordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Password Requirements</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• At least 8 characters long</li>
              <li>• Mix of letters, numbers, and symbols recommended</li>
              <li>• Avoid common passwords or personal information</li>
            </ul>
          </div>

          <button
            onClick={onChangePassword}
            disabled={isLoading || !currentPassword || !isPasswordValid || !doPasswordsMatch}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <LoadingSpinner size="sm" color="white" /> : <Shield className="w-4 h-4" />}
            Change Password
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecurityTab;
