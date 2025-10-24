import { AlertTriangle, CheckCircle, Clock, Play, XCircle } from 'lucide-react';
import React from 'react';
import ProgressBar from '../ProgressBar';

interface TestResult {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'running' | 'pending';
  score?: number;
  maxScore?: number;
  details?: string;
  recommendations?: string[];
  duration?: number;
  timestamp?: string;
}

interface TestResultCardProps {
  result: TestResult;
  onShowDetails: (id: string) => void;
}

const TestResultCard: React.FC<TestResultCardProps> = ({ result, onShowDetails }) => {
  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'running':
        return <Play className="w-5 h-5 text-atlas-sage animate-pulse" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return 'bg-green-500/10 border-green-500/20';
      case 'fail':
        return 'bg-red-500/10 border-red-500/20';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/20';
      case 'running':
        return 'bg-atlas-sage/10 border-atlas-sage/20';
      default:
        return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getStatusColor(result.status)} transition-all duration-200 hover:scale-105`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {getStatusIcon(result.status)}
          <h3 className="font-medium text-gray-200">{result.name}</h3>
        </div>
        <div className="flex items-center space-x-2">
          {result.duration && (
            <span className="text-xs text-gray-400">{result.duration}ms</span>
          )}
          {result.timestamp && (
            <span className="text-xs text-gray-400">
              {new Date(result.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {result.score !== undefined && result.maxScore !== undefined && (
        <div className="mb-3">
          <div className="flex justify-between text-sm text-gray-300 mb-1">
            <span>Score</span>
            <span>{result.score}/{result.maxScore}</span>
          </div>
          <ProgressBar 
            progress={(result.score / result.maxScore) * 100} 
            className="h-2"
          />
        </div>
      )}

      {result.details && (
        <p className="text-sm text-gray-300 mb-2 line-clamp-2">{result.details}</p>
      )}

      {result.recommendations && result.recommendations.length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-medium text-gray-400 mb-1">Recommendations:</h4>
          <ul className="text-xs text-gray-300 space-y-1">
            {result.recommendations.slice(0, 2).map((rec, index) => (
              <li key={index} className="flex items-start space-x-1">
                <span className="text-atlas-sage mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={() => onShowDetails(result.id)}
        className="w-full mt-2 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
      >
        View Details
      </button>
    </div>
  );
};

export default TestResultCard;
