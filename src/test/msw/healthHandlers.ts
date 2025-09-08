import { http, HttpResponse } from 'msw';

export const healthHandlers = [
  http.get('/healthz', () => HttpResponse.json({ ok: true, source: 'msw' }, { status: 200 })),
];
