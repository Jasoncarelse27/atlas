// Atlas Agents List Component
// Displays active agents and monitored inboxes

import { Mail, CheckCircle2 } from 'lucide-react';
import React from 'react';

const AgentsList: React.FC = () => {
  const monitoredInboxes = [
    'info@otiumcreations.com',
    'admin@otiumcreations.com',
    'jason@otiumcreations.com',
    'rima@otiumcreations.com'
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-[#B2BDA3]/20 dark:bg-[#B2BDA3]/30 rounded-lg">
          <Mail className="w-5 h-5 text-[#B2BDA3] dark:text-[#B2BDA3]" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Email Agent
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Active</span>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Monitored Inboxes:
        </p>
        <ul className="space-y-2">
          {monitoredInboxes.map((email, index) => (
            <li
              key={index}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#B2BDA3]"></div>
              <span className="font-mono">{email}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-500 italic">
          More agents coming soon
        </p>
      </div>
    </div>
  );
};

export default AgentsList;

