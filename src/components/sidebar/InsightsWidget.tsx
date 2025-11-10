import { BarChart3, Brain } from 'lucide-react';

export default function InsightsWidget() {
  return (
    <div className="bg-transparent border-transparent p-4 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-xl bg-[#B8A5D6]/20">
          <BarChart3 className="w-4 h-4 text-[#8B7AB8]" />
        </div>
        <h3 className="text-[#5A524A] font-medium text-sm">Emotional Insights</h3>
      </div>
      
      <div className="space-y-3">
        <div className="text-center py-4">
          <div className="flex items-center justify-center mb-2">
            <div className="p-3 rounded-xl bg-[#B8A5D6]/20">
              <Brain className="w-8 h-8 text-[#8B7AB8]" />
            </div>
          </div>
          <p className="text-[#8B7E74] text-sm">
            Track your emotional patterns and conversation insights
          </p>
        </div>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-[#8B7E74]">Mood Tracking</span>
            <span className="text-[#8FA67E] font-medium bg-[#8FA67E]/10 px-2 py-0.5 rounded">Active</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8B7E74]">Conversation Analysis</span>
            <span className="text-[#F3B562] font-medium bg-[#F3B562]/10 px-2 py-0.5 rounded">Coming Soon</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8B7E74]">Wellness Score</span>
            <span className="text-[#9B8FDB] font-medium bg-[#9B8FDB]/10 px-2 py-0.5 rounded">Beta</span>
          </div>
        </div>
      </div>
    </div>
  );
}
