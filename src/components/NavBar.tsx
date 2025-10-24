import { BarChart3, Brain, LogOut, Menu, MessageSquare, Settings, Shield, X } from "lucide-react";
import { useState } from "react";

interface NavBarProps {
  user?: any;
  tier?: string;
  messageCount?: number;
  onLogout?: () => void;
}

export default function NavBar({ user, tier = "free", messageCount = 0, onLogout }: NavBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const getUserInitials = () => {
    if (!user?.email) return "U";
    const emailName = user.email.split('@')[0];
    return emailName.charAt(0).toUpperCase();
  };

  const getTierDisplayName = () => {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  const getRemainingMessages = () => {
    if (tier !== "free") return null;
    const remaining = 15 - messageCount; // 15 messages per month for Free tier
    return remaining > 0 ? `${remaining} left this month` : "0 left this month";
  };

  return (
    <>
      <nav className="w-full bg-[#10141C] text-white px-4 py-3 flex items-center justify-between shadow-md border-b border-gray-700">
        {/* Left: Logo */}
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-r from-atlas-sage to-purple-600 rounded-lg flex items-center justify-center">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Atlas AI
          </span>
        </div>

        {/* Center: Desktop Links */}
        <div className="hidden md:flex space-x-8 text-sm font-medium">
          <a 
            href="/chat" 
            className="flex items-center space-x-2 hover:text-[#B2BDA3] transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat</span>
          </a>
          <a 
            href="/insights" 
            className="flex items-center space-x-2 hover:text-[#B2BDA3] transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Insights</span>
          </a>
          <a 
            href="/settings" 
            className="flex items-center space-x-2 hover:text-[#B2BDA3] transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </a>
        </div>

        {/* Right: Profile Dropdown (Desktop) */}
        <div className="hidden md:flex items-center space-x-4">
          {/* Privacy Mode */}
          <div className="flex items-center space-x-2 text-sm text-gray-300">
            <Shield className="w-4 h-4" />
            <span>Normal Mode</span>
          </div>
          
          {/* Tier Badge */}
          <div className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-gray-700/50">
            <span className="text-sm font-medium text-atlas-sage">
              Atlas {getTierDisplayName()}
            </span>
            {getRemainingMessages() && (
              <span className="text-xs text-gray-300">
                {getRemainingMessages()}
              </span>
            )}
          </div>

          {/* User Avatar */}
          {user && (
            <div className="w-8 h-8 bg-gradient-to-r from-atlas-sage to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
              {getUserInitials()}
            </div>
          )}

          {/* Logout Button */}
          <button 
            onClick={onLogout}
            className="bg-[#B2BDA3] hover:bg-[#F4E5D9] text-black px-3 py-1 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden text-white p-2 hover:bg-gray-700 rounded-lg transition-colors"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" 
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="fixed right-0 top-0 h-full w-80 max-w-[90vw] bg-[#10141C] p-6 flex flex-col space-y-6 z-50 shadow-lg border-l border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Menu Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-gradient-to-r from-atlas-sage to-purple-600 rounded-lg flex items-center justify-center">
                  <Brain className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-lg">Atlas AI</span>
              </div>
              <button 
                onClick={() => setMobileOpen(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Close menu"
              >
                <X size={24} />
              </button>
            </div>

            {/* Navigation Links */}
            <div className="space-y-4">
              <a 
                href="/chat" 
                className="flex items-center space-x-3 hover:text-[#B2BDA3] transition-colors py-2"
                onClick={() => setMobileOpen(false)}
              >
                <MessageSquare className="w-5 h-5" />
                <span className="text-base">Chat</span>
              </a>
              <a 
                href="/insights" 
                className="flex items-center space-x-3 hover:text-[#B2BDA3] transition-colors py-2"
                onClick={() => setMobileOpen(false)}
              >
                <BarChart3 className="w-5 h-5" />
                <span className="text-base">Insights</span>
              </a>
              <a 
                href="/settings" 
                className="flex items-center space-x-3 hover:text-[#B2BDA3] transition-colors py-2"
                onClick={() => setMobileOpen(false)}
              >
                <Settings className="w-5 h-5" />
                <span className="text-base">Settings</span>
              </a>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-700 pt-6 space-y-4">
              {/* Privacy Mode */}
              <div className="flex items-center space-x-3 text-gray-300">
                <Shield className="w-5 h-5" />
                <span className="text-base">Normal Mode</span>
              </div>

              {/* User Info */}
              {user && (
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-atlas-sage to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    {getUserInitials()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-medium truncate">{user.email}</div>
                    <div className="text-sm text-gray-400">Atlas {getTierDisplayName()}</div>
                  </div>
                </div>
              )}

              {/* Tier Info */}
              <div className="p-3 rounded-lg bg-gray-700/50">
                <div className="text-sm font-medium text-atlas-sage mb-1">
                  Atlas {getTierDisplayName()}
                </div>
                {getRemainingMessages() && (
                  <div className="text-xs text-gray-300">
                    {getRemainingMessages()}
                  </div>
                )}
              </div>

              {/* Logout Button */}
              <button 
                onClick={() => {
                  setMobileOpen(false);
                  onLogout?.();
                }}
                className="w-full bg-[#B2BDA3] hover:bg-[#F4E5D9] text-black px-4 py-3 rounded-lg text-base font-medium transition-colors flex items-center justify-center space-x-2"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
