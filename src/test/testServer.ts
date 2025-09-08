import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const server = setupServer(
  // Example mock: messages list
  http.get("/api/conversations/:id/messages", ({ params }) => {
    return HttpResponse.json([
      { id: "1", conversationId: String(params.id), role: "user", content: "hi", createdAt: new Date().toISOString() },
    ]);
  }),
  // Example mock: send message
  http.post("/api/conversations/:id/messages", async ({ request, params }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      id: "2", conversationId: String(params.id), role: "user", content: body.content, createdAt: new Date().toISOString(),
    });
  }),
);
