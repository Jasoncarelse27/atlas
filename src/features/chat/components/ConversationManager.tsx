import React from 'react';

interface ConversationManagerProps {
  userId: string;
}

export default function ConversationManager({ userId }: ConversationManagerProps) {
  return (
    <div className="conversation-manager">
      <h2>Conversation Manager</h2>
      <p>User ID: {userId}</p>
    </div>
  );
}
