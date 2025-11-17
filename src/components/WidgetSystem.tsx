import type { User } from '@supabase/supabase-js';
import {
  Bookmark,
  Brain,
  Calculator,
  Edit3,
  EyeOff,
  Globe,
  GripVertical,
  MessageSquare,
  Plus,
  Settings,
  Target,
  Timer,
  TrendingUp,
  X,
  Zap
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type { UserProfile } from '../types/subscription';
import Tooltip from './Tooltip';

interface Widget {
  id: string;
  type: string;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  config: Record<string, any>;
  visible: boolean;
  created_at: string;
}

interface WidgetSystemProps {
  user: User;
  profile: UserProfile;
  isVisible: boolean;
  onToggle: () => void;
  widgetLayout?: 'grid' | 'list' | 'masonry';
}

const WIDGET_TYPES = {
  'usage-stats': {
    name: 'Usage Statistics',
    icon: TrendingUp,
    description: 'Track your monthly usage across all features',
    defaultSize: { width: 300, height: 200 },
    color: 'blue'
  },
  'quick-actions': {
    name: 'Quick Actions',
    icon: Zap,
    description: 'Fast access to common Atlas features',
    defaultSize: { width: 250, height: 150 },
    color: 'purple'
  },
  'conversation-history': {
    name: 'Recent Conversations',
    icon: MessageSquare,
    description: 'Your latest interactions with Atlas',
    defaultSize: { width: 350, height: 250 },
    color: 'green'
  },
  'time-tracker': {
    name: 'Time Tracker',
    icon: Timer,
    description: 'Track time spent on different tasks',
    defaultSize: { width: 280, height: 180 },
    color: 'orange'
  },
  'goals': {
    name: 'Daily Goals',
    icon: Target,
    description: 'Set and track your daily productivity goals',
    defaultSize: { width: 300, height: 220 },
    color: 'red'
  },
  'ai-insights': {
    name: 'AI Insights',
    icon: Brain,
    description: 'Personalized insights based on your usage',
    defaultSize: { width: 320, height: 200 },
    color: 'indigo'
  },
  'quick-notes': {
    name: 'Quick Notes',
    icon: Edit3,
    description: 'Jot down quick notes and ideas',
    defaultSize: { width: 280, height: 200 },
    color: 'yellow'
  },
  'calculator': {
    name: 'Calculator',
    icon: Calculator,
    description: 'Simple calculator for quick calculations',
    defaultSize: { width: 250, height: 300 },
    color: 'gray'
  },
  'world-clock': {
    name: 'World Clock',
    icon: Globe,
    description: 'Display time in different time zones',
    defaultSize: { width: 300, height: 150 },
    color: 'cyan'
  },
  'bookmarks': {
    name: 'Bookmarks',
    icon: Bookmark,
    description: 'Save and access your favorite links',
    defaultSize: { width: 280, height: 220 },
    color: 'pink'
  }
};

const WidgetSystem: React.FC<WidgetSystemProps> = ({ 
  user, 
  profile, 
  isVisible, 
  onToggle, 
  widgetLayout = 'grid' 
}) => {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [editingWidget, setEditingWidget] = useState<string | null>(null);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);

  // Load widgets from localStorage (in a real app, this would be from the database)
  useEffect(() => {
    const savedWidgets = localStorage.getItem(`atlas-widgets-${user.id}`);
    if (savedWidgets) {
      try {
        setWidgets(JSON.parse(savedWidgets));
      } catch (error) {
      // Intentionally empty - error handling not required
      }
    }
  }, [user.id]);

  // Save widgets to localStorage
  const saveWidgets = (newWidgets: Widget[]) => {
    localStorage.setItem(`atlas-widgets-${user.id}`, JSON.stringify(newWidgets));
    setWidgets(newWidgets);
  };

  const addWidget = (type: string) => {
    const widgetType = WIDGET_TYPES[type as keyof typeof WIDGET_TYPES];
    if (!widgetType) return;

    const newWidget: Widget = {
      id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title: widgetType.name,
      position: { x: Math.random() * 200, y: Math.random() * 200 },
      size: widgetType.defaultSize,
      config: {},
      visible: true,
      created_at: new Date().toISOString()
    };

    const newWidgets = [...widgets, newWidget];
    saveWidgets(newWidgets);
    setShowAddWidget(false);
  };

  const removeWidget = (widgetId: string) => {
    const newWidgets = widgets.filter(w => w.id !== widgetId);
    saveWidgets(newWidgets);
  };

  const toggleWidgetVisibility = (widgetId: string) => {
    const newWidgets = widgets.map(w => 
      w.id === widgetId ? { ...w, visible: !w.visible } : w
    );
    saveWidgets(newWidgets);
  };

  const updateWidgetPosition = (widgetId: string, position: { x: number; y: number }) => {
    const newWidgets = widgets.map(w => 
      w.id === widgetId ? { ...w, position } : w
    );
    saveWidgets(newWidgets);
  };

  const updateWidgetConfig = (widgetId: string, config: Record<string, any>) => {
    const newWidgets = widgets.map(w => 
      w.id === widgetId ? { ...w, config: { ...w.config, ...config } } : w
    );
    saveWidgets(newWidgets);
  };

  // Get container classes based on layout
  const getContainerClasses = () => {
    switch (widgetLayout) {
      case 'list':
        return 'flex flex-col gap-4 p-4 overflow-y-auto';
      case 'masonry':
        return 'columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 p-4 overflow-y-auto';
      case 'grid':
      default:
        return 'relative w-full h-full';
    }
  };

  const renderWidget = (widget: Widget) => {
    const widgetType = WIDGET_TYPES[widget.type as keyof typeof WIDGET_TYPES];
    if (!widgetType || !widget.visible) return null;

    // Different rendering based on layout
    if (widgetLayout === 'list') {
      return (
        <div
          key={widget.id}
          className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden transition-all duration-200"
        >
          {/* Widget Header */}
          <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <widgetType.icon className={`w-4 h-4 text-${widgetType.color}-500`} />
              <span className="font-medium text-gray-700 text-sm">{widget.title}</span>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip content="Edit widget" position="bottom">
                <button
                  onClick={() => setEditingWidget(editingWidget === widget.id ? null : widget.id)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <Settings className="w-3 h-3" />
                </button>
              </Tooltip>
              <Tooltip content="Hide widget" position="bottom">
                <button
                  onClick={() => toggleWidgetVisibility(widget.id)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <EyeOff className="w-3 h-3" />
                </button>
              </Tooltip>
              <Tooltip content="Remove widget" position="bottom">
                <button
                  onClick={() => removeWidget(widget.id)}
                  className="p-1 text-gray-400 hover:text-red-500 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Widget Content */}
          <div className="p-4">
            {renderWidgetContent(widget)}
          </div>
        </div>
      );
    }

    if (widgetLayout === 'masonry') {
      return (
        <div
          key={widget.id}
          className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden transition-all duration-200 break-inside-avoid mb-4"
        >
          {/* Widget Header */}
          <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <widgetType.icon className={`w-4 h-4 text-${widgetType.color}-500`} />
              <span className="font-medium text-gray-700 text-sm">{widget.title}</span>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip content="Edit widget" position="bottom">
                <button
                  onClick={() => setEditingWidget(editingWidget === widget.id ? null : widget.id)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <Settings className="w-3 h-3" />
                </button>
              </Tooltip>
              <Tooltip content="Hide widget" position="bottom">
                <button
                  onClick={() => toggleWidgetVisibility(widget.id)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <EyeOff className="w-3 h-3" />
                </button>
              </Tooltip>
              <Tooltip content="Remove widget" position="bottom">
                <button
                  onClick={() => removeWidget(widget.id)}
                  className="p-1 text-gray-400 hover:text-red-500 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Widget Content */}
          <div className="p-4">
            {renderWidgetContent(widget)}
          </div>
        </div>
      );
    }

    // Default grid layout (absolute positioning)
    return (
      <div
        key={widget.id}
        className={`absolute bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden transition-all duration-200 ${
          editingWidget === widget.id ? 'ring-2 ring-atlas-sage' : ''
        }`}
        style={{
          left: widget.position.x,
          top: widget.position.y,
          width: widget.size.width,
          height: widget.size.height,
          zIndex: draggedWidget === widget.id ? 1000 : 1
        }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('widget-header')) {
            setDraggedWidget(widget.id);
          }
        }}
      >
        {/* Widget Header */}
        <div className="widget-header flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200 cursor-move">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-gray-400" />
            <widgetType.icon className={`w-4 h-4 text-${widgetType.color}-500`} />
            <span className="font-medium text-gray-700 text-sm">{widget.title}</span>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip content="Edit widget" position="bottom">
              <button
                onClick={() => setEditingWidget(editingWidget === widget.id ? null : widget.id)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <Settings className="w-3 h-3" />
              </button>
            </Tooltip>
            <Tooltip content="Hide widget" position="bottom">
              <button
                onClick={() => toggleWidgetVisibility(widget.id)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <EyeOff className="w-3 h-3" />
              </button>
            </Tooltip>
            <Tooltip content="Remove widget" position="bottom">
              <button
                onClick={() => removeWidget(widget.id)}
                className="p-1 text-gray-400 hover:text-red-500 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Widget Content */}
        <div className="p-4 h-full overflow-auto">
          {renderWidgetContent(widget)}
        </div>
      </div>
    );
  };

  const renderWidgetContent = (widget: Widget) => {
    switch (widget.type) {
      case 'usage-stats':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Requests</span>
              <span className="font-medium">{profile.usage_stats.requests_this_month}/100</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-atlas-sage h-2 rounded-full" 
                style={{ width: `${Math.min(100, (profile.usage_stats.requests_this_month / 100) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Audio</span>
              <span className="font-medium">{profile.usage_stats.audio_minutes_this_month}/30 min</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full" 
                style={{ width: `${Math.min(100, (profile.usage_stats.audio_minutes_this_month / 30) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Storage</span>
              <span className="font-medium">{profile.usage_stats.storage_used_mb}/100 MB</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-500 h-2 rounded-full" 
                style={{ width: `${Math.min(100, (profile.usage_stats.storage_used_mb / 100) * 100)}%` }}
              />
            </div>
          </div>
        );

      case 'quick-actions':
        return (
          <div className="grid grid-cols-2 gap-2">
            <button className="p-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-atlas-sage text-sm font-medium transition-colors">
              New Chat
            </button>
            <button className="p-2 bg-green-50 hover:bg-green-100 rounded-lg text-green-600 text-sm font-medium transition-colors">
              Voice Mode
            </button>
            <button className="p-2 bg-purple-50 hover:bg-purple-100 rounded-lg text-purple-600 text-sm font-medium transition-colors">
              Upload Image
            </button>
            <button className="p-2 bg-orange-50 hover:bg-orange-100 rounded-lg text-orange-600 text-sm font-medium transition-colors">
              Settings
            </button>
          </div>
        );

      case 'conversation-history':
        return (
          <div className="space-y-2">
            {[
              { time: '2 min ago', preview: 'How do I center a div in CSS?' },
              { time: '1 hour ago', preview: 'Explain quantum computing basics' },
              { time: '3 hours ago', preview: 'Write a Python function for...' },
              { time: 'Yesterday', preview: 'Help me plan my vacation' }
            ].map((conv, index) => (
              <div key={index} className="p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                <div className="text-xs text-gray-500">{conv.time}</div>
                <div className="text-sm text-gray-700 truncate">{conv.preview}</div>
              </div>
            ))}
          </div>
        );

      case 'time-tracker':
        return (
          <div className="space-y-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-700">02:34:15</div>
              <div className="text-sm text-gray-500">Today's Focus Time</div>
            </div>
            <div className="flex justify-center gap-2">
              <button className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm">
                Start
              </button>
              <button className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm">
                Stop
              </button>
              <button className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm">
                Reset
              </button>
            </div>
          </div>
        );

      case 'goals':
        return (
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">Today's Goals</div>
            {[
              { task: 'Complete 5 Atlas conversations', done: true },
              { task: 'Review project documentation', done: true },
              { task: 'Plan tomorrow\'s tasks', done: false },
              { task: 'Exercise for 30 minutes', done: false }
            ].map((goal, index) => (
              <div key={index} className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={goal.done}
                  className="rounded"
                  onChange={() => {}}
                />
                <span className={`text-sm ${goal.done ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                  {goal.task}
                </span>
              </div>
            ))}
          </div>
        );

      case 'ai-insights':
        return (
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium text-blue-900">💡 Insight</div>
              <div className="text-sm text-blue-700 mt-1">
                You're most productive with Atlas between 2-4 PM. Consider scheduling important tasks during this time.
              </div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="text-sm font-medium text-green-900">📈 Trend</div>
              <div className="text-sm text-green-700 mt-1">
                Your usage has increased 23% this week. You're getting more value from Atlas!
              </div>
            </div>
          </div>
        );

      case 'quick-notes':
        return (
          <div className="h-full">
            <textarea
              placeholder="Jot down quick notes..."
              className="w-full h-full resize-none border-none outline-none text-sm"
              value={widget.config.notes || ''}
              onChange={(e) => updateWidgetConfig(widget.id, { notes: e.target.value })}
            />
          </div>
        );

      case 'calculator':
        return (
          <div className="space-y-2">
            <input
              type="text"
              className="w-full p-2 border border-gray-300 rounded text-right font-mono"
              value={widget.config.display || '0'}
              readOnly
            />
            <div className="grid grid-cols-4 gap-1">
              {['C', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '='].map((btn) => (
                <button
                  key={btn}
                  className={`p-2 rounded text-sm font-medium transition-colors ${
                    ['C', '±', '%'].includes(btn) ? 'bg-gray-200 hover:bg-gray-300' :
                    ['÷', '×', '-', '+', '='].includes(btn) ? 'bg-atlas-sage hover:bg-atlas-sage text-white' :
                    'bg-gray-100 hover:bg-gray-200'
                  } ${btn === '0' ? 'col-span-2' : ''}`}
                  onClick={() => {
                    // Calculator logic would go here
                  }}
                >
                  {btn}
                </button>
              ))}
            </div>
          </div>
        );

      case 'world-clock':
        return (
          <div className="grid grid-cols-2 gap-3">
            {[
              { city: 'New York', time: '10:30 AM', timezone: 'EST' },
              { city: 'London', time: '3:30 PM', timezone: 'GMT' },
              { city: 'Tokyo', time: '11:30 PM', timezone: 'JST' },
              { city: 'Sydney', time: '1:30 AM', timezone: 'AEDT' }
            ].map((clock, index) => (
              <div key={index} className="text-center">
                <div className="text-lg font-bold text-gray-700">{clock.time}</div>
                <div className="text-xs text-gray-500">{clock.city}</div>
                <div className="text-xs text-gray-400">{clock.timezone}</div>
              </div>
            ))}
          </div>
        );

      case 'bookmarks':
        return (
          <div className="space-y-2">
            {[
              { title: 'Atlas Documentation', url: '#', icon: '📚' },
              { title: 'OpenAI API Reference', url: '#', icon: '🤖' },
              { title: 'React Documentation', url: '#', icon: '⚛️' },
              { title: 'Tailwind CSS', url: '#', icon: '🎨' }
            ].map((bookmark, index) => (
              <a
                key={index}
                href={bookmark.url}
                className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <span>{bookmark.icon}</span>
                <span className="text-sm text-gray-700 truncate">{bookmark.title}</span>
              </a>
            ))}
            <button className="w-full p-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 transition-colors text-sm">
              + Add Bookmark
            </button>
          </div>
        );

      default:
        return (
          <div className="text-center text-gray-500">
            <div className="text-sm">Widget content not implemented</div>
          </div>
        );
    }
  };

  // Handle drag and drop for grid layout only
  useEffect(() => {
    if (!draggedWidget || widgetLayout !== 'grid') return;

    const handleMouseMove = (e: MouseEvent) => {
      const widget = widgets.find(w => w.id === draggedWidget);
      if (!widget) return;

      updateWidgetPosition(draggedWidget, {
        x: Math.max(0, e.clientX - widget.size.width / 2),
        y: Math.max(0, e.clientY - widget.size.height / 2)
      });
    };

    const handleMouseUp = () => {
      setDraggedWidget(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedWidget, widgets, widgetLayout]);

  if (!isVisible) return null;

  return (
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 p-4">
        {/* Widget Canvas */}
        <div className="relative w-full h-full bg-gray-100/50 dark:bg-gray-900/50 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Widget Dashboard</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Customize your Atlas experience • Layout: {widgetLayout}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Tooltip content="Add new widget" position="bottom">
                <button
                  onClick={() => setShowAddWidget(true)}
                  className="p-2 bg-atlas-sage hover:bg-atlas-sage text-white rounded-lg shadow-sm transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </Tooltip>
              
              <Tooltip content="Close widget dashboard" position="bottom">
                <button
                  onClick={onToggle}
                  className="p-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg shadow-sm transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </Tooltip>
            </div>
          </div>

        {/* Widgets Container */}
        <div className={`pt-20 pb-4 px-4 h-full ${getContainerClasses()}`}>
          {widgets.map(renderWidget)}
          
          {widgets.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">No widgets yet</h3>
                <p className="text-gray-500 mb-4">Add your first widget to get started</p>
                <button
                  onClick={() => setShowAddWidget(true)}
                  className="px-4 py-2 bg-atlas-sage hover:bg-atlas-sage text-white rounded-lg transition-colors"
                >
                  Add Widget
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden Widgets Panel */}
        {widgets.some(w => !w.visible) && (
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Hidden Widgets</div>
            <div className="flex gap-2">
              {widgets.filter(w => !w.visible).map(widget => {
                const widgetType = WIDGET_TYPES[widget.type as keyof typeof WIDGET_TYPES];
                return (
                  <Tooltip key={widget.id} content={`Show ${widget.title}`} position="top">
                    <button
                      onClick={() => toggleWidgetVisibility(widget.id)}
                      className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <widgetType.icon className="w-4 h-4 text-gray-600" />
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Widget Modal */}
      {showAddWidget && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-20">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Add Widget</h3>
                <button
                  onClick={() => setShowAddWidget(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-96">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(WIDGET_TYPES).map(([type, config]) => (
                  <button
                    key={type}
                    onClick={() => addWidget(type)}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 bg-${config.color}-100 rounded-lg group-hover:bg-${config.color}-200 transition-colors`}>
                        <config.icon className={`w-5 h-5 text-${config.color}-600`} />
                      </div>
                      <h4 className="font-medium text-gray-900">{config.name}</h4>
                    </div>
                    <p className="text-sm text-gray-600">{config.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WidgetSystem;