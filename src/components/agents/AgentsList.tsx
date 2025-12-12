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
    <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="p-1.5 sm:p-2 bg-[#B2BDA3]/20 dark:bg-[#B2BDA3]/30 rounded-lg flex-shrink-0">
          <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-[#B2BDA3] dark:text-[#B2BDA3]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            Email Agent
          </h3>
          <div className="flex items-center gap-1.5 sm:gap-2 mt-1">
            <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Active</span>
          </div>
        </div>
      </div>

      <div className="mt-3 sm:mt-4">
        <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
          Monitored Inboxes:
        </p>
        <ul className="space-y-1.5 sm:space-y-2">
          {monitoredInboxes.map((email, index) => (
            <li
              key={index}
              className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400"
            >
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#B2BDA3] flex-shrink-0"></div>
              <span className="font-mono break-all">{email}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500 italic">
          More agents coming soon
        </p>
      </div>
    </div>
  );
};

export default AgentsList;

