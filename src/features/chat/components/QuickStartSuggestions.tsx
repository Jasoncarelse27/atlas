import { Lightbulb, MessageSquare, Sparkles, Zap } from 'lucide-react';
import React from 'react';

interface QuickStartSuggestionsProps {
  onSuggestionClick: (suggestion: string) => void;
  isVisible: boolean;
}

const QuickStartSuggestions: React.FC<QuickStartSuggestionsProps> = ({
  onSuggestionClick,
  isVisible
}) => {
  const suggestions = [
    {
      icon: <Lightbulb className="w-4 h-4" />,
      title: "Brainstorm Ideas",
      description: "Help me brainstorm creative ideas for...",
      prompt: "Help me brainstorm creative ideas for a new project. I'm looking for innovative approaches that could set it apart from existing solutions."
    },
    {
      icon: <MessageSquare className="w-4 h-4" />,
      title: "Writing Assistant",
      description: "Help me write a professional email about...",
      prompt: "Help me write a professional email to a client about a project delay. Keep it positive and solution-focused."
    },
    {
      icon: <Zap className="w-4 h-4" />,
      title: "Code Review",
      description: "Review this code and suggest improvements...",
      prompt: "Review this code and suggest improvements for performance, readability, and best practices."
    },
    {
      icon: <Sparkles className="w-4 h-4" />,
      title: "Creative Writing",
      description: "Write a short story about...",
      prompt: "Write a short story about a character who discovers they can see into the future, but only for 24 hours ahead."
    }
  ];

  if (!isVisible) return null;

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 p-2 bg-white rounded-full shadow-sm mb-3">
          <Sparkles className="w-5 h-5 text-purple-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Get Started with Atlas AI
        </h3>
        <p className="text-sm text-gray-600">
          Try these suggestions to explore what Atlas can do for you
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSuggestionClick(suggestion.prompt)}
            className="group p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 text-left"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 p-2 bg-blue-100 group-hover:bg-blue-200 rounded-lg transition-colors">
                {suggestion.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                  {suggestion.title}
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  {suggestion.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-100 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 bg-blue-200 rounded-lg">
            <MessageSquare className="w-4 h-4 text-blue-700" />
          </div>
          <div>
            <h4 className="font-medium text-blue-900 mb-1">
              Pro Tip
            </h4>
            <p className="text-sm text-blue-800">
              You can also upload images, use voice input, or ask Atlas to help with any task. 
              The more specific you are, the better the results!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickStartSuggestions;
