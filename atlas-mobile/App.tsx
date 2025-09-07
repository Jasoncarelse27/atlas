import React from 'react';
import ChatScreen from './src/features/chat/screens/ChatScreen';
import AtlasQueryProvider from './src/lib/queryClient';

export default function App() {
  return (
    <AtlasQueryProvider>
      <ChatScreen />
    </AtlasQueryProvider>
  );
}