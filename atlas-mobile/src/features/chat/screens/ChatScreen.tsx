import React, { useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type Role = 'user' | 'assistant';
type Message = { id: string; role: Role; text: string; timestamp: number };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0f' },
  list: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  bubbleRow: { marginVertical: 6, flexDirection: 'row' },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  user: { alignSelf: 'flex-end', backgroundColor: '#2d6cdf' },
  assistant: { alignSelf: 'flex-start', backgroundColor: '#1f1f24' },
  text: { color: 'white', fontSize: 16, lineHeight: 21 },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#27272a' },
  input: { flex: 1, height: 44, borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#17171b', color: 'white' },
  sendBtn: { height: 44, paddingHorizontal: 16, backgroundColor: '#2d6cdf', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sendLabel: { color: 'white', fontWeight: '600' },
  header: { paddingVertical: 14, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#222' },
  title: { color: 'white', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#a1a1aa', fontSize: 12, marginTop: 2 },
});

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ChatScreen() {
  const conversationId = 'dev-convo';
  const queryKey = useMemo(() => ['convo', conversationId] as const, [conversationId]);
  const qc = useQueryClient();
  const listRef = useRef<FlatList<Message>>(null);

  // Default queryFn: return whatever is in cache (or empty)
  const { data: messages = [] } = useQuery({
    queryKey,
    queryFn: async () => (qc.getQueryData<Message[]>(queryKey) ?? []),
  });

  // Fake-streaming assistant reply after user sends a message.
  const send = useMutation({
    mutationFn: async (text: string) => {
      // simulate network + token stream
      await new Promise((r) => setTimeout(r, 100));
      const replyId = uid();
      const replyPrefix: Message = { id: replyId, role: 'assistant', text: '', timestamp: Date.now() };

      // start streaming: add empty assistant msg, then append chunks
      qc.setQueryData<Message[]>(queryKey, (cur = []) => [...cur, replyPrefix]);

      const chunks = (`You said: ${text}`).split(' ');
      for (const chunk of chunks) {
        await new Promise((r) => setTimeout(r, 60));
        qc.setQueryData<Message[]>(queryKey, (cur = []) => {
          const copy = cur.slice();
          const idx = copy.findIndex((m) => m.id === replyId);
          if (idx >= 0) copy[idx] = { ...copy[idx], text: (copy[idx].text + (copy[idx].text ? ' ' : '') + chunk) };
          return copy;
        });
      }
      return true;
    },
    onMutate: async (text) => {
      // optimistic user message
      const msg: Message = { id: uid(), role: 'user', text, timestamp: Date.now() };
      qc.setQueryData<Message[]>(queryKey, (cur = []) => [...cur, msg]);
      // scroll to bottom on next frame
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    },
  });

  const [text, setText] = useState('');

  const onSend = () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    send.mutate(t);
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubbleRow, { justifyContent: isUser ? 'flex-end' : 'flex-start' }]}>
        <View style={[styles.bubble, isUser ? styles.user : styles.assistant]}>
          <Text style={styles.text}>{item.text || (isUser ? '' : '…')}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
      <View style={styles.header}>
        <Text style={styles.title}>Atlas AI</Text>
        <Text style={styles.subtitle}>Chat Assistant</Text>
      </View>

      <FlatList
        ref={listRef}
        style={styles.list}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type your message..."
          placeholderTextColor="#6b7280"
          returnKeyType="send"
          onSubmitEditing={onSend}
        />
        <Pressable onPress={onSend} style={({ pressed }) => [styles.sendBtn, { opacity: pressed ? 0.8 : 1 }]}>
          <Text style={styles.sendLabel}>{send.isPending ? '…' : 'Send'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}