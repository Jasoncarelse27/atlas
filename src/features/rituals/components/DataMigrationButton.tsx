/**
 * One-Click Data Migration Button
 * Fixes corrupted ritual durations in the database
 */

import { useTierQuery } from '@/hooks/useTierQuery';
import { Wrench } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';
import { useRitualStore } from '../hooks/useRitualStore';
import { fixCorruptedRitualDurations } from '../utils/ritualDataMigration';

export const DataMigrationButton: React.FC = () => {
  const { userId } = useTierQuery();
  const [fixing, setFixing] = useState(false);
  const { loadUserRituals } = useRitualStore();

  const handleFix = async () => {
    if (!userId) {
      toast.error('User not found');
      return;
    }

    setFixing(true);
    
    try {
      const fixedCount = await fixCorruptedRitualDurations(userId);
      
      if (fixedCount > 0) {
        toast.success(`✅ Fixed ${fixedCount} ritual(s)! Refreshing...`);
        
        // Refresh the ritual list
        await loadUserRituals(userId);
        
        // Give user time to see the success message
        setTimeout(() => {
          window.location.reload(); // Force full refresh to clear cache
        }, 1500);
      } else {
        toast.info('No corrupted rituals found. All durations are correct!');
      }
    } catch (error) {
      toast.error('Failed to fix rituals. Please try again.');
      console.error(error);
    } finally {
      setFixing(false);
    }
  };

  return (
    <button
      onClick={handleFix}
      disabled={fixing}
      className="flex items-center gap-2 px-4 py-2 bg-orange-50 border-2 border-orange-200 text-orange-700
        rounded-xl hover:bg-orange-100 transition-all hover:shadow-md active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
        min-h-[44px] touch-manipulation"
      aria-label="Fix corrupted ritual durations"
      title="Fix rituals with incorrect durations (5s showing instead of 5 min)"
    >
      <Wrench className={`w-5 h-5 ${fixing ? 'animate-spin' : ''}`} />
      <span className="font-medium">
        {fixing ? 'Fixing...' : 'Fix Durations'}
      </span>
    </button>
  );
};

