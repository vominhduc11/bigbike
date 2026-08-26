import { env } from "@/env";

export type CustomerChatRealtimeEvent = {
  type: string;
  conversationId: string;
  latestSequence: number;
  channelState: string;
  occurredAt: string;
};

function frame(command: string, headers: Record<string, string> = {}): string {
  let value = `${command}\n`;
  for (const [key, headerValue] of Object.entries(headers)) value += `${key}:${headerValue}\n`;
  return `${value}\n\0`;
}

function parse(raw: string): { command: string; headers: Record<string, string>; body: string } {
  const text = raw.split("\0", 1)[0];
  const lines = text.split("\n");
  const headers: Record<string, string> = {};
  let index = 1;
  while (index < lines.length && lines[index] !== "") {
    const separator = lines[index].indexOf(":");
    if (separator > 0) headers[lines[index].slice(0, separator)] = lines[index].slice(separator + 1);
    index += 1;
  }
  return { command: lines[0]?.trim() || "", headers, body: lines.slice(index + 1).join("\n") };
}

export function connectCustomerChatRealtime(
  token: string,
  onEvent: (event: CustomerChatRealtimeEvent) => void,
  onConnected?: () => void,
): () => void {
  const apiBase = (env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
  const socket = new WebSocket(`${apiBase.replace(/^http/, "ws")}/ws`);

  socket.onopen = () => socket.send(frame("CONNECT", {
    "accept-version": "1.2,1.1,1.0",
    "heart-beat": "0,0",
    Authorization: `Bearer ${token}`,
  }));
  socket.onmessage = (message) => {
    if (typeof message.data !== "string") return;
    const parsed = parse(message.data);
    if (parsed.command === "CONNECTED") {
      socket.send(frame("SUBSCRIBE", { destination: "/user/queue/chat", id: "customer-chat" }));
      onConnected?.();
      return;
    }
    if (parsed.command === "MESSAGE" && parsed.body) {
      try {
        onEvent(JSON.parse(parsed.body) as CustomerChatRealtimeEvent);
      } catch {
        // REST history remains authoritative; malformed push hints are ignored.
      }
    }
    if (parsed.command === "ERROR") socket.close();
  };
  socket.onerror = () => socket.close();

  return () => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(frame("UNSUBSCRIBE", { id: "customer-chat" }));
      socket.send(frame("DISCONNECT"));
    }
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
  };
}
