import { Bug, MessageSquare, Send, Star } from 'lucide-react';
import React from 'react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import type { SoundType } from '../../../hooks/useSoundEffects';

interface FeedbackTabProps {
  feedbackType: 'feedback' | 'bug' | 'review';
  feedbackSubject: string;
  feedbackMessage: string;
  rating: number;
  isLoading: boolean;
  onFeedbackTypeChange: (type: 'feedback' | 'bug' | 'review') => void;
  onSubjectChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onRatingChange: (rating: number) => void;
  onSubmitFeedback: () => void;
  onSoundPlay?: (soundType: SoundType) => void;
}

const FeedbackTab: React.FC<FeedbackTabProps> = ({
  feedbackType,
  feedbackSubject,
  feedbackMessage,
  rating,
  isLoading,
  onFeedbackTypeChange,
  onSubjectChange,
  onMessageChange,
  onRatingChange,
  onSubmitFeedback,
  onSoundPlay,
}) => {
  const feedbackTypes = [
    { id: 'feedback', label: 'General Feedback', icon: MessageSquare, description: 'Share your thoughts and suggestions' },
    { id: 'bug', label: 'Bug Report', icon: Bug, description: 'Report issues or unexpected behavior' },
    { id: 'review', label: 'Review', icon: Star, description: 'Rate your experience with Atlas' },
  ];

  const getIcon = (type: string) => {
    const feedbackTypeObj = feedbackTypes.find(t => t.id === type);
    return feedbackTypeObj ? feedbackTypeObj.icon : MessageSquare;
  };

  const Icon = getIcon(feedbackType);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Feedback</h3>
        
        <div className="space-y-4">
          {/* Feedback Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Feedback Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {feedbackTypes.map((type) => {
                const TypeIcon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => {
                      if (onSoundPlay) {
                        onSoundPlay('click');
                      }
                      onFeedbackTypeChange(type.id as 'feedback' | 'bug' | 'review');
                    }}
                    className={`p-4 rounded-lg border transition-colors text-left ${
                      feedbackType === type.id
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <TypeIcon className="w-5 h-5" />
                      <span className="font-medium">{type.label}</span>
                    </div>
                    <p className="text-sm text-gray-600">{type.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rating for reviews */}
          {feedbackType === 'review' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rating
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => {
                      if (onSoundPlay) {
                        onSoundPlay('click');
                      }
                      onRatingChange(star);
                    }}
                    className="text-2xl transition-colors"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= rating
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm text-gray-600">
                  {rating} out of 5 stars
                </span>
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={feedbackSubject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={`Enter ${feedbackType === 'review' ? 'review' : 'subject'} title`}
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              value={feedbackMessage}
              onChange={(e) => onMessageChange(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder={`Describe your ${feedbackType} in detail...`}
            />
            <p className="text-xs text-gray-500 mt-1">
              {feedbackMessage.length} characters
            </p>
          </div>

          {/* Submit Button */}
          <button
            onClick={onSubmitFeedback}
            disabled={isLoading || !feedbackSubject.trim() || !feedbackMessage.trim()}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <LoadingSpinner size="sm" color="white" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Submit {feedbackType === 'review' ? 'Review' : feedbackType === 'bug' ? 'Bug Report' : 'Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackTab;
