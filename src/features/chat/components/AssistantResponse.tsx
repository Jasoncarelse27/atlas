import React from 'react';
import TypingIndicator from '../../../components/TypingIndicator';

interface AssistantResponseProps {
  isLoading: boolean;
  message?: string;
}

const AssistantResponse: React.FC<AssistantResponseProps> = ({ isLoading, message = 'Atlas is thinking...' }) => {
  if (!isLoading) return null;
  return (
    <TypingIndicator isVisible message={message} />
  );
};

export default AssistantResponse;


