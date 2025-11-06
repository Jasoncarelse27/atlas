import { canUseVoiceEmotion } from '../../../config/featureAccess';
import { ClaudeResponse, getModelInfo } from '../lib/ClaudeRouter';

interface ClaudeResponseViewProps {
  response: ClaudeResponse;
}

export default function ClaudeResponseView({ response }: ClaudeResponseViewProps) {
  const modelInfo = getModelInfo(response.model);
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      {/* Model Info Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            canUseVoiceEmotion(modelInfo.tier)
              ? 'bg-purple-100 text-purple-800' 
              : 'bg-atlas-pearl text-atlas-text-dark'
          }`}>
            {modelInfo.tier.toUpperCase()}
          </div>
          <span className="text-sm font-medium text-gray-700">
            {modelInfo.name}
          </span>
        </div>
        
        {response.cached && (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Cached
          </div>
        )}
      </div>
      
      {/* Response Content */}
      <div className="prose prose-sm max-w-none mb-4">
        <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
          {response.content}
        </div>
      </div>
      
      {/* Usage Stats */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-4">
          <span>Input: {response.usage.input_tokens.toLocaleString()} tokens</span>
          <span>Output: {response.usage.output_tokens.toLocaleString()} tokens</span>
        </div>
        
        <div className="text-xs text-gray-400">
          ID: {response.id.slice(0, 8)}...
        </div>
      </div>
      
      {/* Model Description */}
      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">
          {modelInfo.description}
        </p>
      </div>
    </div>
  );
}
