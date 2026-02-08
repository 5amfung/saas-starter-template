# ElevenAgents Reference

## Node.js SDK

### Installation and Setup

```bash
bun install @elevenlabs/elevenlabs-js
```

```typescript
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});
```

### Tracking Generation Costs

```typescript
const { data, rawResponse } = await client.textToSpeech
  .convert("voice_id", {
    text: "Hello, world!",
    modelId: "eleven_multilingual_v2",
  })
  .withRawResponse();

const charCost = rawResponse.headers.get("x-character-count");
const requestId = rawResponse.headers.get("request-id");
const audioData = data;
```

### Generating Signed URLs (Server-Side)

```typescript
// Express.js example — never expose API key to client.
app.get("/signed-url", authMiddleware, async (req, res) => {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${process.env.AGENT_ID}`,
    {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
    }
  );

  if (!response.ok) {
    return res.status(500).send("Failed to get signed URL");
  }

  const body = await response.json();
  res.send(body.signed_url);
});
```

### Generating Conversation Tokens (for WebRTC)

```typescript
app.get("/conversation-token", authMiddleware, async (req, res) => {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-conversation-token?agent_id=${process.env.AGENT_ID}`,
    {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
    }
  );

  if (!response.ok) {
    return res.status(500).send("Failed to get conversation token");
  }

  const body = await response.json();
  res.send(body);
});
```

---

## React SDK (`@elevenlabs/react`)

### `useConversation` Hook

#### Initialization Options

```typescript
import { useConversation } from "@elevenlabs/react";

const conversation = useConversation({
  // Client tools invokable by the agent.
  clientTools: {
    toolName: (parameters: Record<string, unknown>) => {
      // Execute client-side logic.
      return "result string"; // Returned to agent if tool is blocking.
    },
  },

  // Override agent settings per session.
  overrides: {
    agent: {
      prompt: { prompt: "Custom prompt" },
      firstMessage: "Custom greeting",
      language: "en",
    },
    tts: { voiceId: "voice-id" },
    conversation: { textOnly: true },
  },

  // Text-only mode (no audio/microphone).
  textOnly: false,

  // Server region.
  serverLocation: "us", // "us" | "eu-residency" | "in-residency" | "global"

  // Controlled state.
  micMuted: false,
  volume: 0.8,

  // Callbacks.
  onConnect: () => {},
  onDisconnect: () => {},
  onMessage: (message) => {},
  onError: (error) => {},
  onAudio: (audioData) => {},
  onModeChange: ({ mode }) => {}, // "speaking" | "listening"
  onStatusChange: ({ status }) => {},
  onCanSendFeedbackChange: (canSend) => {},
  onDebug: (debugInfo) => {},
  onUnhandledClientToolCall: (toolCall) => {},
  onVadScore: (score) => {},
  onAudioAlignment: (alignment) => {},
});
```

#### Methods

| Method | Description |
|--------|-------------|
| `startSession({ agentId, connectionType?, signedUrl?, conversationToken?, userId? })` | Start a conversation. Returns `conversationId`. |
| `endSession()` | End the conversation and disconnect. |
| `setVolume({ volume })` | Set output volume (0-1). |
| `sendUserMessage(text)` | Send a text message (triggers agent response). |
| `sendContextualUpdate(text)` | Send context without triggering a response. |
| `sendFeedback(positive)` | Send positive (`true`) or negative (`false`) feedback. |
| `sendUserActivity()` | Signal user activity to prevent agent interruption (~2s pause). |
| `changeInputDevice(options)` | Switch audio input device mid-conversation. |
| `changeOutputDevice(options)` | Switch audio output device mid-conversation. |
| `getId()` | Get current conversation ID. |
| `getInputVolume()` / `getOutputVolume()` | Get current volume levels (0-1). |
| `getInputByteFrequencyData()` / `getOutputByteFrequencyData()` | Get frequency data as `Uint8Array` for visualizations. |
| `sendMCPToolApprovalResult(toolCallId, approved)` | Approve or reject MCP tool calls. |

#### Reactive State

| Property | Type | Description |
|----------|------|-------------|
| `status` | `"connected" \| "disconnected"` | Current connection status. |
| `isSpeaking` | `boolean` | Whether the agent is currently speaking. |
| `canSendFeedback` | `boolean` | Whether feedback can be submitted. |

#### Starting a Session

```typescript
// Public agent (no auth).
const conversationId = await conversation.startSession({
  agentId: "<your-agent-id>",
  connectionType: "webrtc", // "webrtc" or "websocket"
  userId: "<your-end-user-id>", // Optional, for mapping conversations to users.
});

// Private agent via signed URL (WebSocket).
const signedUrl = await fetch("/signed-url").then((r) => r.text());
await conversation.startSession({ signedUrl, connectionType: "websocket" });

// Private agent via conversation token (WebRTC).
const token = await fetch("/conversation-token").then((r) => r.json());
await conversation.startSession({
  conversationToken: token.token,
  connectionType: "webrtc",
});
```

---

## WebSocket API

### Endpoint

```
wss://api.elevenlabs.io/v1/convai/conversation?agent_id={agent_id}
```

For private agents, use a signed URL:

```
wss://api.elevenlabs.io/v1/convai/conversation?agent_id={agent_id}&token={token}
```

### Connection Flow

1. Open WebSocket connection.
2. Send `conversation_initiation_client_data` event.
3. Begin sending audio chunks and handling server events.
4. Respond to `ping` events with `pong` to keep connection alive.

### Server-to-Client Events

| Event Type | Description | Key Fields |
|------------|-------------|------------|
| `user_transcript` | Transcription of user speech. | `user_transcription_event.user_transcript` |
| `agent_response` | Agent's text response. | `agent_response_event.agent_response` |
| `agent_response_correction` | Correction to a previous response. | `agent_response_correction_event.{original_agent_response, corrected_agent_response}` |
| `audio` | Base64-encoded audio chunk. | `audio_event.{audio_base_64, event_id, alignment}` |
| `interruption` | Agent was interrupted. | `interruption_event.reason` |
| `ping` | Keep-alive ping. | `ping_event.{event_id, ping_ms}` |

### Client-to-Server Events

| Event Type | Description | Payload |
|------------|-------------|---------|
| `conversation_initiation_client_data` | Initialize conversation. | `{ type: "conversation_initiation_client_data" }` |
| `pong` | Response to ping. | `{ type: "pong", event_id: number }` |
| `contextual_update` | Non-interrupting context. | `{ type: "contextual_update", text: string }` |
| (audio chunk) | User audio data. | `{ user_audio_chunk: string }` (base64) |

### WebSocket TypeScript Types

```typescript
type BaseEvent = { type: string };

type UserTranscriptEvent = BaseEvent & {
  type: "user_transcript";
  user_transcription_event: { user_transcript: string };
};

type AgentResponseEvent = BaseEvent & {
  type: "agent_response";
  agent_response_event: { agent_response: string };
};

type AgentResponseCorrectionEvent = BaseEvent & {
  type: "agent_response_correction";
  agent_response_correction_event: {
    original_agent_response: string;
    corrected_agent_response: string;
  };
};

type AudioResponseEvent = BaseEvent & {
  type: "audio";
  audio_event: {
    audio_base_64: string;
    event_id: number;
    alignment: {
      chars: string[];
      char_durations_ms: number[];
      char_start_times_ms: number[];
    };
  };
};

type InterruptionEvent = BaseEvent & {
  type: "interruption";
  interruption_event: { reason: string };
};

type PingEvent = BaseEvent & {
  type: "ping";
  ping_event: { event_id: number; ping_ms?: number };
};

type ElevenLabsWebSocketEvent =
  | UserTranscriptEvent
  | AgentResponseEvent
  | AgentResponseCorrectionEvent
  | AudioResponseEvent
  | InterruptionEvent
  | PingEvent;
```

### Next.js WebSocket Hook Example

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceStream } from "voice-stream";
import type { ElevenLabsWebSocketEvent } from "../types/websocket";

const sendMessage = (ws: WebSocket, request: object) => {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(request));
};

export const useAgentConversation = () => {
  const wsRef = useRef<WebSocket>(null);
  const [isConnected, setIsConnected] = useState(false);

  const { startStreaming, stopStreaming } = useVoiceStream({
    onAudioChunked: (audioData) => {
      if (!wsRef.current) return;
      sendMessage(wsRef.current, { user_audio_chunk: audioData });
    },
  });

  const startConversation = useCallback(async () => {
    if (isConnected) return;

    const ws = new WebSocket(
      "wss://api.elevenlabs.io/v1/convai/conversation?agent_id=<your-agent-id>"
    );

    ws.onopen = async () => {
      setIsConnected(true);
      sendMessage(ws, { type: "conversation_initiation_client_data" });
      await startStreaming();
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data) as ElevenLabsWebSocketEvent;

      if (data.type === "ping") {
        setTimeout(() => {
          sendMessage(ws, { type: "pong", event_id: data.ping_event.event_id });
        }, data.ping_event.ping_ms);
      }

      if (data.type === "audio") {
        // Implement audio playback with queuing to prevent overlap.
      }
    };

    wsRef.current = ws;

    ws.onclose = async () => {
      wsRef.current = null;
      setIsConnected(false);
      stopStreaming();
    };
  }, [startStreaming, isConnected, stopStreaming]);

  const stopConversation = useCallback(async () => {
    wsRef.current?.close();
  }, []);

  useEffect(() => {
    return () => wsRef.current?.close();
  }, []);

  return { startConversation, stopConversation, isConnected };
};
```

Requires `voice-stream` package for microphone handling:

```bash
bun install voice-stream
```

---

## Testing

### Scenario Testing

Validates conversational quality via LLM evaluation:

1. Define a scenario (conversation context).
2. Set success criteria in plain language.
3. Provide success and failure examples.
4. Run the test — LLM evaluator determines pass/fail.

### Tool Call Testing

Verifies correct tool invocation and parameters:

1. Select the expected tool.
2. Define expected parameters with validation (exact match, regex, or LLM evaluation).
3. Configure dynamic variables.
4. Run and validate.

### CLI Testing

```bash
# Run all tests for an agent.
elevenlabs agents test <your-agent-id>
```

### Creating Tests from Conversations

In Call History, click "Create test from this conversation" to auto-populate scenario context from real interactions.

---

## Conversation Analysis

### Success Evaluation

Define custom criteria in the Analysis tab:

```
Name: solved_user_inquiry
Prompt: The assistant was able to answer all queries or redirect to support.
Success Criteria:
- All user queries answered satisfactorily.
- User redirected to support channel if needed.
```

Results: `success`, `failure`, or `unknown` with rationale.

### Data Collection

Extract structured data from transcripts:

```
Prompt: Extract the user's questions and inquiries from the conversation.
```

Results are available in Call History and via post-call webhooks.

---

## Latency Management

- **Adaptive buffering**: adjust audio buffering based on network conditions.
- **Jitter buffer**: smooth out variations in packet arrival times.
- **Ping-pong monitoring**: measure round-trip time and adjust accordingly.
- **Optimized chunking**: tweak audio chunk duration to balance latency and efficiency.

---

## Links

- [ElevenAgents Overview](https://elevenlabs.io/docs/eleven-agents/overview)
- [Quickstart](https://elevenlabs.io/docs/eleven-agents/quickstart)
- [React SDK](https://elevenlabs.io/docs/agents-platform/libraries/react)
- [WebSocket API](https://elevenlabs.io/docs/agents-platform/libraries/web-sockets)
- [Tools](https://elevenlabs.io/docs/agents-platform/customization/tools)
- [Events](https://elevenlabs.io/docs/agents-platform/customization/events)
- [Testing](https://elevenlabs.io/docs/agents-platform/customization/agent-testing)
- [Conversation Analysis](https://elevenlabs.io/docs/agents-platform/customization/agent-analysis)
- [API Reference](https://elevenlabs.io/docs/api-reference/introduction)
- [ElevenLabs UI Components](https://ui.elevenlabs.io/)
