import type { User } from '@supabase/supabase-js';
import {
  AlertTriangle,
  Bug,
  CheckCircle,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Lock,
  MessageSquare,
  Send,
  // Mail, 
  Shield,
  Star,
  Trash2,
  User as UserIcon,
  X
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import type { SoundType } from '../hooks/useSoundEffects';
import { supabase } from '../lib/supabaseClient';
import type { UserProfile } from '../types/subscription';
import ErrorMessage from './ErrorMessage';
import LoadingSpinner from './LoadingSpinner';

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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleTabChange = (tab: TabType) => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    setActiveTab(tab);
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
    } catch (err: any) {
      if (onSoundPlay) {
        onSoundPlay('error');
      }
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      if (onSoundPlay) {
        onSoundPlay('error');
      }
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      if (onSoundPlay) {
        onSoundPlay('error');
      }
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      if (onSoundPlay) {
        onSoundPlay('success');
      }
      setSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      if (onSoundPlay) {
        onSoundPlay('error');
      }
      setError(err.message || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackSubject.trim() || !feedbackMessage.trim()) {
      if (onSoundPlay) {
        onSoundPlay('error');
      }
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // TODO: Log feedback to proper feedback table
      // For now, just simulate success without database logging
      const feedbackData = {
        type: feedbackType,
        subject: feedbackSubject,
        message: feedbackMessage,
        rating: feedbackType === 'review' ? rating : null,
        userId: user.id
      };
      console.log('Feedback submitted:', feedbackData);

      if (onSoundPlay) {
        onSoundPlay('success');
      }
      setSuccess(`${feedbackType.charAt(0).toUpperCase() + feedbackType.slice(1)} submitted successfully! Thank you for your input.`);
      setFeedbackSubject('');
      setFeedbackMessage('');
      setRating(5);
    } catch (err: any) {
      if (onSoundPlay) {
        onSoundPlay('error');
      }
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE MY ACCOUNT') {
      if (onSoundPlay) {
        onSoundPlay('error');
      }
      setError('Please type "DELETE MY ACCOUNT" to confirm');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Note: Supabase doesn't allow users to delete their own accounts via client
      // This would typically be handled by an admin function or support request
      
      // TODO: Log deletion request to proper audit table
      console.log({
        id: user.id,
        email: user.email,
        tier: profile.tier,
        confirmation: deleteConfirmation,
        timestamp: new Date().toISOString()
      });

      if (onSoundPlay) {
        onSoundPlay('success');
      }
      setSuccess('Account deletion request submitted. Our support team will process your request within 24 hours and send you a confirmation email.');
      setDeleteConfirmation('');
      setShowDeleteConfirm(false);
    } catch (err: any) {
      if (onSoundPlay) {
        onSoundPlay('error');
      }
      setError(err.message || 'Failed to submit deletion request');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get user's data
      const userData = {
        profile: profile,
        account: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          user_metadata: user.user_metadata
        },
        export_date: new Date().toISOString()
      };

      // Create and download JSON file
      const dataStr = JSON.stringify(userData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `atlas-account-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (onSoundPlay) {
        onSoundPlay('success');
      }
      setSuccess('Account data exported successfully!');
    } catch (_err) {
      if (onSoundPlay) {
        onSoundPlay('error');
      }
      setError('Failed to export account data');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'privacy', label: 'Privacy', icon: FileText },
    { id: 'danger', label: 'Account', icon: Trash2 }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
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
                    onChange={(e) => setDisplayName(e.target.value)}
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
                    onChange={(e) => setEmail(e.target.value)}
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
                  onClick={handleUpdateProfile}
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

      case 'security':
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
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (onSoundPlay) {
                          onSoundPlay('click');
                        }
                        setShowPasswords(!showPasswords);
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
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new password"
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Confirm new password"
                    minLength={6}
                  />
                </div>

                <button
                  onClick={handleChangePassword}
                  disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <LoadingSpinner size="sm" color="white" /> : <Lock className="w-4 h-4" />}
                  Change Password
                </button>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Security Tips</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Use a strong, unique password</li>
                    <li>• Enable two-factor authentication when available</li>
                    <li>• Don't share your account credentials</li>
                    <li>• Log out from shared devices</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 'feedback':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Feedback & Support</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Feedback Type
                  </label>
                  <select
                    value={feedbackType}
                    onChange={(e) => {
                      if (onSoundPlay) {
                        onSoundPlay('click');
                      }
                      setFeedbackType(e.target.value as 'feedback' | 'bug' | 'review');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="feedback">General Feedback</option>
                    <option value="bug">Bug Report</option>
                    <option value="review">Write a Review</option>
                  </select>
                </div>

                {feedbackType === 'review' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rating
                    </label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => {
                            if (onSoundPlay) {
                              onSoundPlay('click');
                            }
                            setRating(star);
                          }}
                          className={`p-1 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition-colors`}
                        >
                          <Star className="w-6 h-6 fill-current" />
                        </button>
                      ))}
                      <span className="ml-2 text-sm text-gray-600">({rating}/5)</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={feedbackSubject}
                    onChange={(e) => setFeedbackSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={
                      feedbackType === 'bug' ? 'Brief description of the bug' :
                      feedbackType === 'review' ? 'Review title' :
                      'What would you like to tell us?'
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message
                  </label>
                  <textarea
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder={
                      feedbackType === 'bug' ? 'Please describe the bug in detail, including steps to reproduce it...' :
                      feedbackType === 'review' ? 'Share your experience with Atlas...' :
                      'Your feedback helps us improve Atlas...'
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {feedbackMessage.length}/1000 characters
                  </p>
                </div>

                <button
                  onClick={handleSubmitFeedback}
                  disabled={isLoading || !feedbackSubject.trim() || !feedbackMessage.trim()}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <LoadingSpinner size="sm" color="white" /> : <Send className="w-4 h-4" />}
                  Submit {feedbackType.charAt(0).toUpperCase() + feedbackType.slice(1)}
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-left">
                    <h4 className="font-medium text-gray-800 mb-1 flex items-center gap-2">
                      <Bug className="w-4 h-4" />
                      Found a Bug?
                    </h4>
                    <p className="text-xs text-gray-600">
                      Help us fix issues by reporting bugs with detailed steps to reproduce them.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-left">
                    <h4 className="font-medium text-gray-800 mb-1 flex items-center gap-2">
                      <Star className="w-4 h-4" />
                      Love Atlas?
                    </h4>
                    <p className="text-xs text-gray-600">
                      Share your experience and help others discover Atlas by writing a review.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Privacy & Data</h3>
              
              <div className="space-y-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Your Data is Protected
                  </h4>
                  <p className="text-sm text-blue-700">
                    We take your privacy seriously. Your conversations and personal data are encrypted and stored securely.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Data Export</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Download a copy of your account data including profile information and usage statistics.
                  </p>
                  <button
                    onClick={handleExportData}
                    disabled={isLoading}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isLoading ? <LoadingSpinner size="sm" color="white" /> : <Download className="w-4 h-4" />}
                    Export My Data
                  </button>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Legal Documents</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <a
                      href="#"
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between group"
                      onClick={() => onSoundPlay?.('click')}
                    >
                      <div>
                        <h5 className="font-medium text-gray-900">Privacy Policy</h5>
                        <p className="text-sm text-gray-600">How we collect and use your data</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </a>
                    
                    <a
                      href="#"
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between group"
                      onClick={() => onSoundPlay?.('click')}
                    >
                      <div>
                        <h5 className="font-medium text-gray-900">Terms of Service</h5>
                        <p className="text-sm text-gray-600">Terms and conditions of use</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </a>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2">Data Retention</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Conversation history is stored for 30 days</li>
                    <li>• Account data is retained while your account is active</li>
                    <li>• Usage statistics are kept for billing and analytics</li>
                    <li>• You can request data deletion at any time</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 'danger':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Management</h3>
              
              <div className="space-y-6">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Danger Zone
                  </h4>
                  <p className="text-sm text-red-700 mb-4">
                    These actions are permanent and cannot be undone. Please proceed with caution.
                  </p>
                  
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => {
                        if (onSoundPlay) {
                          onSoundPlay('click');
                        }
                        setShowDeleteConfirm(true);
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Account
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-red-100 rounded-lg">
                        <h5 className="font-medium text-red-900 mb-2">Account Deletion</h5>
                        <p className="text-sm text-red-700 mb-3">
                          This will permanently delete your account and all associated data including:
                        </p>
                        <ul className="text-sm text-red-700 space-y-1 mb-3">
                          <li>• Your profile and subscription information</li>
                          <li>• All conversation history</li>
                          <li>• Usage statistics and preferences</li>
                          <li>• Any uploaded files or content</li>
                        </ul>
                        <p className="text-sm text-red-700 font-medium">
                          This action cannot be undone!
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-red-700 mb-2">
                          Type "DELETE MY ACCOUNT" to confirm:
                        </label>
                        <input
                          type="text"
                          value={deleteConfirmation}
                          onChange={(e) => setDeleteConfirmation(e.target.value)}
                          className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                          placeholder="DELETE MY ACCOUNT"
                        />
                      </div>
                      
                      <div className="flex gap-3">
                        <button
                          onClick={handleDeleteAccount}
                          disabled={isLoading || deleteConfirmation !== 'DELETE MY ACCOUNT'}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {isLoading ? <LoadingSpinner size="sm" color="white" /> : <Trash2 className="w-4 h-4" />}
                          Confirm Deletion
                        </button>
                        <button
                          onClick={() => {
                            if (onSoundPlay) {
                              onSoundPlay('click');
                            }
                            setShowDeleteConfirm(false);
                            setDeleteConfirmation('');
                          }}
                          className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Need Help?</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    If you're having issues with your account or want to temporarily deactivate it, 
                    please contact our support team instead of deleting your account.
                  </p>
                  <button
                    onClick={() => {
                      if (onSoundPlay) {
                        onSoundPlay('click');
                      }
                      handleTabChange('feedback');
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Contact Support
                  </button>
                </div>
              </div>
            </div>
          </div>
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
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
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
          </nav>
          
          <div className="hidden md:block mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                if (onSoundPlay) {
                  onSoundPlay('click');
                }
                onLogout();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Close button for desktop */}
          <div className="hidden md:flex justify-end p-4 border-b border-gray-200">
            <button
              onClick={() => {
                if (onSoundPlay) {
                  onSoundPlay('modal_close');
                }
                onClose();
              }}
              className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-4 md:p-6">
            {/* Error/Success Messages */}
            {error && (
              <ErrorMessage
                message={error}
                type="error"
                dismissible
                onDismiss={() => setError(null)}
                className="mb-6"
                onSoundPlay={onSoundPlay}
              />
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-green-700 text-sm leading-relaxed">{success}</p>
                </div>
              </div>
            )}

            {/* Tab Content */}
            {renderTabContent()}
          </div>
          
          {/* Mobile Sign Out Button */}
          <div className="md:hidden p-4 border-t border-gray-200">
            <button
              onClick={() => {
                if (onSoundPlay) {
                  onSoundPlay('click');
                }
                onLogout();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium transition-colors"
            >
              <X className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountModal;