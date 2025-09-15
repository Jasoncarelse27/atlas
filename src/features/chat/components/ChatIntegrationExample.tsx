import React from 'react';
import ChatScreen from './ChatScreen';

// Example of how to integrate ChatScreen into your main app
export default function ChatIntegrationExample() {
  // In a real app, you'd get this from your auth system
  const userId = 'user-123'; // Replace with actual user ID from your auth
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Atlas AI Chat
        </h1>
        
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <ChatScreen userId={userId} />
        </div>
      </div>
    </div>
  );
}

// Usage in your main App.tsx:
/*
import ChatIntegrationExample from '../features/chat/components/ChatIntegrationExample';

function App() {
  return (
    <div className="App">
      <ChatIntegrationExample />
    </div>
  );
}
*/
