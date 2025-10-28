/**
 * Ritual Step Card - Individual Ritual Display
 * Shows ritual info with goal badge, duration, and tier lock
 */

import { Edit2, Heart, Lock, Sparkles, Target, Trash2, Zap } from 'lucide-react';
import React from 'react';
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

export const RitualStepCard: React.FC<RitualStepCardProps> = ({
  ritual,
  userTier,
  onStart,
  onPreview,
  onEdit,
  onDelete,
  isCustom = false,
}) => {
  const Icon = goalIcons[ritual.goal];
  const totalDuration = ritual.steps.reduce((sum, step) => sum + step.duration, 0);
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
    <button
      onClick={handleClick}
      className={`
        relative w-full p-6 rounded-2xl border-2 transition-all duration-200
        min-h-[120px] touch-manipulation
        ${
          isLocked
            ? 'border-gray-200 bg-gray-50 cursor-pointer hover:border-gray-300 active:scale-[0.98]'
            : 'border-[#E8DCC8] bg-white hover:border-[#D4C4A8] hover:shadow-lg cursor-pointer active:scale-[0.98]'
        }
      `}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Lock Badge */}
      {isLocked && (
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-200 text-gray-600 text-xs font-medium">
            <Lock size={12} />
            <span>{ritual.tierRequired === 'core' ? 'Core' : 'Studio'}</span>
          </div>
        </div>
      )}

      {/* Edit & Delete Buttons for Custom Rituals */}
      {isCustom && !isLocked && (onEdit || onDelete) && (
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {/* Edit Button */}
          {onEdit && (
            <button
              onClick={handleEdit}
              className="p-2 rounded-lg bg-white/80 hover:bg-white border border-[#E8DCC8] 
                transition-all hover:shadow-md active:scale-95
                min-h-[36px] min-w-[36px]" // Touch-friendly
              aria-label="Edit ritual"
            >
              <Edit2 size={16} className="text-[#8B7E74]" />
            </button>
          )}

          {/* Delete Button */}
          {onDelete && (
            <button
              onClick={handleDelete}
              className="p-2 rounded-lg bg-red-50/80 hover:bg-red-100 border border-red-200 
                transition-all hover:shadow-md active:scale-95
                min-h-[36px] min-w-[36px]" // Touch-friendly
              aria-label="Delete ritual"
            >
              <Trash2 size={16} className="text-red-600" />
            </button>
          )}
        </div>
      )}

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
            Upgrade to {ritual.tierRequired === 'core' ? 'Core ($19.99)' : 'Studio ($189.99)'} to
            unlock
          </p>
        </div>
      )}
    </button>
  );
};

