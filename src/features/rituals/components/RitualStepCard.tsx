/**
 * Ritual Step Card - Individual Ritual Display
 * Shows ritual info with goal badge, duration, and tier lock
 */

import { Edit2, Heart, Lock, Sparkles, Star, Target, Trash2, Zap } from 'lucide-react';
import React from 'react';
import { getDisplayPrice } from '../../../config/pricing';
import { formatDuration } from '../services/ritualTemplates';
import type { Ritual } from '../types/rituals';

interface RitualStepCardProps {
  ritual: Ritual;
  userTier: 'free' | 'core' | 'studio';
  onStart: (ritual: Ritual) => void;
  onPreview?: (ritual: Ritual) => void;
  onEdit?: (ritual: Ritual) => void; // Edit custom ritual
  onDelete?: (ritual: Ritual) => void; // Delete custom ritual
  isCustom?: boolean; // Flag to show edit/delete buttons
  isFavorite?: boolean;
  onToggleFavorite?: (ritualId: string) => void;
}

const goalIcons = {
  energy: Zap,
  calm: Heart,
  focus: Target,
  creativity: Sparkles,
};

const goalColors = {
  energy: 'text-orange-600 bg-orange-50',
  calm: 'text-blue-600 bg-blue-50',
  focus: 'text-purple-600 bg-purple-50',
  creativity: 'text-pink-600 bg-pink-50',
};

export const RitualStepCard: React.FC<RitualStepCardProps> = React.memo(({
  ritual,
  userTier,
  onStart,
  onPreview,
  onEdit,
  onDelete,
  isCustom = false,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const Icon = goalIcons[ritual.goal];
  const totalDuration = React.useMemo(
    () => ritual.steps.reduce((sum, step) => sum + step.duration, 0),
    [ritual.steps]
  );
  const isLocked = ritual.tierRequired !== 'free' && userTier === 'free';

  const handleClick = () => {
    if (isLocked) {
      // Trigger upgrade modal
      onPreview?.(ritual);
    } else {
      onStart(ritual);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    onEdit?.(ritual);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    onDelete?.(ritual);
  };

  return (
    <div
      onClick={handleClick}
      className={`
        relative w-full p-6 rounded-2xl border-2 transition-all duration-200
        min-h-[120px] touch-manipulation cursor-pointer
        ${
          isLocked
            ? 'border-gray-200 bg-gray-50 hover:border-gray-300 active:scale-[0.98]'
            : 'border-[#E8DCC8] bg-white hover:border-[#D4C4A8] hover:shadow-lg active:scale-[0.98]'
        }
      `}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Top Right Actions/Badges */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {/* Favorite Button */}
        {!isLocked && onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(ritual.id);
            }}
            className={`p-2 rounded-lg border transition-all active:scale-95 min-h-[36px] min-w-[36px] ${
              isFavorite
                ? 'bg-yellow-50 border-yellow-300 text-yellow-600 hover:bg-yellow-100'
                : 'bg-white/80 border-[#E8DCC8] text-gray-400 hover:bg-white hover:text-gray-600'
            }`}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}

        {/* Edit Button */}
        {isCustom && !isLocked && onEdit && (
          <button
            onClick={handleEdit}
            className="p-2 rounded-lg bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 border border-[#E8DCC8] dark:border-gray-700 
              transition-all hover:shadow-md active:scale-95
              min-h-[36px] min-w-[36px]"
            aria-label="Edit ritual"
          >
            <Edit2 size={16} className="text-[#8B7E74]" />
          </button>
        )}

        {/* Delete Button */}
        {isCustom && !isLocked && onDelete && (
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg bg-red-50/80 hover:bg-red-100 border border-red-200 
              transition-all hover:shadow-md active:scale-95
              min-h-[36px] min-w-[36px]"
            aria-label="Delete ritual"
          >
            <Trash2 size={16} className="text-red-600" />
          </button>
        )}

        {/* Lock Badge */}
        {isLocked && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-200 text-gray-600 text-xs font-medium">
            <Lock size={12} />
            <span>{ritual.tierRequired === 'core' ? 'Core' : 'Studio'}</span>
          </div>
        )}
      </div>

      {/* Goal Icon */}
      <div
        className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 ${
          goalColors[ritual.goal]
        }`}
      >
        <Icon size={24} />
      </div>

      {/* Title */}
      <h3
        className={`text-lg font-semibold mb-2 text-left ${
          isLocked ? 'text-gray-500' : 'text-[#3B3632]'
        }`}
      >
        {ritual.title}
      </h3>

      {/* Steps Count + Duration */}
      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
        <span>{ritual.steps.length} steps</span>
        <span>•</span>
        <span>{formatDuration(totalDuration)}</span>
      </div>

      {/* Goal Badge */}
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`px-3 py-1 rounded-full ${goalColors[ritual.goal]} font-medium capitalize`}
        >
          {ritual.goal}
        </span>
      </div>

      {/* Locked Overlay Message */}
      {isLocked && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-left">
            Upgrade to {ritual.tierRequired === 'core' ? `Core (${getDisplayPrice('core')})` : `Studio (${getDisplayPrice('studio')})`} to
            unlock
          </p>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  return (
    prevProps.ritual.id === nextProps.ritual.id &&
    prevProps.ritual.updatedAt === nextProps.ritual.updatedAt &&
    prevProps.userTier === nextProps.userTier &&
    prevProps.isCustom === nextProps.isCustom
  );
});

