import { http, HttpResponse } from 'msw';

const store: Record<string, Array<{ id: string; role: 'user'|'assistant'; content: string }>> = {
  'TEST': [
    { id: '1', role: 'user', content: 'hi' },
    { id: '2', role: 'assistant', content: 'hello there!' }
  ]
}

export const handlers = [
  http.get('/api/conversations/:id/messages', ({ params }) => {
    const id = String(params.id)
    return HttpResponse.json(store[id] ?? [], { status: 200 })
  }),

  http.post('/api/conversations/:id/messages', async ({ params, request }) => {
    const id = String(params.id)
    const body = (await request.json()) as { content: string }
    const list = (store[id] ??= [])
    const msg = { id: String(Date.now()), role: 'user' as const, content: body.content }
    list.push(msg)
    return HttpResponse.json({ success: true, message: msg }, { status: 200 })
  }),
]
