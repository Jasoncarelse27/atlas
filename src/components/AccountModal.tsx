/** REFACTORED: AccountModal now uses modular account components */
import { DangerTab, FeedbackTab, PrivacyTab, ProfileTab, SecurityTab } from '@/features/account';
import type { User } from '@supabase/supabase-js';
import {
    FileText,
    MessageSquare,
    Shield,
    Trash2,
    User as UserIcon,
    X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type { SoundType } from '../hooks/useSoundEffects';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types/subscription';
import ErrorMessage from './ErrorMessage';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  profile: UserProfile;
  onLogout: () => void;
  onSoundPlay?: (soundType: SoundType) => void;
}

type TabType = 'profile' | 'security' | 'feedback' | 'privacy' | 'danger';

const AccountModal: React.FC<AccountModalProps> = ({ 
  isOpen, 
  onClose, 
  user, 
  profile,
  onLogout,
  onSoundPlay
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Profile update states
  const [displayName, setDisplayName] = useState(user.user_metadata?.full_name || '');
  const [email, setEmail] = useState(user.email || '');
  
  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  
  // Feedback states
  const [feedbackType, setFeedbackType] = useState<'feedback' | 'bug' | 'review'>('feedback');
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [rating, setRating] = useState(5);
  
  // Account deletion states
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Update states when user changes
  useEffect(() => {
    setDisplayName(user.user_metadata?.full_name || '');
    setEmail(user.email || '');
  }, [user]);

  if (!isOpen) return null;

  const handleTabChange = (tab: TabType) => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    setActiveTab(tab);
    setError(null);
    setSuccess(null);
  };

  const handleUpdateProfile = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.auth.updateUser({
        email: email !== user.email ? email : undefined,
        data: {
          full_name: displayName
        }
      });

      if (error) throw error;

      if (onSoundPlay) {
        onSoundPlay('success');
      }
      setSuccess('Profile updated successfully!');
    } catch (error) {
      console.error('Profile update error:', error);
      setError(error instanceof Error ? error.message : 'Failed to update profile');
      if (onSoundPlay) {
        onSoundPlay('error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      if (onSoundPlay) {
        onSoundPlay('success');
      }
      setSuccess('Password changed successfully!');
    } catch (error) {
      console.error('Password change error:', error);
      setError(error instanceof Error ? error.message : 'Failed to change password');
      if (onSoundPlay) {
        onSoundPlay('error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from('feedback')
        .insert({
          user_id: user.id,
          type: feedbackType,
          subject: feedbackSubject,
          message: feedbackMessage,
          rating: feedbackType === 'review' ? rating : null,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      setFeedbackSubject('');
      setFeedbackMessage('');
      setRating(5);
      
      if (onSoundPlay) {
        onSoundPlay('success');
      }
      setSuccess('Feedback submitted successfully!');
    } catch (error) {
      console.error('Feedback submission error:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit feedback');
      if (onSoundPlay) {
        onSoundPlay('error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = async () => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    
    try {
      // This would typically call an API endpoint to generate the export
      const data = {
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at
        },
        profile: profile,
        export_date: new Date().toISOString()
      };

      const dataStr = JSON.stringify(data, null, 2);
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;

      const link = document.createElement('a');
      link.setAttribute('href', dataUri);
      link.setAttribute('download', `atlas-data-export-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (onSoundPlay) {
        onSoundPlay('success');
      }
      setSuccess('Data exported successfully!');
    } catch (error) {
      console.error('Data export error:', error);
      setError('Failed to export data');
      if (onSoundPlay) {
        onSoundPlay('error');
      }
    }
  };

  const handleDeleteAccount = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // This would typically call an API endpoint to delete the account
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      
      if (error) throw error;

      if (onSoundPlay) {
        onSoundPlay('success');
      }
      onLogout();
    } catch (error) {
      console.error('Account deletion error:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete account');
      if (onSoundPlay) {
        onSoundPlay('error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'privacy', label: 'Privacy', icon: FileText },
    { id: 'danger', label: 'Danger', icon: Trash2 },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <ProfileTab
            user={user}
            displayName={displayName}
            email={email}
            isLoading={isLoading}
            onDisplayNameChange={setDisplayName}
            onEmailChange={setEmail}
            onUpdateProfile={handleUpdateProfile}
          />
        );

      case 'security':
        return (
          <SecurityTab
            currentPassword={currentPassword}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            showPasswords={showPasswords}
            isLoading={isLoading}
            onCurrentPasswordChange={setCurrentPassword}
            onNewPasswordChange={setNewPassword}
            onConfirmPasswordChange={setConfirmPassword}
            onTogglePasswordVisibility={() => setShowPasswords(!showPasswords)}
            onChangePassword={handleChangePassword}
            onSoundPlay={onSoundPlay}
          />
        );

      case 'feedback':
        return (
          <FeedbackTab
            feedbackType={feedbackType}
            feedbackSubject={feedbackSubject}
            feedbackMessage={feedbackMessage}
            rating={rating}
            isLoading={isLoading}
            onFeedbackTypeChange={setFeedbackType}
            onSubjectChange={setFeedbackSubject}
            onMessageChange={setFeedbackMessage}
            onRatingChange={setRating}
            onSubmitFeedback={handleSubmitFeedback}
            onSoundPlay={onSoundPlay}
          />
        );

      case 'privacy':
        return (
          <PrivacyTab
            onExportData={handleExportData}
            onSoundPlay={onSoundPlay}
          />
        );

      case 'danger':
        return (
          <DangerTab
            deleteConfirmation={deleteConfirmation}
            showDeleteConfirm={showDeleteConfirm}
            isLoading={isLoading}
            onDeleteConfirmationChange={setDeleteConfirmation}
            onShowDeleteConfirm={setShowDeleteConfirm}
            onDeleteAccount={handleDeleteAccount}
            onLogout={onLogout}
            onSoundPlay={onSoundPlay}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-300 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row">
        {/* Sidebar - Vertical on desktop, horizontal tabs on mobile */}
        <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 p-4 md:p-6">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-xl font-bold text-gray-900">Account</h2>
            <button
              onClick={() => {
                if (onSoundPlay) {
                  onSoundPlay('modal_close');
                }
                onClose();
              }}
              className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Horizontal scrollable tabs on mobile, vertical tabs on desktop */}
          <div className="flex md:hidden overflow-x-auto pb-2 mb-2 gap-2 scrollbar-thin">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as TabType)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          
          {/* Vertical navigation for desktop */}
          <nav className="hidden md:flex flex-col space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as TabType)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Close button for desktop */}
          <div className="hidden md:flex justify-end p-4 border-b border-gray-200">
            <button
              onClick={() => {
                if (onSoundPlay) {
                  onSoundPlay('modal_close');
                }
                onClose();
              }}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content area */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto">
            {error && <ErrorMessage message={error} />}
            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 text-sm">{success}</p>
              </div>
            )}
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountModal;
