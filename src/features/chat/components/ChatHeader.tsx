import { Brain, LogOut, MessageSquare, Settings, User } from 'lucide-react';
import React from 'react';
// import { useTierAccess } from '@/hooks/useSubscription'; // TODO: Use for centralized tier checks when userId is available

interface ChatHeaderProps {
  user?: any;
  tier: string;
  messageCount: number;
  onLogout: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  user,
  tier,
  messageCount,
  onLogout
}) => {
  // const { hasAccess } = useTierAccess(); // TODO: Use for centralized tier checks when userId is available
  return (
    <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Atlas AI
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex items-center space-x-4">
            <button className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors bg-blue-600/20">
              <MessageSquare className="w-4 h-4" />
              <span>Chat</span>
            </button>
            <button className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
            
            {/* Tier Display */}
            <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-700/50">
              <span className="text-sm font-medium text-blue-400">
                Atlas {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </span>
              {tier === 'free' && (
                <span className="text-xs text-gray-300">
                  {15 - messageCount} left
                </span>
              )}
            </div>
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {user && (
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium">{user.email}</span>
              </div>
            )}
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-red-600 transition-colors bg-red-500/20 hover:bg-red-500/30"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
