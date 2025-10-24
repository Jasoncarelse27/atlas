import { Check, Clock, Mail, RefreshCw, X } from 'lucide-react';
import React, { useState } from 'react';
import { mailerService } from '../services/mailerService';

interface EmailFlow {
  id: string;
  name: string;
  icon: React.ReactNode;
  trigger: string;
  api: string;
  supabaseTrigger: 'Yes' | 'Planned' | 'CRON Planned';
  testStatus: boolean;
}

interface EmailTestChecklistProps {
  className?: string;
}

const EmailTestChecklist: React.FC<EmailTestChecklistProps> = ({ className = '' }) => {
  const [emailFlows, setEmailFlows] = useState<EmailFlow[]>([
    {
      id: 'welcome',
      name: 'Welcome',
      icon: <Check className="w-4 h-4 text-green-500" />,
      trigger: 'User Signup',
      api: 'sendWelcomeEmail',
      supabaseTrigger: 'Yes',
      testStatus: false,
    },
    {
      id: 'upgrade_nudge',
      name: 'Upgrade Nudge',
      icon: <RefreshCw className="w-4 h-4 text-atlas-sage" />,
      trigger: 'Usage cap reached',
      api: 'sendUpgradeNudge',
      supabaseTrigger: 'Planned',
      testStatus: false,
    },
    {
      id: 'inactivity_reminder',
      name: 'Inactivity',
      icon: <RefreshCw className="w-4 h-4 text-orange-500" />,
      trigger: '7 days inactive',
      api: 'sendInactivityReminder',
      supabaseTrigger: 'Planned',
      testStatus: false,
    },
    {
      id: 'weekly_summary',
      name: 'Weekly Summary',
      icon: <RefreshCw className="w-4 h-4 text-purple-500" />,
      trigger: 'Weekly CRON',
      api: 'sendWeeklySummary',
      supabaseTrigger: 'CRON Planned',
      testStatus: false,
    },
  ]);

  const [testEmail, setTestEmail] = useState('');
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message?: string; error?: string }>>({});

  const handleTestEmail = async (flowId: string) => {
    if (!testEmail.trim()) {
      alert('Please enter a test email address');
      return;
    }

    setIsTesting(flowId);
    
    try {
      const result = await mailerService.testEmailFlow(
        { email: testEmail, name: 'Test User' },
        flowId as any
      );

      setTestResults(prev => ({
        ...prev,
        [flowId]: result
      }));

      if (result.success) {
        setEmailFlows(prev => prev.map(flow => 
          flow.id === flowId ? { ...flow, testStatus: true } : flow
        ));
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [flowId]: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    } finally {
      setIsTesting(null);
    }
  };

  const getSupabaseTriggerIcon = (status: string) => {
    switch (status) {
      case 'Yes':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'Planned':
      case 'CRON Planned':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <X className="w-4 h-4 text-red-500" />;
    }
  };

  const getTestStatusIcon = (flowId: string) => {
    const result = testResults[flowId];
    if (isTesting === flowId) {
      return <div className="w-4 h-4 border-2 border-atlas-sage border-t-transparent rounded-full animate-spin" />;
    }
    if (result?.success) {
      return <Check className="w-4 h-4 text-green-500" />;
    }
    if (result?.error) {
      return <X className="w-4 h-4 text-red-500" />;
    }
    return <div className="w-4 h-4 border border-gray-300 rounded" />;
  };

  return (
    <div className={`bg-gray-800 text-white p-6 rounded-lg ${className}`}>
      <div className="flex items-center gap-2 mb-6">
        <Mail className="w-6 h-6 text-atlas-sage" />
        <h2 className="text-xl font-bold">Email Test Checklist</h2>
      </div>

      {/* Test Email Input */}
      <div className="mb-6 p-4 bg-gray-700 rounded-lg">
        <label htmlFor="test-email" className="block text-sm font-medium mb-2">
          Test Email Address
        </label>
        <div className="flex gap-2">
          <input
            id="test-email"
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@example.com"
            className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-atlas-sage"
          />
          <button
            onClick={() => {
              setTestEmail('');
              setTestResults({});
              setEmailFlows(prev => prev.map(flow => ({ ...flow, testStatus: false })));
            }}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Email Flows Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-600">
              <th className="text-left py-3 px-4 font-medium">Email Flow</th>
              <th className="text-left py-3 px-4 font-medium">Trigger</th>
              <th className="text-left py-3 px-4 font-medium">API</th>
              <th className="text-left py-3 px-4 font-medium">Supabase Trigger</th>
              <th className="text-left py-3 px-4 font-medium">Test Status</th>
              <th className="text-left py-3 px-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {emailFlows.map((flow) => (
              <tr key={flow.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {flow.icon}
                    <span className="font-medium">{flow.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-gray-300">{flow.trigger}</td>
                <td className="py-3 px-4 text-gray-300 font-mono text-sm">{flow.api}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {getSupabaseTriggerIcon(flow.supabaseTrigger)}
                    <span className="text-gray-300">{flow.supabaseTrigger}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {getTestStatusIcon(flow.id)}
                    <span className="text-gray-300">
                      {isTesting === flow.id ? 'Testing...' : 
                       testResults[flow.id]?.success ? 'Passed' :
                       testResults[flow.id]?.error ? 'Failed' : 'Not Tested'}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => handleTestEmail(flow.id)}
                    disabled={isTesting === flow.id || !testEmail.trim()}
                    className="px-3 py-1 bg-atlas-sage hover:bg-atlas-success disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm transition-colors"
                  >
                    {isTesting === flow.id ? 'Testing...' : 'Test'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <div className="mt-6 p-4 bg-gray-700 rounded-lg">
          <h3 className="font-medium mb-3">Test Results</h3>
          <div className="space-y-2">
            {Object.entries(testResults).map(([flowId, result]) => {
              const flow = emailFlows.find(f => f.id === flowId);
              return (
                <div key={flowId} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{flow?.name}:</span>
                  {result.success ? (
                    <span className="text-green-400">✅ {result.message || 'Email sent successfully'}</span>
                  ) : (
                    <span className="text-red-400">❌ {result.error || 'Test failed'}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Setup Instructions */}
      <div className="mt-6 p-4 bg-blue-900/20 border border-atlas-sage/30 rounded-lg">
        <h3 className="font-medium mb-2 text-blue-300">Setup Instructions</h3>
        <div className="text-sm text-gray-300 space-y-1">
          <p>1. Set environment variables: <code className="bg-gray-800 px-1 rounded">VITE_MAILERLITE_API_KEY</code></p>
          <p>2. Run SQL setup: <code className="bg-gray-800 px-1 rounded">SUPABASE_EMAIL_SETUP.sql</code></p>
          <p>3. Deploy Edge Functions: <code className="bg-gray-800 px-1 rounded">supabase functions deploy</code></p>
          <p>4. Configure Supabase settings in dashboard</p>
        </div>
      </div>
    </div>
  );
};

export default EmailTestChecklist;
