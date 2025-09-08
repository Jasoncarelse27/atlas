import { AlertTriangle, LogOut, Trash2 } from 'lucide-react';
import React from 'react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import type { SoundType } from '../../../hooks/useSoundEffects';

interface DangerTabProps {
  deleteConfirmation: string;
  showDeleteConfirm: boolean;
  isLoading: boolean;
  onDeleteConfirmationChange: (value: string) => void;
  onShowDeleteConfirm: (show: boolean) => void;
  onDeleteAccount: () => void;
  onLogout: () => void;
  onSoundPlay?: (soundType: SoundType) => void;
}

const DangerTab: React.FC<DangerTabProps> = ({
  deleteConfirmation,
  showDeleteConfirm,
  isLoading,
  onDeleteConfirmationChange,
  onShowDeleteConfirm,
  onDeleteAccount,
  onLogout,
  onSoundPlay,
}) => {
  const isDeleteEnabled = deleteConfirmation === 'DELETE' && !isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Danger Zone</h3>
        
        <div className="space-y-6">
          {/* Logout */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <LogOut className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-yellow-900 mb-2">Sign Out</h4>
                <p className="text-sm text-yellow-800 mb-3">
                  Sign out of your account on this device. You can sign back in anytime.
                </p>
                <button
                  onClick={() => {
                    if (onSoundPlay) {
                      onSoundPlay('click');
                    }
                    onLogout();
                  }}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* Delete Account */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Trash2 className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-red-900 mb-2">Delete Account</h4>
                <p className="text-sm text-red-800 mb-3">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => {
                      if (onSoundPlay) {
                        onSoundPlay('notification');
                      }
                      onShowDeleteConfirm(true);
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-red-900 mb-2">
                        Type "DELETE" to confirm
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmation}
                        onChange={(e) => onDeleteConfirmationChange(e.target.value)}
                        className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="Type DELETE to confirm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (onSoundPlay) {
                            onSoundPlay('click');
                          }
                          onShowDeleteConfirm(false);
                          onDeleteConfirmationChange('');
                        }}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={onDeleteAccount}
                        disabled={!isDeleteEnabled}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {isLoading ? (
                          <LoadingSpinner size="sm" color="white" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        Delete Account
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-orange-900 mb-2">Important Notice</h4>
                <p className="text-sm text-orange-800">
                  Account deletion is permanent and irreversible. All your conversations, settings, and data will be permanently removed from our servers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DangerTab;
