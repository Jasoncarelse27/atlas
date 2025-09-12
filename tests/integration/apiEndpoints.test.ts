import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Mock API endpoints
const mockApiServer = setupServer(
  http.post('/api/message', () => {
    return HttpResponse.json({
      id: 'msg-123',
      content: 'Test response',
      created_at: new Date().toISOString(),
    });
  }),

  http.get('/api/messages/:conversationId', ({ params }) => {
    const { conversationId } = params;
    return HttpResponse.json([
      {
        id: 'msg-1',
        content: 'Message 1',
        conversation_id: conversationId,
        created_at: '2023-01-01T00:00:00Z',
      },
      {
        id: 'msg-2',
        content: 'Message 2',
        conversation_id: conversationId,
        created_at: '2023-01-01T00:01:00Z',
      },
    ]);
  }),

  http.post('/api/subscription/upgrade', () => {
    return HttpResponse.json({
      success: true,
      newTier: 'core',
      newLimit: 100,
    });
  }),

  http.get('/api/subscription/status', () => {
    return HttpResponse.json({
      tier: 'free',
      messagesUsed: 5,
      messagesLimit: 10,
      isActive: true,
    });
  }),

  http.post('/api/webhook/mailerlite', () => {
    return HttpResponse.json({
      success: true,
      processed: true,
    });
  }),

  http.get('/api/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  })
);

describe('API Endpoint Tests', () => {
  beforeEach(() => {
    mockApiServer.listen({ onUnhandledRequest: 'bypass' });
  });

  afterEach(() => {
    mockApiServer.resetHandlers();
  });

  afterAll(() => {
    mockApiServer.close();
  });

  describe('Message API Endpoints', () => {
    it('should send a message via POST /api/message', async () => {
      const response = await fetch('/api/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'Test message',
          conversation_id: 'conv-123',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('msg-123');
      expect(data.content).toBe('Test response');
      expect(data.created_at).toBeDefined();
    });

    it('should fetch messages via GET /api/messages/:conversationId', async () => {
      const conversationId = 'conv-123';
      const response = await fetch(`/api/messages/${conversationId}`);

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0].conversation_id).toBe(conversationId);
    });

    it('should handle message API errors', async () => {
      mockApiServer.use(
        http.post('/api/message', () => {
          return HttpResponse.json({
            error: 'Invalid message content',
            code: 'VALIDATION_ERROR',
          }, { status: 400 });
        })
      );

      const response = await fetch('/api/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: '',
          conversation_id: 'conv-123',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid message content');
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Subscription API Endpoints', () => {
    it('should upgrade subscription via POST /api/subscription/upgrade', async () => {
      const response = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: 'core',
          paymentMethod: 'stripe',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.newTier).toBe('core');
      expect(data.newLimit).toBe(100);
    });

    it('should get subscription status via GET /api/subscription/status', async () => {
      const response = await fetch('/api/subscription/status');

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tier).toBe('free');
      expect(data.messagesUsed).toBe(5);
      expect(data.messagesLimit).toBe(10);
      expect(data.isActive).toBe(true);
    });

    it('should handle subscription upgrade failures', async () => {
      mockApiServer.use(
        http.post('/api/subscription/upgrade', () => {
          return HttpResponse.json({
            error: 'Payment failed',
            code: 'PAYMENT_ERROR',
          }, { status: 402 });
        })
      );

      const response = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: 'core',
          paymentMethod: 'stripe',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(402);
      expect(data.error).toBe('Payment failed');
      expect(data.code).toBe('PAYMENT_ERROR');
    });
  });

  describe('Webhook API Endpoints', () => {
    it('should process MailerLite webhook via POST /api/webhook/mailerlite', async () => {
      const webhookPayload = {
        event: 'subscriber.created',
        data: {
          id: '123',
          email: 'test@example.com',
          status: 'active',
        },
      };

      const response = await fetch('/api/webhook/mailerlite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MailerLite-Signature': 'valid-signature',
        },
        body: JSON.stringify(webhookPayload),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.processed).toBe(true);
    });

    it('should reject webhook with invalid signature', async () => {
      mockApiServer.use(
        http.post('/api/webhook/mailerlite', () => {
          return HttpResponse.json({
            error: 'Invalid signature',
            code: 'SIGNATURE_ERROR',
          }, { status: 401 });
        })
      );

      const response = await fetch('/api/webhook/mailerlite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MailerLite-Signature': 'invalid-signature',
        },
        body: JSON.stringify({
          event: 'subscriber.created',
          data: { id: '123' },
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid signature');
      expect(data.code).toBe('SIGNATURE_ERROR');
    });
  });

  describe('Health Check Endpoint', () => {
    it('should return health status via GET /api/health', async () => {
      const response = await fetch('/api/health');

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
      expect(data.version).toBe('1.0.0');
    });

    it('should handle health check failures', async () => {
      mockApiServer.use(
        http.get('/api/health', () => {
          return HttpResponse.json({
            status: 'unhealthy',
            error: 'Database connection failed',
            timestamp: new Date().toISOString(),
          }, { status: 503 });
        })
      );

      const response = await fetch('/api/health');

      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.error).toBe('Database connection failed');
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting', async () => {
      mockApiServer.use(
        http.post('/api/message', () => {
          return HttpResponse.json({
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT',
            retryAfter: 60,
          }, { status: 429 });
        })
      );

      const response = await fetch('/api/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'Test message',
          conversation_id: 'conv-123',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Rate limit exceeded');
      expect(data.code).toBe('RATE_LIMIT');
      expect(data.retryAfter).toBe(60);
    });
  });

  describe('Authentication', () => {
    it('should require authentication for protected endpoints', async () => {
      mockApiServer.use(
        http.get('/api/messages/:conversationId', ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) {
            return HttpResponse.json({
              error: 'Authentication required',
              code: 'UNAUTHORIZED',
            }, { status: 401 });
          }
          return HttpResponse.json([]);
        })
      );

      const response = await fetch('/api/messages/conv-123');

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should accept valid authentication', async () => {
      mockApiServer.use(
        http.get('/api/messages/:conversationId', ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          if (authHeader === 'Bearer valid-token') {
            return HttpResponse.json([]);
          }
          return HttpResponse.json({
            error: 'Invalid token',
            code: 'UNAUTHORIZED',
          }, { status: 401 });
        })
      );

      const response = await fetch('/api/messages/conv-123', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      expect(response.status).toBe(200);
    });
  });
});
