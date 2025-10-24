import React, { useState, useEffect } from 'react';
import { Lightbulb, Zap, ArrowRight, X } from 'lucide-react';
import type { SoundType } from '../hooks/useSoundEffects';

interface ContextualSuggestionsProps {
  message?: string;
  context?: string[];
  onSuggestionClick: (suggestion: string) => void;
  onDismiss?: () => void;
  className?: string;
  onSoundPlay?: (soundType: SoundType) => void;
}

const ContextualSuggestions: React.FC<ContextualSuggestionsProps> = ({
  message,
  context = [],
  onSuggestionClick,
  onDismiss,
  className = '',
  onSoundPlay
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  // Generate suggestions based on message and context
  useEffect(() => {
    if (!message && context.length === 0) {
      // Default suggestions
      setSuggestions([
        'What can you help me with?',
        'Tell me about Atlas features',
        'How do I use voice mode?',
        'What\'s new today?'
      ]);
      return;
    }

    // Generate contextual suggestions
    let newSuggestions: string[] = [];

    if (message) {
      if (message.toLowerCase().includes('weather')) {
        newSuggestions.push('What should I wear today?', 'Will it rain tomorrow?', 'Show me the weekend forecast');
      } else if (message.toLowerCase().includes('recipe') || message.toLowerCase().includes('cook')) {
        newSuggestions.push('Show me vegetarian options', 'How long will this take to prepare?', 'What ingredients do I need?');
      } else if (message.toLowerCase().includes('meeting') || message.toLowerCase().includes('schedule')) {
        newSuggestions.push('Set a reminder for this', 'Send the details to my team', 'Find a good time next week');
      } else if (message.toLowerCase().includes('travel') || message.toLowerCase().includes('trip')) {
        newSuggestions.push('What should I pack?', 'Find hotels nearby', 'Show me local attractions');
      } else {
        // Generic follow-ups
        newSuggestions.push('Tell me more about this', 'Explain in simpler terms', 'Give me examples');
      }
    }

    // Add suggestions based on context
    if (context.includes('weather')) {
      newSuggestions.push('How does this compare to yesterday?');
    }
    if (context.includes('productivity')) {
      newSuggestions.push('Create a to-do list for me', 'Set a reminder');
    }
    if (context.includes('learning')) {
      newSuggestions.push('Summarize this for me', 'Quiz me on this topic');
    }

    // Ensure we have at least 3 suggestions
    if (newSuggestions.length < 3) {
      const defaultSuggestions = [
        'Tell me more',
        'Explain in detail',
        'Give me examples',
        'How does this work?',
        'Why is this important?'
      ];
      
      while (newSuggestions.length < 3) {
        const randomSuggestion = defaultSuggestions[Math.floor(Math.random() * defaultSuggestions.length)];
        if (!newSuggestions.includes(randomSuggestion)) {
          newSuggestions.push(randomSuggestion);
        }
      }
    }

    // Limit to 4 suggestions
    setSuggestions(newSuggestions.slice(0, 4));
  }, [message, context]);

  const handleSuggestionClick = (suggestion: string) => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    onSuggestionClick(suggestion);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    setIsVisible(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  const toggleExpand = () => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    setIsExpanded(!isExpanded);
  };

  if (!isVisible || suggestions.length === 0) return null;

  return (
    <div className={`relative ${className}`}>
      <div className="neumorphic-card bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-gray-200 p-2 sm:p-2.5 transition-all duration-300">
        <div className="flex items-center justify-between mb-1 sm:mb-1.5">
          <div className="flex items-center gap-1">
            <div className="p-1 bg-blue-100 rounded-full">
              <Lightbulb className="w-2.5 h-2.5 text-atlas-sage" />
            </div>
            <h3 className="font-medium text-blue-800 text-2xs sm:text-xs">Suggested Follow-ups</h3>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={toggleExpand}
              className="neumorphic-button p-1 text-atlas-sage hover:text-blue-700 hover:bg-blue-100 rounded-full transition-colors"
              aria-label={isExpanded ? "Show fewer suggestions" : "Show more suggestions"}
            >
              <Zap className="w-2.5 h-2.5" />
            </button>
            
            <button
              onClick={handleDismiss}
              className="neumorphic-button p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Dismiss suggestions"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
        
        <div className={`flex flex-wrap gap-1 ${isExpanded ? '' : 'max-h-16 sm:max-h-20 overflow-hidden'}`}>
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="neumorphic-button px-2 py-1 bg-white hover:bg-blue-50 text-blue-700 rounded-full text-2xs border border-blue-200 transition-colors flex items-center gap-1 group shadow-sm hover:shadow"
            >
              <span className="line-clamp-1 text-2xs">{suggestion}</span>
              <ArrowRight className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContextualSuggestions;