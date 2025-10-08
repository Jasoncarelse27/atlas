import { useState } from 'react';
import { Button, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { v4 as uuid } from 'uuid';
import { sendMessageToBackend } from '../services/chatService';
import { useMessageStore } from '../stores/useMessageStore';

export default function ChatScreen() {
  const [input, setInput] = useState('');
  const { messages, addMessage, updateAssistantMessage } = useMessageStore();

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: uuid(),
      role: 'user',
      content: input,
      createdAt: new Date().toISOString(),
    };

    addMessage(userMessage);
    setInput('');

    try {
      await sendMessageToBackend({
        conversationId: 'demo', // Replace with actual ID
        message: input,
        userId: '65fcb50a-d67d-453e-a405-50c6aef959be', // Add userId
        accessToken: 'your-supabase-access-token', // Replace with actual token
        tier: 'free', // Default tier for demo
        onMessage: (partial: string) => {
          updateAssistantMessage(partial);
        },
        onComplete: (full: string) => {
          // Message is already updated via onMessage
        },
        onError: (error: string) => {
          updateAssistantMessage('[Error generating response]');
        },
      });
    } catch (err: any) {
      updateAssistantMessage('[Error generating response]');
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Text style={item.role === 'user' ? styles.userText : styles.assistantText}>
            {item.content}
          </Text>
        )}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type your message"
        />
        <Button title="Send" onPress={handleSend} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  inputContainer: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, borderColor: '#ccc', borderWidth: 1, padding: 10, borderRadius: 4 },
  userText: { alignSelf: 'flex-end', marginVertical: 4, color: '#333' },
  assistantText: { alignSelf: 'flex-start', marginVertical: 4, color: '#007AFF' },
});
