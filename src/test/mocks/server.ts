import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Mock API responses
export const handlers = [
  // Supabase Auth endpoints
  http.post('*/auth/v1/token', () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'mock-user-id',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
      },
    });
  }),

  // Supabase Messages endpoint
  http.post('*/functions/v1/messages', () => {
    return HttpResponse.json({
      success: true,
      message: 'Message stored successfully',
      data: {
        id: 'mock-message-id',
        conversation_id: 'mock-conversation-id',
        content: 'Mock response',
        timestamp: new Date().toISOString(),
      },
    });
  }),

  // Streaming messages endpoint
  http.post('*/functions/v1/messages', ({ request }) => {
    const url = new URL(request.url);
    const isStreaming = url.searchParams.get('stream') === '1';
    
    if (isStreaming) {
      return new HttpResponse(
        new ReadableStream({
          start(controller) {
            const response = 'This is a mock streaming response.';
            const words = response.split(' ');
            
            let currentIndex = 0;
            const streamWords = () => {
              if (currentIndex < words.length) {
                const chunk = words[currentIndex] + ' ';
                controller.enqueue(new TextEncoder().encode(chunk));
                currentIndex++;
                setTimeout(streamWords, 50); // Faster for testing
              } else {
                controller.close();
              }
            };
            
            streamWords();
          }
        }),
        {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        }
      );
    }
    
    return HttpResponse.json({
      success: true,
      message: 'Message stored successfully',
    });
  }),

  // MailerLite API endpoints
  http.post('https://connect.mailerlite.com/api/campaigns', () => {
    return HttpResponse.json({
      id: 'mock-campaign-id',
      name: 'Mock Campaign',
      status: 'sent',
    });
  }),

  http.post('https://connect.mailerlite.com/api/automations', () => {
    return HttpResponse.json({
      id: 'mock-automation-id',
      status: 'triggered',
    });
  }),

  // Health check endpoints
  http.get('*/healthz', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  }),

  http.get('*/ping', () => {
    return HttpResponse.json({
      pong: true,
      timestamp: new Date().toISOString(),
    });
  }),

  // Mock external AI API endpoints
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      id: 'mock-claude-response',
      content: [
        {
          type: 'text',
          text: 'This is a mock response from Claude AI.',
        },
      ],
      model: 'claude-3-sonnet-20240229',
      role: 'assistant',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
      },
    });
  }),

  http.post('https://api.groq.com/openai/v1/chat/completions', () => {
    return HttpResponse.json({
      id: 'mock-groq-response',
      object: 'chat.completion',
      created: Date.now(),
      model: 'llama3-8b-8192',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a mock response from Groq AI.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    });
  }),

  // Mock file upload endpoints
  http.post('*/storage/v1/object/upload', () => {
    return HttpResponse.json({
      path: 'mock-uploaded-file.jpg',
      id: 'mock-file-id',
      fullPath: 'public/mock-uploaded-file.jpg',
    });
  }),

  // Mock error responses for testing
  http.get('*/error-test', () => {
    return new HttpResponse(null, { status: 500 });
  }),

  http.get('*/timeout-test', () => {
    return new Promise(() => {}); // Never resolves, simulates timeout
  }),
];

// Create MSW server
export const server = setupServer(...handlers);

// Export mock data for tests
export const mockData = {
  user: {
    id: 'mock-user-id',
    email: 'test@example.com',
    name: 'Test User',
  },
  conversation: {
    id: 'mock-conversation-id',
    title: 'Test Conversation',
    messages: [
      {
        id: 'mock-message-1',
        role: 'user',
        content: 'Hello, AI!',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'mock-message-2',
        role: 'assistant',
        content: 'Hello! How can I help you today?',
        timestamp: new Date().toISOString(),
      },
    ],
  },
  message: {
    id: 'mock-message-id',
    conversation_id: 'mock-conversation-id',
    role: 'user',
    content: 'Test message',
    timestamp: new Date().toISOString(),
  },
  email: {
    welcome: {
      id: 'mock-welcome-email-id',
      subject: 'Welcome to Atlas AI',
      status: 'sent',
    },
    upgradeNudge: {
      id: 'mock-upgrade-nudge-id',
      subject: 'Upgrade Your Atlas Plan',
      status: 'sent',
    },
  },
};
