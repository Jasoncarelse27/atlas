import {
    Activity,
    BarChart3,
    Brain,
    Calendar,
    Clock,
    MessageSquare,
    TrendingUp,
    Zap
} from 'lucide-react';
import React from 'react';

interface ConversationInsights {
  totalMessages: number;
  totalConversations: number;
  averageResponseTime: number;
  mostActiveDay: string;
  mostUsedModel: string;
  totalTokens: number;
  conversationsThisWeek: number;
  messagesThisWeek: number;
}

interface InsightsDashboardProps {
  insights: ConversationInsights;
  isVisible: boolean;
  onClose: () => void;
}

const InsightsDashboard: React.FC<InsightsDashboardProps> = ({
  insights,
  isVisible,
  onClose
}) => {
  if (!isVisible) return null;

  const formatTime = (minutes: number) => {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const stats = [
    {
      icon: <MessageSquare className="w-5 h-5" />,
      label: 'Total Messages',
      value: formatNumber(insights.totalMessages),
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      label: 'Conversations',
      value: formatNumber(insights.totalConversations),
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      icon: <Clock className="w-5 h-5" />,
      label: 'Avg Response Time',
      value: formatTime(insights.averageResponseTime),
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      icon: <Zap className="w-5 h-5" />,
      label: 'Total Tokens',
      value: formatNumber(insights.totalTokens),
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
  ];

  const weeklyStats = [
    {
      label: 'This Week',
      conversations: insights.conversationsThisWeek,
      messages: insights.messagesThisWeek
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Conversation Insights</h2>
                <p className="text-sm text-gray-600">Your Atlas AI usage analytics</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="sr-only">Close</span>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Main Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <div className={stat.color}>{stat.icon}</div>
                  </div>
                  <span className="text-sm font-medium text-gray-600">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Weekly Activity */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Weekly Activity
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {weeklyStats.map((week, index) => (
                <div key={index} className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-gray-900">{week.label}</span>
                    <Activity className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Conversations</div>
                      <div className="text-xl font-bold text-blue-600">{week.conversations}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Messages</div>
                      <div className="text-xl font-bold text-purple-600">{week.messages}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Most Active Day */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-green-600" />
                <h4 className="font-medium text-gray-900">Most Active Day</h4>
              </div>
              <div className="text-2xl font-bold text-green-600">{insights.mostActiveDay}</div>
              <p className="text-sm text-gray-600 mt-1">Your peak conversation day</p>
            </div>

            {/* Preferred Model */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5 text-purple-600" />
                <h4 className="font-medium text-gray-900">Preferred Model</h4>
              </div>
              <div className="text-2xl font-bold text-purple-600">{insights.mostUsedModel}</div>
              <p className="text-sm text-gray-600 mt-1">Your most used AI model</p>
            </div>
          </div>

          {/* Performance Trend */}
          <div className="mt-8 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h4 className="font-medium text-gray-900">Performance Insights</h4>
            </div>
            <div className="text-sm text-gray-700 space-y-2">
              <p>• Average response time: {formatTime(insights.averageResponseTime)}</p>
              <p>• Most active on {insights.mostActiveDay}s</p>
              <p>• {insights.totalConversations} conversations created</p>
              <p>• {formatNumber(insights.totalTokens)} tokens processed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightsDashboard;
