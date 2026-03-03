import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/guards";

// SSE Client connection type
type SSEClient = {
  id: string;
  projectId: string | null;
  controller: ReadableStreamDefaultController;
  lastEventId: string | null;
};

// Global clients map (in-memory for this instance)
const clients = new Map<string, SSEClient>();

// Generate unique client ID
function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Send SSE event to a client
function sendEvent(client: SSEClient, event: string, data: unknown) {
  try {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoder = new TextEncoder();
    client.controller.enqueue(encoder.encode(message));
  } catch (e) {
    // Client disconnected
    clients.delete(client.id);
  }
}

// Broadcast event to all clients or filtered by project
export function broadcastEvent(event: string, data: unknown, projectId?: string) {
  for (const client of clients.values()) {
    if (!projectId || !client.projectId || client.projectId === projectId) {
      sendEvent(client, event, data);
    }
  }
}

export async function GET(request: NextRequest) {
  const claims = requireAuth(request);
  if (claims instanceof NextResponse) return claims;

  const projectId = request.nextUrl.searchParams.get("project_id");
  const lastEventId = request.nextUrl.searchParams.get("last_event_id");

  const clientId = generateClientId();

  const stream = new ReadableStream({
    start(controller) {
      // Store client connection
      const client: SSEClient = {
        id: clientId,
        projectId,
        controller,
        lastEventId,
      };
      clients.set(clientId, client);

      // Send initial connection event
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({
            clientId,
            projectId,
            timestamp: new Date().toISOString(),
            message: "SSE connection established",
          })}\n\n`,
        ),
      );

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
          clients.delete(clientId);
        }
      }, 30000);

      // Clean up on close
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        clients.delete(clientId);
        console.log(`[SSE] Client ${clientId} disconnected`);
      });
    },
    cancel() {
      clients.delete(clientId);
      console.log(`[SSE] Client ${clientId} cancelled`);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}

// POST endpoint to trigger SSE events from webhooks
export async function POST(request: NextRequest) {
  const claims = requireAuth(request);
  if (claims instanceof NextResponse) return claims;

  try {
    const payload = await request.json() as {
      event: string;
      data: unknown;
      projectId?: string;
    };

    broadcastEvent(payload.event, payload.data, payload.projectId);

    return NextResponse.json({
      success: true,
      clientsCount: clients.size,
      message: `Event "${payload.event}" broadcast to ${clients.size} clients`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid payload", message: String(error) },
      { status: 400 },
    );
  }
}
