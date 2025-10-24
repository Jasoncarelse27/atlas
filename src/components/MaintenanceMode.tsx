// Atlas Maintenance Mode Component
// Display when daily API budget is exceeded or system is in maintenance

import { AlertTriangle, Clock, Shield, TrendingUp } from 'lucide-react';

interface MaintenanceModeProps {
  reason: 'budget_exceeded' | 'maintenance' | 'high_demand';
  estimatedRestoreTime?: string;
  currentBudgetUsage?: number;
}

export function MaintenanceMode({ 
  reason, 
  estimatedRestoreTime = "a few hours",
  currentBudgetUsage = 0 
}: MaintenanceModeProps) {
  
  const getMaintenanceInfo = () => {
    switch (reason) {
      case 'budget_exceeded':
        return {
          icon: <TrendingUp className="w-12 h-12 text-orange-500" />,
          title: "High Demand Protection Active",
          message: "Atlas has reached its daily usage limit to ensure consistent service for all users.",
          subtitle: "This helps us maintain quality while keeping costs sustainable.",
          restoreTime: "Service will restore automatically at midnight UTC"
        };
      
      case 'maintenance':
        return {
          icon: <Shield className="w-12 h-12 text-atlas-sage" />,
          title: "Scheduled Maintenance",
          message: "Atlas is currently undergoing scheduled maintenance to improve your experience.",
          subtitle: "We're working to make Atlas even better for you.",
          restoreTime: `Expected completion: ${estimatedRestoreTime}`
        };
        
      case 'high_demand':
      default:
        return {
          icon: <AlertTriangle className="w-12 h-12 text-yellow-500" />,
          title: "High Demand",
          message: "Atlas is experiencing unusually high demand right now.",
          subtitle: "We're scaling up to accommodate everyone.",
          restoreTime: `Normal service should resume within ${estimatedRestoreTime}`
        };
    }
  };

  const info = getMaintenanceInfo();

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          {info.icon}
        </div>
        
        {/* Main Message */}
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          {info.title}
        </h2>
        
        <p className="text-gray-600 mb-2 leading-relaxed">
          {info.message}
        </p>
        
        <p className="text-sm text-gray-500 mb-6">
          {info.subtitle}
        </p>

        {/* Status Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center mb-3">
            <Clock className="w-4 h-4 text-gray-400 mr-2" />
            <span className="text-sm font-medium text-gray-700">
              {info.restoreTime}
            </span>
          </div>
          
          {reason === 'budget_exceeded' && currentBudgetUsage > 0 && (
            <div className="text-xs text-gray-500">
              Daily budget usage: {currentBudgetUsage.toFixed(1)}%
            </div>
          )}
        </div>

        {/* What Users Can Do */}
        <div className="text-left bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">In the meantime:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Check back in a few hours</li>
            <li>• Follow @AtlasAI for updates</li>
            <li>• Premium users get priority access</li>
            {reason === 'budget_exceeded' && (
              <li>• Service automatically resumes at midnight UTC</li>
            )}
          </ul>
        </div>

        {/* Emergency Support */}
        <div className="mt-6 text-xs text-gray-400">
          If you're experiencing a mental health emergency, please contact your local emergency services or crisis helpline immediately.
        </div>
      </div>
    </div>
  );
}
