/**
 * 🧘 Ritual Run View - Ritual Execution Interface
 * Displays current step, timer, progress, and mood tracking
 */

import { atlasDB } from '@/database/atlasDB';
import { useMobileOptimization } from '@/hooks/useMobileOptimization';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { supabase } from '@/lib/supabaseClient';
import { ensureConversationExists } from '@/services/conversationGuard';
import { generateUUID } from '@/utils/uuid';
import { ArrowLeft, ChevronLeft, ChevronRight, MessageCircle, Pause, Play, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { modernToast } from '../../../config/toastConfig';
import { logger } from '../../../lib/logger';
import { useRitualRunner } from '../hooks/useRitualRunner';
import { useRitualStore } from '../hooks/useRitualStore';
import { MOOD_OPTIONS, type Ritual } from '../types/rituals';
import { RitualRewardModal } from './RitualRewardModal';

export const RitualRunView: React.FC = () => {
  const navigate = useNavigate();
  const { ritualId } = useParams<{ ritualId: string }>();
  const { user } = useSupabaseAuth();
  const { presets, userRituals, loading } = useRitualStore();
  const { isMobile } = useMobileOptimization();

  const [selectedMoodBefore, setSelectedMoodBefore] = useState<string | null>(null);
  const [selectedMoodAfter, setSelectedMoodAfter] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  
  // ✨ NEW: Reward modal state
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [completedRitualData, setCompletedRitualData] = useState<{
    title: string;
    durationMinutes: number;
    moodBefore: string;
    moodAfter: string;
    reflection: string;
  } | null>(null);

  // Swipe gesture support
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const stepCardRef = useRef<HTMLDivElement>(null);

  // Find ritual
  const ritual = [...presets, ...userRituals].find((r) => r.id === ritualId);

  const runner = useRitualRunner({
    ritual: ritual,
    userId: user?.id || '',
  });

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const swipeThreshold = 50; // Minimum distance for swipe
    const diff = touchStartX.current - touchEndX.current;

    if (Math.abs(diff) > swipeThreshold) {
      // Haptic feedback if supported
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }

      if (diff > 0) {
        // Swipe left - next step
        if (runner.currentStepIndex < ritual!.steps.length - 1) {
          runner.nextStep();
        }
      } else {
        // Swipe right - previous step
        if (runner.currentStepIndex > 0) {
          runner.previousStep();
        }
      }
    }

    // Reset
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  // Haptic feedback on step completion
  useEffect(() => {
    if (runner.isComplete && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]); // Double vibration
    }
  }, [runner.isComplete]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F5F0E8] to-[#E8DDD2] flex items-center justify-center">
        <div className="text-[#8B7E74] text-lg">Loading ritual...</div>
      </div>
    );
  }

  if (!ritual) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F5F0E8] to-[#E8DDD2] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#3B3632] text-xl font-semibold mb-4">Ritual not found</div>
          <button
            onClick={() => navigate('/rituals')}
            className="px-6 py-2 bg-[#C8956A] text-white rounded-lg hover:bg-[#B8855A] transition-colors"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  // Format time (mm:ss)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle start ritual
  const handleStart = async () => {
    if (!selectedMoodBefore) return;
    runner.start(selectedMoodBefore);
    setHasStarted(true);
    
    // ✅ Save as last ritual for quick start
    try {
      await supabase
        .from('profiles')
        .update({ last_ritual_id: ritualId } as any)
        .eq('id', user?.id!);
    } catch (error) {
      logger.debug('[RitualRunView] Failed to save last ritual:', error);
    }
  };

  // Handle complete ritual
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleComplete = async () => {
    if (!selectedMoodAfter || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      // Complete the ritual (saves to database)
      await runner.complete(selectedMoodAfter, completionNotes);
      
      // ✨ Show reward modal immediately (non-blocking)
      setCompletedRitualData({
        title: ritual!.title,
        durationMinutes: Math.ceil(runner.totalDuration / 60),
        moodBefore: selectedMoodBefore!,
        moodAfter: selectedMoodAfter,
        reflection: completionNotes,
      });
      setShowRewardModal(true);
      
      // 🎯 POST RITUAL COMPLETION SUMMARY TO CHAT (async, non-blocking)
      postRitualSummaryToChat(ritual!, selectedMoodBefore!, selectedMoodAfter, completionNotes, runner.totalDuration)
        .catch(err => logger.error('[RitualRunView] Failed to post to chat:', err));
      
    } catch (error) {
      logger.error('[RitualRunView] Failed to complete ritual:', error);
      modernToast.error('Failed to save ritual completion');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✨ Helper: Post ritual completion summary as a chat message
  const postRitualSummaryToChat = async (
    ritual: Ritual,
    moodBefore: string,
    moodAfter: string,
    notes: string,
    durationSeconds: number
  ) => {
    try {
      // Get or create active conversation
      let conversationId: string;
      
      // Check Supabase first for existing conversation
      const { data: existingConvos, error: fetchError } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (fetchError) {
        logger.error('[RitualRunView] Failed to fetch conversations:', fetchError);
      }
      
      if (existingConvos && existingConvos.length > 0 && existingConvos[0]?.id) {
        conversationId = existingConvos[0].id;
      } else {
        // Create new conversation ID and ensure it exists
        conversationId = generateUUID();
        const created = await ensureConversationExists(conversationId, user!.id);
        
        if (!created) {
          logger.error('[RitualRunView] Failed to create conversation');
          return; // Exit early if we can't create conversation
        }
      }
      
      // Find mood emojis
      const moodBeforeEmoji = MOOD_OPTIONS.find((m) => m.value === moodBefore)?.emoji || '😐';
      const moodAfterEmoji = MOOD_OPTIONS.find((m) => m.value === moodAfter)?.emoji || '😊';
      const minutes = Math.floor(durationSeconds / 60);
      
      // Format completion summary
      const summaryContent = `## 🧘 Ritual Complete: ${ritual.title}

**Time:** ${minutes} minutes
**Mood Journey:** ${moodBeforeEmoji} ${moodBefore} → ${moodAfterEmoji} ${moodAfter}

${notes ? `**Reflection:** ${notes}\n\n` : ''}✨ Great work! Your ritual is logged and ready for insights.`;
      
      // Create message object
      const message = {
        id: generateUUID(), // Standard UUID
        conversationId,
        userId: user!.id,
        role: 'assistant' as const,
        type: 'text' as const,
        content: summaryContent,
        timestamp: new Date().toISOString(),
        synced: false,
        updatedAt: new Date().toISOString(),
        attachments: undefined,
        deletedAt: undefined,
        deletedBy: undefined,
      };
      
      // Save to Dexie (local) first
      await atlasDB.messages.put(message);
      
      // ✅ CRITICAL FIX: Ensure conversation exists before creating message
      if (user?.id) {
        const conversationExists = await ensureConversationExists(
          conversationId,
          user.id,
          message.timestamp
        );
        
        if (conversationExists) {
          // Sync to Supabase (using type assertion for compatibility)
          const { error } = await supabase.from('messages').insert({
            id: message.id,
            conversation_id: conversationId,
            user_id: user.id,
            role: 'assistant',
            content: summaryContent,
            created_at: message.timestamp,
          } as any); // Type assertion to bypass Supabase type issues
          
          if (error) {
            logger.error('[RitualRunView] Supabase insert error:', error);
          }
        } else {
          logger.error('[RitualRunView] Cannot sync message - conversation creation failed:', {
            conversationId,
            userId: user.id
          });
        }
      }
      
      // Update conversation updatedAt
      await atlasDB.conversations.update(conversationId, {
        updatedAt: new Date().toISOString(),
      });
      
    } catch (error) {
      logger.error('[RitualRunView] Failed to post ritual summary to chat:', error);
      // Don't throw - completion should still work even if chat post fails
    }
  };

  // Handle exit (with confirmation if in progress)
  const handleExit = () => {
    if (hasStarted && !runner.isComplete) {
      if (confirm('Are you sure you want to exit? Your progress will be lost.')) {
        navigate('/rituals');
      }
    } else {
      navigate('/rituals');
    }
  };

  // PRE-RITUAL: Mood selection
  if (!hasStarted) {
    return (
      <div className="h-screen overflow-y-auto bg-gradient-to-br from-[#F5F0E8] to-[#E8DDD2] p-6 overscroll-contain">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={handleExit}
                className="p-2 rounded-lg hover:bg-white/50 transition-colors"
                aria-label="Back to library"
              >
                <ArrowLeft className="w-6 h-6 text-[#3B3632]" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-[#3B3632]">{ritual.title}</h1>
                <p className="text-[#8B7E74]">
                  {ritual.steps.length} steps • {Math.ceil(ritual.steps.reduce((sum, step) => sum + step.duration, 0) / 60)} min
                </p>
              </div>
            </div>

            {/* Back to Chat Button - Mobile Optimized */}
            <button
              onClick={() => navigate('/chat')}
              className="flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-white border-2 border-[#E8DCC8] 
                rounded-xl transition-all hover:shadow-md active:scale-95
                min-h-[44px] touch-manipulation" // 44px minimum touch target
              aria-label="Back to chat"
            >
              <MessageCircle className="w-5 h-5 text-[#8B7E74]" />
              <span className="hidden sm:inline text-[#3B3632] font-medium">Chat</span>
            </button>
          </div>

          {/* Mood Selection - Mobile Optimized */}
          <div className="bg-white/80 rounded-2xl p-4 sm:p-6 md:p-8 shadow-lg safe-area-inset">
            {/* Animated Mood Display */}
            <div className="flex flex-col items-center mb-6 sm:mb-8 py-4 sm:py-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-[#3B3632] mb-4 sm:mb-6 text-center px-2">
                How Do You Feel Today?
              </h2>
              
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 flex items-center justify-center mb-4">
                {/* Animated ripples */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 opacity-20 animate-ripple" />
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-50 to-purple-50 opacity-40 animate-ripple" style={{ animationDelay: '0.5s' }} />
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-purple-50 to-pink-50 opacity-30 animate-ripple" style={{ animationDelay: '1s' }} />
                
                {/* Main animated emoji */}
                <div 
                  key={selectedMoodBefore || 'default'}
                  className="text-6xl sm:text-7xl md:text-8xl transform animate-bounce-in z-10"
                >
                  {MOOD_OPTIONS.find(m => m.value === selectedMoodBefore)?.emoji || '😐'}
                </div>
              </div>
              
              <p className="text-base sm:text-lg md:text-xl font-medium text-[#8B7E74] transition-all duration-300 text-center px-2">
                {MOOD_OPTIONS.find(m => m.value === selectedMoodBefore)?.label || 'Select your mood below'}
              </p>
            </div>

            {/* Mood Grid - Mobile Optimized */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {MOOD_OPTIONS.map((mood) => (
                <button
                  key={mood.value}
                  onClick={() => {
                    setSelectedMoodBefore(mood.value);
                    // Haptic feedback on mobile
                    if (navigator.vibrate) navigator.vibrate(10);
                  }}
                  className={`mood-button p-4 sm:p-5 rounded-xl ${mood.color} border-2 
                    min-h-[110px] sm:min-h-[120px] md:min-h-[130px] touch-manipulation
                    transition-all duration-200 active:scale-95
                    focus:outline-none focus:ring-2 focus:ring-[#C8956A] focus:ring-offset-2
                    ${selectedMoodBefore === mood.value
                      ? 'mood-button-selected border-[#C8956A] shadow-md scale-[1.02]'
                      : 'border-transparent hover:border-gray-300 hover:shadow-sm'
                  }`}
                  aria-label={`Select ${mood.label} mood`}
                  aria-pressed={selectedMoodBefore === mood.value}
                >
                  <div className="text-5xl sm:text-4xl md:text-3xl mb-2 flex items-center justify-center">{mood.emoji}</div>
                  <div className="text-sm sm:text-base font-medium text-[#3B3632] text-center">{mood.label}</div>
                </button>
              ))}
            </div>

            <button
              onClick={handleStart}
              disabled={!selectedMoodBefore}
              className="mt-6 sm:mt-8 w-full py-4 bg-[#C8956A] text-white rounded-xl font-semibold text-base sm:text-lg
                hover:bg-[#B8855A] disabled:opacity-50 disabled:cursor-not-allowed transition-all
                min-h-[56px] sm:min-h-[60px] touch-manipulation active:scale-95
                focus:outline-none focus:ring-2 focus:ring-[#C8956A] focus:ring-offset-2"
              aria-label="Begin ritual"
            >
              Begin Ritual ✨
            </button>
          </div>
        </div>
      </div>
    );
  }

  // POST-RITUAL: Completion screen
  if (runner.isComplete) {
    return (
      <div className="h-screen overflow-y-auto bg-gradient-to-br from-[#F5F0E8] to-[#E8DDD2] p-6 overscroll-contain">
        <div className="max-w-2xl mx-auto">
          {/* Celebration Header */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-[#3B3632] mb-2">Ritual Complete!</h1>
            <p className="text-[#8B7E74]">Great work completing {ritual.title}</p>
          </div>

          {/* Mood After Selection - Mobile Optimized */}
          <div className="bg-white/80 rounded-2xl p-4 sm:p-6 md:p-8 shadow-lg mb-4 safe-area-inset">
            {/* Animated Mood Display */}
            <div className="flex flex-col items-center mb-6 sm:mb-8 py-4 sm:py-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-[#3B3632] mb-4 sm:mb-6 text-center px-2">
                How Do You Feel Now?
              </h2>
              
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 flex items-center justify-center mb-4">
                {/* Animated ripples */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-100 to-teal-100 opacity-20 animate-ripple" />
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-50 to-teal-50 opacity-40 animate-ripple" style={{ animationDelay: '0.5s' }} />
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-teal-50 to-emerald-50 opacity-30 animate-ripple" style={{ animationDelay: '1s' }} />
                
                {/* Main animated emoji */}
                <div 
                  key={selectedMoodAfter || 'default'}
                  className="text-6xl sm:text-7xl md:text-8xl transform animate-bounce-in z-10"
                >
                  {MOOD_OPTIONS.find(m => m.value === selectedMoodAfter)?.emoji || '😊'}
                </div>
              </div>
              
              <p className="text-base sm:text-lg md:text-xl font-medium text-[#8B7E74] transition-all duration-300 text-center px-2">
                {MOOD_OPTIONS.find(m => m.value === selectedMoodAfter)?.label || 'Select your current mood'}
              </p>
            </div>

            {/* Mood Grid - Mobile Optimized */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
              {MOOD_OPTIONS.map((mood) => (
                <button
                  key={mood.value}
                  onClick={() => {
                    setSelectedMoodAfter(mood.value);
                    // Haptic feedback on mobile
                    if (navigator.vibrate) navigator.vibrate(10);
                  }}
                  className={`mood-button p-4 sm:p-5 rounded-xl ${mood.color} border-2 
                    min-h-[110px] sm:min-h-[120px] md:min-h-[130px] touch-manipulation
                    transition-all duration-200 active:scale-95
                    focus:outline-none focus:ring-2 focus:ring-[#C8956A] focus:ring-offset-2
                    ${selectedMoodAfter === mood.value
                      ? 'mood-button-selected border-[#C8956A] shadow-md scale-[1.02]'
                      : 'border-transparent hover:border-gray-300 hover:shadow-sm'
                  }`}
                  aria-label={`Select ${mood.label} mood`}
                  aria-pressed={selectedMoodAfter === mood.value}
                >
                  <div className="text-5xl sm:text-4xl md:text-3xl mb-2 flex items-center justify-center">{mood.emoji}</div>
                  <div className="text-sm sm:text-base font-medium text-[#3B3632] text-center">{mood.label}</div>
                </button>
              ))}
            </div>

            {/* Optional Notes */}
            <textarea
              placeholder="Any reflections or notes? (optional)"
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              className="w-full p-4 rounded-xl border border-[#E8DDD2] bg-white/50 text-[#3B3632]
                placeholder-[#8B7E74]/50 focus:outline-none focus:ring-2 focus:ring-[#C8956A] focus:ring-offset-2
                min-h-[100px] sm:min-h-[80px] text-base resize-none"
              rows={3}
              aria-label="Completion notes (optional)"
            />

            <button
              onClick={handleComplete}
              disabled={!selectedMoodAfter || isSubmitting}
              className="mt-4 w-full py-4 bg-[#C8956A] text-white rounded-xl font-semibold text-base sm:text-lg
                hover:bg-[#B8855A] disabled:opacity-50 disabled:cursor-not-allowed transition-all
                min-h-[56px] sm:min-h-[60px] touch-manipulation active:scale-95
                focus:outline-none focus:ring-2 focus:ring-[#C8956A] focus:ring-offset-2"
              aria-label="Complete ritual"
            >
              {isSubmitting ? 'Saving...' : 'Complete Ritual ✨'}
            </button>
          </div>

          <button
            onClick={() => navigate('/rituals')}
            className="w-full py-3 text-[#8B7E74] hover:text-[#3B3632] transition-colors"
          >
            Back to Library
          </button>
        </div>

        {/* ✨ Reward Modal - Show after completion */}
        {completedRitualData && (
          <RitualRewardModal
            isOpen={showRewardModal}
            onClose={() => {
              setShowRewardModal(false);
              navigate('/chat'); // Navigate to chat on close
            }}
            ritualData={{
              title: completedRitualData.title,
              durationMinutes: completedRitualData.durationMinutes,
              moodBefore: completedRitualData.moodBefore,
              moodAfter: completedRitualData.moodAfter,
              reflection: completedRitualData.reflection,
            }}
            onViewInsights={() => {
              setShowRewardModal(false);
              navigate('/ritual-insights'); // ✅ FIX: Navigate to insights page
            }}
            onStartAnother={() => {
              setShowRewardModal(false);
              navigate('/rituals');
            }}
          />
        )}
      </div>
    );
  }

  // DURING RITUAL: Timer + Step Display
  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-[#F5F0E8] to-[#E8DDD2] p-4 md:p-6
      landscape:flex landscape:items-center landscape:py-4 overscroll-contain">
      <div className="max-w-4xl mx-auto w-full 
        landscape:flex landscape:flex-row landscape:gap-6 landscape:items-start">
        {/* Header - Hide in landscape to save space */}
        <div className="flex items-center justify-between mb-6 md:mb-8 landscape:hidden">
          <div className="flex items-center gap-4">
            <button
              onClick={handleExit}
              className="p-2 rounded-lg hover:bg-white/50 transition-colors
                min-w-[44px] min-h-[44px] touch-manipulation"
              aria-label="Exit ritual"
            >
              <X className="w-6 h-6 text-[#3B3632]" />
            </button>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-[#3B3632]">{ritual.title}</h1>
              <p className="text-xs md:text-sm text-[#8B7E74]">
                Step {runner.currentStepIndex + 1} of {ritual.steps.length}
              </p>
            </div>
          </div>

          {/* Back to Chat Button - Mobile Optimized */}
          <button
            onClick={() => navigate('/chat')}
            className="flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-white border-2 border-[#E8DCC8] 
              rounded-xl transition-all hover:shadow-md active:scale-95
              min-h-[44px] touch-manipulation"
            aria-label="Back to chat"
          >
            <MessageCircle className="w-5 h-5 text-[#8B7E74]" />
            <span className="hidden sm:inline text-[#3B3632] font-medium">Chat</span>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-6 md:mb-8 landscape:hidden">
          <div className="h-2 bg-white/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#C8956A] transition-all duration-1000"
              style={{ width: `${runner.progress}%` }}
            />
          </div>
          <div className="text-right text-sm text-[#8B7E74] mt-2">{runner.progress}% Complete</div>
        </div>

        {/* Current Step Card - With Swipe Gestures */}
        <div 
          ref={stepCardRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="bg-white/80 rounded-2xl p-6 md:p-8 shadow-lg mb-6
            landscape:flex-1 landscape:mb-0"
        >
          {/* Timer - Larger on mobile */}
          <div className="text-center mb-6 md:mb-8">
            <div className={`font-bold text-[#3B3632] mb-2
              ${isMobile ? 'text-7xl' : 'text-7xl md:text-8xl'}
              landscape:text-6xl`}>
              {formatTime(runner.timeRemaining)}
            </div>
            <div className="text-base md:text-lg text-[#8B7E74]">
              {runner.currentStep?.config.title || 'Step'}
            </div>
            {/* Step counter for landscape mode */}
            <div className="hidden landscape:block text-sm text-[#8B7E74] mt-2">
              Step {runner.currentStepIndex + 1} of {ritual.steps.length}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-[#F5F0E8] rounded-xl p-4 md:p-6 mb-6">
            <p className="text-[#3B3632] text-base md:text-lg leading-relaxed">
              {runner.currentStep?.config.instructions}
            </p>
          </div>

          {/* Controls - Larger touch targets */}
          <div className="flex items-center justify-center gap-4 md:gap-6">
            <button
              onClick={runner.previousStep}
              disabled={runner.currentStepIndex === 0}
              className="p-4 md:p-3 rounded-lg bg-white/50 hover:bg-white disabled:opacity-30 transition-colors
                min-w-[64px] min-h-[64px] md:min-w-[60px] md:min-h-[60px] touch-manipulation
                active:scale-95"
              aria-label="Previous step"
            >
              <ChevronLeft className="w-6 h-6 md:w-6 md:h-6 text-[#3B3632]" />
            </button>

            <button
              onClick={runner.isPaused ? runner.resume : runner.pause}
              className="p-6 md:p-6 rounded-full bg-[#C8956A] hover:bg-[#B8855A] transition-colors
                min-w-[80px] min-h-[80px] md:min-w-[88px] md:min-h-[88px] touch-manipulation
                active:scale-95 shadow-lg"
              aria-label={runner.isPaused ? 'Resume' : 'Pause'}
            >
              {runner.isPaused ? (
                <Play className="w-8 h-8 md:w-8 md:h-8 text-white" />
              ) : (
                <Pause className="w-8 h-8 md:w-8 md:h-8 text-white" />
              )}
            </button>

            <button
              onClick={runner.nextStep}
              disabled={runner.currentStepIndex === ritual.steps.length - 1}
              className="p-4 md:p-3 rounded-lg bg-white/50 hover:bg-white disabled:opacity-30 transition-colors
                min-w-[64px] min-h-[64px] md:min-w-[60px] md:min-h-[60px] touch-manipulation
                active:scale-95"
              aria-label="Next step"
            >
              <ChevronRight className="w-6 h-6 md:w-6 md:h-6 text-[#3B3632]" />
            </button>
          </div>

          {/* Skip Button */}
          <button
            onClick={runner.nextStep}
            className="mt-6 w-full py-2 text-[#8B7E74] hover:text-[#3B3632] transition-colors
              min-h-[44px] touch-manipulation"
          >
            Skip to Next Step
          </button>

          {/* Swipe hint for mobile */}
          {isMobile && (
            <div className="mt-4 text-center text-xs text-[#8B7E74]/70">
              💡 Tip: Swipe left/right to change steps
            </div>
          )}
        </div>

        {/* Landscape: Progress sidebar */}
        <div className="hidden landscape:block landscape:w-48">
          <div className="bg-white/80 rounded-2xl p-4 shadow-lg sticky top-4">
            <h3 className="text-sm font-semibold text-[#3B3632] mb-2">{ritual.title}</h3>
            <div className="text-xs text-[#8B7E74] mb-4">
              {runner.progress}% Complete
            </div>
            <div className="space-y-2">
              {ritual.steps.map((step, index) => (
                <div
                  key={index}
                  className={`text-xs p-2 rounded-lg ${
                    index === runner.currentStepIndex
                      ? 'bg-[#C8956A] text-white'
                      : index < runner.currentStepIndex
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {step.config.title}
                </div>
              ))}
            </div>
            <button
              onClick={handleExit}
              className="mt-4 w-full py-2 text-sm text-[#8B7E74] hover:text-[#3B3632] transition-colors"
            >
              Exit
            </button>
          </div>
        </div>
      </div>

      {/* ✨ Reward Modal */}
      {completedRitualData && (
        <RitualRewardModal
          isOpen={showRewardModal}
          onClose={() => {
            setShowRewardModal(false);
            navigate('/chat'); // Navigate to chat on close
          }}
          ritualData={{
            title: completedRitualData.title,
            durationMinutes: completedRitualData.durationMinutes,
            moodBefore: completedRitualData.moodBefore,
            moodAfter: completedRitualData.moodAfter,
            reflection: completedRitualData.reflection,
          }}
          onViewInsights={() => {
            setShowRewardModal(false);
            navigate('/chat'); // Navigate to chat with ritual summary visible
          }}
          onStartAnother={() => {
            setShowRewardModal(false);
            navigate('/rituals');
          }}
        />
      )}
    </div>
  );
};

