import { BarChart3, Brain } from 'lucide-react';

export default function InsightsWidget() {
  return (
    <div className="bg-slate-700/20 border border-slate-600/20 p-4 rounded-2xl shadow">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-xl bg-purple-600/20">
          <BarChart3 className="w-4 h-4 text-purple-400" />
        </div>
        <h3 className="text-white font-medium">Emotional Insights</h3>
      </div>
      
      <div className="space-y-3">
        <div className="text-center py-4">
          <div className="flex items-center justify-center mb-2">
            <div className="p-3 rounded-xl bg-indigo-600/20">
              <Brain className="w-8 h-8 text-indigo-400" />
            </div>
          </div>
          <p className="text-slate-300 text-sm">
            Track your emotional patterns and conversation insights
          </p>
        </div>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Mood Tracking</span>
            <span className="text-green-400">Active</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Conversation Analysis</span>
            <span className="text-blue-400">Coming Soon</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Wellness Score</span>
            <span className="text-purple-400">Beta</span>
          </div>
        </div>
      </div>
    </div>
  );
}
