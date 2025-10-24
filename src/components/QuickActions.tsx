import React, { useState } from 'react';
import { 
  Code, 
  Terminal, 
  GitBranch, 
  Bug, 
  Search, 
  Settings,
  Play,
  RefreshCw,
  Download,
  Upload,
  Database,
  Server
} from 'lucide-react';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'development' | 'debugging' | 'deployment' | 'utilities';
  hotkey?: string;
}

interface QuickActionsProps {
  onAction: (action: string) => void;
  className?: string;
}

const QuickActions: React.FC<QuickActionsProps> = ({ onAction, className = '' }) => {
  const [selectedCategory, setSelectedCategory] = useState<'development' | 'debugging' | 'deployment' | 'utilities'>('development');
  const [showHotkeys, setShowHotkeys] = useState(false);

  const actions: QuickAction[] = [
    // Development Actions
    {
      id: 'run-dev',
      title: 'Start Development Server',
      description: 'Launch the development server',
      icon: <Play className="w-4 h-4" />,
      action: () => onAction('run-dev'),
      category: 'development',
      hotkey: 'Ctrl+Shift+D'
    },
    {
      id: 'build',
      title: 'Build Project',
      description: 'Create production build',
      icon: <Code className="w-4 h-4" />,
      action: () => onAction('build'),
      category: 'development',
      hotkey: 'Ctrl+Shift+B'
    },
    {
      id: 'lint',
      title: 'Run Linter',
      description: 'Check code quality',
      icon: <Search className="w-4 h-4" />,
      action: () => onAction('lint'),
      category: 'development',
      hotkey: 'Ctrl+Shift+L'
    },
    {
      id: 'test',
      title: 'Run Tests',
      description: 'Execute test suite',
      icon: <Bug className="w-4 h-4" />,
      action: () => onAction('test'),
      category: 'development',
      hotkey: 'Ctrl+Shift+T'
    },

    // Debugging Actions
    {
      id: 'debug',
      title: 'Start Debugger',
      description: 'Launch debugging session',
      icon: <Bug className="w-4 h-4" />,
      action: () => onAction('debug'),
      category: 'debugging',
      hotkey: 'F5'
    },
    {
      id: 'inspect',
      title: 'Inspect Elements',
      description: 'Open browser dev tools',
      icon: <Search className="w-4 h-4" />,
      action: () => onAction('inspect'),
      category: 'debugging',
      hotkey: 'F12'
    },
    {
      id: 'console',
      title: 'Open Console',
      description: 'View browser console',
      icon: <Terminal className="w-4 h-4" />,
      action: () => onAction('console'),
      category: 'debugging',
      hotkey: 'Ctrl+Shift+J'
    },

    // Deployment Actions
    {
      id: 'deploy',
      title: 'Deploy to Production',
      description: 'Deploy to live environment',
      icon: <Upload className="w-4 h-4" />,
      action: () => onAction('deploy'),
      category: 'deployment',
      hotkey: 'Ctrl+Shift+P'
    },
    {
      id: 'backup',
      title: 'Create Backup',
      description: 'Backup current state',
      icon: <Download className="w-4 h-4" />,
      action: () => onAction('backup'),
      category: 'deployment',
      hotkey: 'Ctrl+Shift+B'
    },
    {
      id: 'database',
      title: 'Database Operations',
      description: 'Manage database',
      icon: <Database className="w-4 h-4" />,
      action: () => onAction('database'),
      category: 'deployment',
      hotkey: 'Ctrl+Shift+D'
    },

    // Utilities
    {
      id: 'git-status',
      title: 'Git Status',
      description: 'Check repository status',
      icon: <GitBranch className="w-4 h-4" />,
      action: () => onAction('git-status'),
      category: 'utilities',
      hotkey: 'Ctrl+Shift+G'
    },
    {
      id: 'settings',
      title: 'VS Code Settings',
      description: 'Open settings',
      icon: <Settings className="w-4 h-4" />,
      action: () => onAction('settings'),
      category: 'utilities',
      hotkey: 'Ctrl+,'
    },
    {
      id: 'reload',
      title: 'Reload Window',
      description: 'Restart VS Code',
      icon: <RefreshCw className="w-4 h-4" />,
      action: () => onAction('reload'),
      category: 'utilities',
      hotkey: 'Ctrl+Shift+R'
    }
  ];

  const categories = [
    { id: 'development', label: 'Development', icon: <Code className="w-4 h-4" /> },
    { id: 'debugging', label: 'Debugging', icon: <Bug className="w-4 h-4" /> },
    { id: 'deployment', label: 'Deployment', icon: <Server className="w-4 h-4" /> },
    { id: 'utilities', label: 'Utilities', icon: <Settings className="w-4 h-4" /> }
  ];

  const filteredActions = actions.filter(action => action.category === selectedCategory);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Quick Actions
          </h3>
          <button
            onClick={() => setShowHotkeys(!showHotkeys)}
            className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {showHotkeys ? 'Hide' : 'Show'} Hotkeys
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id as 'development' | 'debugging' | 'deployment' | 'utilities')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              selectedCategory === category.id
                ? 'bg-blue-50 dark:bg-blue-900/20 text-atlas-sage dark:text-atlas-sage border-b-2 border-atlas-sage'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {category.icon}
            {category.label}
          </button>
        ))}
      </div>

      {/* Actions Grid */}
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredActions.map((action) => (
            <button
              key={action.id}
              onClick={action.action}
              className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left group"
            >
              <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/40 transition-colors">
                {action.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {action.title}
                  </h4>
                  {showHotkeys && action.hotkey && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {action.hotkey}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {action.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Press Ctrl+Shift+P to open command palette</span>
          <span>{filteredActions.length} actions available</span>
        </div>
      </div>
    </div>
  );
};

export default QuickActions; 