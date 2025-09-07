import React from 'react';
import { View, SafeAreaView } from 'react-native';
import { ChatScreen } from './features/chat/screens/ChatScreen';

export default function Root() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <ChatScreen />
      </View>
    </SafeAreaView>
  );
}
