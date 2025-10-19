import React, { useState } from 'react';
import { 
  Code, 
  Terminal, 
  GitBranch, 
  Bug, 
  Search, 
  Play,
  Download,
  Zap,
  FileText,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';

interface DevelopmentHelperProps {
  className?: string;
}

const DevelopmentHelper: React.FC<DevelopmentHelperProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'tools' | 'status' | 'shortcuts'>('tools');
  const [showDetails, setShowDetails] = useState(false);

  const developmentStatus = {
    server: { status: 'running', port: 5173, url: window.location.origin },
    database: { status: 'connected', type: 'Supabase' },
    git: { status: 'clean', branch: 'main', commits: 3 },
    build: { status: 'ready', lastBuild: '2 minutes ago' }
  };

  const quickCommands = [
    { name: 'Start Dev Server', command: 'npm run dev', icon: <Play className="w-4 h-4" /> },
    { name: 'Build Project', command: 'npm run build', icon: <Code className="w-4 h-4" /> },
    { name: 'Run Tests', command: 'npm test', icon: <Bug className="w-4 h-4" /> },
    { name: 'Lint Code', command: 'npm run lint', icon: <Search className="w-4 h-4" /> },
    { name: 'Install Dependencies', command: 'npm install', icon: <Download className="w-4 h-4" /> },
    { name: 'Git Status', command: 'git status', icon: <GitBranch className="w-4 h-4" /> }
  ];

  const vsCodeShortcuts = [
    { name: 'Command Palette', shortcut: 'Cmd+Shift+P', icon: <Zap className="w-4 h-4" /> },
    { name: 'Quick Open', shortcut: 'Cmd+P', icon: <FileText className="w-4 h-4" /> },
    { name: 'Go to Line', shortcut: 'Cmd+G', icon: <Search className="w-4 h-4" /> },
    { name: 'Toggle Terminal', shortcut: 'Ctrl+`', icon: <Terminal className="w-4 h-4" /> },
    { name: 'Format Document', shortcut: 'Shift+Alt+F', icon: <Code className="w-4 h-4" /> },
    { name: 'Find in Files', shortcut: 'Cmd+Shift+F', icon: <Search className="w-4 h-4" /> }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
      case 'connected':
      case 'clean':
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Info className="w-4 h-4 text-yellow-500" />;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Development Helper
          </h3>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {showDetails ? 'Hide' : 'Show'} Details
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('tools')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'tools'
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Code className="w-4 h-4 inline mr-2" />
          Tools
        </button>
        <button
          onClick={() => setActiveTab('status')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'status'
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <CheckCircle className="w-4 h-4 inline mr-2" />
          Status
        </button>
        <button
          onClick={() => setActiveTab('shortcuts')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'shortcuts'
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Zap className="w-4 h-4 inline mr-2" />
          Shortcuts
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'tools' && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Quick Commands</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickCommands.map((cmd, index) => (
                <button
                  key={index}
                  onClick={() => copyToClipboard(cmd.command)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left group"
                >
                  <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/40 transition-colors">
                    {cmd.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {cmd.name}
                    </h5>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                      {cmd.command}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'status' && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">System Status</h4>
            <div className="space-y-3">
              {Object.entries(developmentStatus).map(([key, status]) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(status.status)}
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {key}
                      </h5>
                                             {showDetails && (
                         <p className="text-xs text-gray-600 dark:text-gray-400">
                           {key === 'server' && `Port: ${(status as any).port}`}
                           {key === 'database' && `Type: ${(status as any).type}`}
                           {key === 'git' && `Branch: ${(status as any).branch}, Commits: ${(status as any).commits}`}
                           {key === 'build' && `Last: ${(status as any).lastBuild}`}
                         </p>
                       )}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    status.status === 'running' || status.status === 'connected' || status.status === 'clean' || status.status === 'ready'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                  }`}>
                    {status.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'shortcuts' && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">VS Code Shortcuts</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {vsCodeShortcuts.map((shortcut, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex-shrink-0 p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                    {shortcut.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                      {shortcut.name}
                    </h5>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                      {shortcut.shortcut}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Click commands to copy to clipboard</span>
          <span>Development environment ready</span>
        </div>
      </div>
    </div>
  );
};

export default DevelopmentHelper; 