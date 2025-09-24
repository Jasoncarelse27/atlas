
export default function InsightsWidget() {
  return (
    <div className="bg-[#2c2f36] p-4 rounded-lg shadow">
      <h3 className="text-gray-200 font-medium mb-3 flex items-center">
        <span className="mr-2">📊</span>
        Emotional Insights
      </h3>
      
      <div className="space-y-3">
        <div className="text-center py-4">
          <div className="text-4xl mb-2">🧠</div>
          <p className="text-gray-400 text-sm">
            Track your emotional patterns and conversation insights
          </p>
        </div>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Mood Tracking</span>
            <span className="text-green-400">Active</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Conversation Analysis</span>
            <span className="text-blue-400">Coming Soon</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Wellness Score</span>
            <span className="text-purple-400">Beta</span>
          </div>
        </div>
      </div>
    </div>
  );
}
