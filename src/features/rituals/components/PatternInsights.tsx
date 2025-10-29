/**
 * Pattern Insights Component
 * Displays AI-detected patterns in ritual completion
 */

import { useTierQuery } from '@/hooks/useTierQuery';
import { Brain, TrendingUp, Lightbulb, Award } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { patternDetectionService, type RitualPattern } from '../services/patternDetectionService';
import { logger } from '@/lib/logger';

export const PatternInsights: React.FC = () => {
  const { userId, tier } = useTierQuery();
  const [patterns, setPatterns] = useState<RitualPattern[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPatterns = async () => {
      if (!userId || tier === 'free') {
        setLoading(false);
        return;
      }

      try {
        const detectedPatterns = await patternDetectionService.detectPatterns(userId);
        setPatterns(detectedPatterns);
      } catch (error) {
        logger.error('[PatternInsights] Failed to load patterns:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPatterns();
  }, [userId, tier]);

  if (loading) {
    // ✅ Mobile: Loading skeleton
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 animate-pulse">
          <div className="w-5 h-5 rounded bg-gray-200" />
          <div className="h-5 bg-gray-200 rounded w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-full mb-1" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (patterns.length === 0 || tier === 'free') {
    return null;
  }

  const icons: Record<RitualPattern['type'], React.ElementType> = {
    time_of_day: TrendingUp,
    day_of_week: Brain,
    ritual_type: Lightbulb,
    mood_improvement: Award,
  };

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-[#3B3632] mb-3 flex items-center gap-2">
        <Brain className="w-5 h-5 text-purple-500" />
        Your Patterns
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {patterns.map((pattern, index) => {
          const Icon = icons[pattern.type];
          const confidenceColor = pattern.confidence > 0.7 ? 'text-green-500' : 
                                 pattern.confidence > 0.5 ? 'text-yellow-500' : 
                                 'text-gray-400';
          
          return (
            <div
              key={`${pattern.type}-${index}`}
              className="bg-white rounded-xl border border-[#E8DCC8] p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-50">
                  <Icon className="w-5 h-5 text-purple-500" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm text-[#3B3632] mb-1">
                    {pattern.title}
                  </h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {pattern.insight}
                  </p>
                  <div className="mt-2 flex items-center gap-1">
                    <div className="flex gap-0.5">
                      {[1, 2, 3].map(i => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${
                            i <= pattern.confidence * 3 ? confidenceColor : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500 ml-1">
                      {pattern.confidence > 0.7 ? 'Strong' : 
                       pattern.confidence > 0.5 ? 'Moderate' : 
                       'Emerging'} pattern
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
