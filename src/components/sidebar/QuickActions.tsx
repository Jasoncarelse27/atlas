
export default function QuickActions() {
  const actions = [
    { icon: '➕', label: 'Start New Chat', action: () => window.location.reload() },
    { icon: '📜', label: 'View History', action: () => console.log('View History') },
    { icon: '📊', label: 'Emotional Insights', action: () => console.log('Emotional Insights') },
    { icon: '⚙️', label: 'Settings', action: () => console.log('Settings') },
  ];

  return (
    <div className="bg-[#2c2f36] p-4 rounded-lg shadow">
      <h3 className="text-gray-300 text-sm font-medium mb-3">Quick Actions</h3>
      <ul className="space-y-2">
        {actions.map((action, index) => (
          <li key={index}>
            <button
              onClick={action.action}
              className="w-full text-left text-gray-200 hover:text-white hover:bg-gray-700/50 p-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
            >
              <span className="text-lg">{action.icon}</span>
              <span className="text-sm">{action.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
