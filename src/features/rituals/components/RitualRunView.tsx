/**
 * 🧘 Ritual Run View - Ritual Execution Interface
 * Displays current step, timer, progress, and mood tracking
 */

import { atlasDB } from '@/database/atlasDB';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { supabase } from '@/lib/supabaseClient';
import { generateUUID } from '@/utils/uuid';
import { ArrowLeft, ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { modernToast } from '../../../config/toastConfig';
import { logger } from '../../../lib/logger';
import { useRitualRunner } from '../hooks/useRitualRunner';
import { useRitualStore } from '../hooks/useRitualStore';
import { MOOD_OPTIONS, type Ritual } from '../types/rituals';

export const RitualRunView: React.FC = () => {
  const navigate = useNavigate();
  const { ritualId } = useParams<{ ritualId: string }>();
  const { user } = useSupabaseAuth();
  const { presets, userRituals, loading } = useRitualStore();

  const [selectedMoodBefore, setSelectedMoodBefore] = useState<string | null>(null);
  const [selectedMoodAfter, setSelectedMoodAfter] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [hasStarted, setHasStarted] = useState(false);

  // Find ritual
  const ritual = [...presets, ...userRituals].find((r) => r.id === ritualId);

  const runner = useRitualRunner({
    ritual: ritual,
    userId: user?.id || '',
  });

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
  const handleStart = () => {
    if (!selectedMoodBefore) return;
    runner.start(selectedMoodBefore);
    setHasStarted(true);
  };

  // Handle complete ritual
  const handleComplete = async () => {
    if (!selectedMoodAfter) return;
    
    try {
      // Complete the ritual (saves to database)
      await runner.complete(selectedMoodAfter, completionNotes);
      
      // 🎯 POST RITUAL COMPLETION SUMMARY TO CHAT
      await postRitualSummaryToChat(ritual!, selectedMoodBefore!, selectedMoodAfter, completionNotes, runner.totalDuration);
      
      modernToast.success('Ritual complete! Summary posted to chat ✨');
      
      // Navigate back to chat after 2 seconds
      setTimeout(() => {
        navigate('/chat');
      }, 2000);
    } catch (error) {
      logger.error('[RitualRunView] Failed to complete ritual:', error);
      modernToast.error('Failed to save ritual completion');
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
      const conversations = await atlasDB.conversations
        .where('userId')
        .equals(user!.id)
        .reverse()
        .sortBy('createdAt');
      
      let conversationId = conversations[0]?.id;
      
      // If no conversation exists, create one
      if (!conversationId) {
        const newConversation = {
          id: generateUUID(),
          userId: user!.id,
          title: 'New Chat',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          synced: false,
        };
        await atlasDB.conversations.add(newConversation);
        conversationId = newConversation.id;
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
        id: generateUUID(),
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
      
      // Save to Dexie (local)
      await atlasDB.messages.add(message);
      
      // Sync to Supabase (using type assertion for compatibility)
      const { error } = await supabase.from('messages').insert({
        id: message.id,
        conversation_id: conversationId,
        user_id: user!.id,
        role: 'assistant',
        content: summaryContent,
        created_at: message.timestamp,
      } as any); // Type assertion to bypass Supabase type issues
      
      if (error) {
        logger.error('[RitualRunView] Supabase insert error:', error);
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
      <div className="min-h-screen bg-gradient-to-br from-[#F5F0E8] to-[#E8DDD2] p-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={handleExit}
              className="p-2 rounded-lg hover:bg-white/50 transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-[#3B3632]" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-[#3B3632]">{ritual.title}</h1>
              <p className="text-[#8B7E74]">
                {ritual.steps.length} steps • {Math.ceil(runner.totalDuration / 60)} min
              </p>
            </div>
          </div>

          {/* Mood Selection */}
          <div className="bg-white/80 rounded-2xl p-8 shadow-lg">
            <h2 className="text-xl font-semibold text-[#3B3632] mb-4">How are you feeling right now?</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {MOOD_OPTIONS.map((mood) => (
                <button
                  key={mood.value}
                  onClick={() => setSelectedMoodBefore(mood.value)}
                  className={`p-4 rounded-xl ${mood.color} border-2 transition-all ${
                    selectedMoodBefore === mood.value
                      ? 'border-[#C8956A] scale-105'
                      : 'border-transparent'
                  }`}
                >
                  <div className="text-4xl mb-2">{mood.emoji}</div>
                  <div className="text-sm font-medium text-[#3B3632]">{mood.label}</div>
                </button>
              ))}
            </div>

            <button
              onClick={handleStart}
              disabled={!selectedMoodBefore}
              className="mt-8 w-full py-4 bg-[#C8956A] text-white rounded-xl font-semibold text-lg
                hover:bg-[#B8855A] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
      <div className="min-h-screen bg-gradient-to-br from-[#F5F0E8] to-[#E8DDD2] p-6">
        <div className="max-w-2xl mx-auto">
          {/* Celebration Header */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-[#3B3632] mb-2">Ritual Complete!</h1>
            <p className="text-[#8B7E74]">Great work completing {ritual.title}</p>
          </div>

          {/* Mood After Selection */}
          <div className="bg-white/80 rounded-2xl p-8 shadow-lg mb-4">
            <h2 className="text-xl font-semibold text-[#3B3632] mb-4">How do you feel now?</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {MOOD_OPTIONS.map((mood) => (
                <button
                  key={mood.value}
                  onClick={() => setSelectedMoodAfter(mood.value)}
                  className={`p-4 rounded-xl ${mood.color} border-2 transition-all ${
                    selectedMoodAfter === mood.value
                      ? 'border-[#C8956A] scale-105'
                      : 'border-transparent'
                  }`}
                >
                  <div className="text-4xl mb-2">{mood.emoji}</div>
                  <div className="text-sm font-medium text-[#3B3632]">{mood.label}</div>
                </button>
              ))}
            </div>

            {/* Optional Notes */}
            <textarea
              placeholder="Any reflections or notes? (optional)"
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              className="w-full p-4 rounded-xl border border-[#E8DDD2] bg-white/50 text-[#3B3632]
                placeholder-[#8B7E74]/50 focus:outline-none focus:ring-2 focus:ring-[#C8956A]"
              rows={3}
            />

            <button
              onClick={handleComplete}
              disabled={!selectedMoodAfter}
              className="mt-4 w-full py-4 bg-[#C8956A] text-white rounded-xl font-semibold text-lg
                hover:bg-[#B8855A] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Complete Ritual ✨
            </button>
          </div>

          <button
            onClick={() => navigate('/rituals')}
            className="w-full py-3 text-[#8B7E74] hover:text-[#3B3632] transition-colors"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  // DURING RITUAL: Timer + Step Display
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F0E8] to-[#E8DDD2] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={handleExit}
              className="p-2 rounded-lg hover:bg-white/50 transition-colors"
            >
              <X className="w-6 h-6 text-[#3B3632]" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-[#3B3632]">{ritual.title}</h1>
              <p className="text-sm text-[#8B7E74]">
                Step {runner.currentStepIndex + 1} of {ritual.steps.length}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="h-2 bg-white/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#C8956A] transition-all duration-1000"
              style={{ width: `${runner.progress}%` }}
            />
          </div>
          <div className="text-right text-sm text-[#8B7E74] mt-2">{runner.progress}% Complete</div>
        </div>

        {/* Current Step Card */}
        <div className="bg-white/80 rounded-2xl p-8 shadow-lg mb-6">
          {/* Timer */}
          <div className="text-center mb-8">
            <div className="text-7xl font-bold text-[#3B3632] mb-2">
              {formatTime(runner.timeRemaining)}
            </div>
            <div className="text-lg text-[#8B7E74]">
              {runner.currentStep?.config.title || 'Step'}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-[#F5F0E8] rounded-xl p-6 mb-6">
            <p className="text-[#3B3632] text-lg leading-relaxed">
              {runner.currentStep?.config.instructions}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={runner.previousStep}
              disabled={runner.currentStepIndex === 0}
              className="p-3 rounded-lg bg-white/50 hover:bg-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-[#3B3632]" />
            </button>

            <button
              onClick={runner.isPaused ? runner.resume : runner.pause}
              className="p-6 rounded-full bg-[#C8956A] hover:bg-[#B8855A] transition-colors"
            >
              {runner.isPaused ? (
                <Play className="w-8 h-8 text-white" />
              ) : (
                <Pause className="w-8 h-8 text-white" />
              )}
            </button>

            <button
              onClick={runner.nextStep}
              disabled={runner.currentStepIndex === ritual.steps.length - 1}
              className="p-3 rounded-lg bg-white/50 hover:bg-white disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-6 h-6 text-[#3B3632]" />
            </button>
          </div>

          {/* Skip Button */}
          <button
            onClick={runner.nextStep}
            className="mt-6 w-full py-2 text-[#8B7E74] hover:text-[#3B3632] transition-colors"
          >
            Skip to Next Step
          </button>
        </div>
      </div>
    </div>
  );
};

