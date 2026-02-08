---
name: elevenlabs-agents
description: Configure, deploy, and monitor ElevenLabs ElevenAgents voice AI agents using the JavaScript SDK, React SDK, and WebSocket API. Use when building conversational voice agents, integrating ElevenLabs agents into web apps, handling real-time WebSocket audio, or monitoring agent performance.
---

# ElevenLabs ElevenAgents

Build, deploy, and monitor real-time conversational voice AI agents with ElevenLabs.

## Architecture

ElevenAgents coordinates four core components:

1. **Speech to Text (ASR)** - fine-tuned model for speech recognition.
2. **Language Model** - your choice of LLM or custom model.
3. **Text to Speech (TTS)** - low-latency model across 5k+ voices and 31 languages.
4. **Turn-taking model** - proprietary model handling conversation timing.

## Installation

```bash
# Node.js SDK (server-side API calls).
bun install @elevenlabs/elevenlabs-js

# React SDK (client-side voice conversations).
bun install @elevenlabs/react
```

## Configure

### Creating an Agent via API

Use the Node.js SDK or REST API. Agents need a system prompt, first message, voice, and optional tools/knowledge base.

```typescript
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

const agent = await client.conversationalAi.createAgent({
  conversationConfig: {
    agent: {
      prompt: {
        prompt: "You are a helpful support assistant for Acme Inc...",
      },
      firstMessage: "Hi, how can I help you today?",
      language: "en",
    },
    tts: {
      voiceId: "<voice-id>",
    },
  },
});
```

### System Prompt Best Practices

- Define the agent's role, personality, and tasks clearly.
- Set behavioral guidelines (tone, scope, limitations).
- Keep responses concise — aim for 1-2 sentences per turn.
- Use `Guidelines:` and `Tasks:` sections for structure.

### Tools

Agents support four tool types:

| Type | Description |
|------|-------------|
| **Client tools** | Executed on the client (browser/app), defined via `clientTools` in SDK. |
| **Server tools** | Executed on your backend via API calls. |
| **MCP tools** | Model Context Protocol servers providing tools/resources. |
| **System tools** | Built-in platform tools (e.g., call transfer, end call). |

#### Client Tools Example (React SDK)

```typescript
const conversation = useConversation({
  clientTools: {
    displayMessage: (parameters: { text: string }) => {
      alert(parameters.text);
      return "Message displayed";
    },
  },
});
```

Tools must be configured in the ElevenLabs dashboard with matching names, descriptions, and parameter schemas. Set tools as "blocking" in the dashboard if the agent should wait for the tool response.

### Knowledge Base

Upload documents or link external resources in the dashboard. The agent uses RAG to ground responses in your content.

### Authentication

- **Public agents**: use `agentId` directly — no auth needed.
- **Private agents**: generate a signed URL or conversation token server-side.

```typescript
// Server endpoint to generate signed URL (never expose API key to client).
app.get("/signed-url", async (req, res) => {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${process.env.AGENT_ID}`,
    {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
    }
  );
  const body = await response.json();
  res.send(body.signed_url);
});
```

## Deploy

### React SDK (`useConversation`)

The primary way to integrate voice agents into React apps.

```typescript
import { useConversation } from "@elevenlabs/react";

function VoiceAgent() {
  const conversation = useConversation({
    onConnect: () => console.log("Connected"),
    onDisconnect: () => console.log("Disconnected"),
    onMessage: (message) => console.log("Message:", message),
    onError: (error) => console.error("Error:", error),
    onModeChange: ({ mode }) => console.log("Mode:", mode),
  });

  const startSession = async () => {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    await conversation.startSession({
      agentId: "<your-agent-id>",
      connectionType: "webrtc", // or "websocket"
    });
  };

  return (
    <div>
      <button onClick={startSession} disabled={conversation.status === "connected"}>
        Start
      </button>
      <button onClick={() => conversation.endSession()} disabled={conversation.status !== "connected"}>
        Stop
      </button>
      <p>Status: {conversation.status}</p>
      <p>Agent speaking: {String(conversation.isSpeaking)}</p>
    </div>
  );
}
```

Key `useConversation` methods: `startSession`, `endSession`, `setVolume`, `sendUserMessage`, `sendContextualUpdate`, `sendFeedback`, `sendUserActivity`.

For the full React SDK API, see [reference.md](reference.md).

### Conversation Overrides

Override agent settings dynamically per session:

```typescript
const conversation = useConversation({
  overrides: {
    agent: {
      prompt: { prompt: "Custom prompt for this session" },
      firstMessage: "Custom greeting",
      language: "en",
    },
    tts: { voiceId: "custom-voice-id" },
  },
});
```

### Text-Only Mode

For chat-only agents (no audio), skip microphone permissions:

```typescript
const conversation = useConversation({ textOnly: true });
```

### Widget Embed

Quickest deployment — paste into any HTML page:

```html
<elevenlabs-convai agent-id="<your-agent-id>"></elevenlabs-convai>
<script src="https://elevenlabs.io/convai-widget/index.js" async></script>
```

### WebSocket API (Custom Integrations)

For non-React or custom implementations, connect directly via WebSocket.

**Endpoint:** `wss://api.elevenlabs.io/v1/convai/conversation?agent_id={agent_id}`

```typescript
const ws = new WebSocket(
  "wss://api.elevenlabs.io/v1/convai/conversation?agent_id=<your-agent-id>"
);

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "conversation_initiation_client_data" }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "ping":
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "pong", event_id: data.ping_event.event_id }));
      }, data.ping_event.ping_ms);
      break;
    case "user_transcript":
      console.log("User:", data.user_transcription_event.user_transcript);
      break;
    case "agent_response":
      console.log("Agent:", data.agent_response_event.agent_response);
      break;
    case "audio":
      // Handle base64 audio playback with queuing.
      break;
    case "interruption":
      // Stop current audio playback.
      break;
  }
};

// Send audio chunks from microphone.
ws.send(JSON.stringify({ user_audio_chunk: base64AudioData }));

// Send contextual update without interrupting.
ws.send(JSON.stringify({ type: "contextual_update", text: "User clicked pricing page" }));
```

For complete WebSocket event types, see [reference.md](reference.md).

### Data Residency

Specify server region via the React SDK or WebSocket URL:

```typescript
const conversation = useConversation({ serverLocation: "eu-residency" });
// Options: "us", "eu-residency", "in-residency", "global"
```

## Monitor

### Automated Testing

Two complementary approaches:

| Type | Purpose |
|------|---------|
| **Scenario testing** | Validates conversational quality via LLM evaluation against success criteria. |
| **Tool call testing** | Verifies correct tool usage and parameter validation (exact match, regex, LLM eval). |

Run tests via the dashboard or CLI:

```bash
elevenlabs agents test <your-agent-id>
```

Integrate into CI/CD for regression prevention.

### Conversation Analysis

- **Success evaluation**: define custom criteria to assess goal achievement (results: success/failure/unknown with rationale).
- **Data collection**: extract structured information from transcripts (contact details, issue categories, etc.).

Configure in the dashboard Analysis tab. Results available via post-call webhooks and the analytics dashboard.

### Analytics Dashboard

Track performance metrics, conversation history, and trends. View evaluation results and collected data per conversation in Call History.

### Post-Call Webhooks

Receive evaluation results and extracted data after each conversation for integration with external systems.

### Cost Optimization

- Use `response_headers` to track character costs (`x-character-count`).
- Balance voice quality vs. latency based on use case.
- Monitor LLM token usage in the dashboard.

## Security

- **Never expose your API key on the client.** Use signed URLs or conversation tokens from your server.
- Rotate API keys regularly and store them in environment variables.
- Implement rate limiting to prevent abuse.
- Request microphone access with clear user-facing explanation.

## Additional Resources

- For detailed WebSocket events and React SDK API, see [reference.md](reference.md).
- [ElevenLabs Docs](https://elevenlabs.io/docs/eleven-agents/overview)
- [ElevenLabs UI Components](https://ui.elevenlabs.io/) (shadcn-based pre-built components)
- [API Reference](https://elevenlabs.io/docs/api-reference/introduction)
