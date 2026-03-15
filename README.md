# VoiceAI — Real-Time Voice Conversation System

A complete real-time voice conversation system running in the browser with low-latency, bidirectional audio communication. Built from scratch without any managed voice AI platforms.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER                                     │
│                                                                      │
│  ┌──────────┐    ┌─────────────────┐    ┌──────────────────────┐    │
│  │ Microphone│───▶│ SpeechRecognition│───▶│  Session Orchestrator │   │
│  │ (WebAudio)│    │  (Streaming STT) │    │  (State Machine)      │   │
│  └──────────┘    └─────────────────┘    └──────────┬───────────┘    │
│                                                     │                │
│                                                     ▼                │
│  ┌──────────┐    ┌─────────────────┐    ┌──────────────────────┐    │
│  │  Speaker  │◀──│ SpeechSynthesis  │◀──│   SSE Stream Parser   │   │
│  │ (WebAudio)│    │  (Sentence TTS)  │    │  (Token-by-token)     │   │
│  └──────────┘    └─────────────────┘    └──────────────────────┘    │
│                                                     ▲                │
└─────────────────────────────────────────────────────┼────────────────┘
                                                      │ HTTPS/SSE
┌─────────────────────────────────────────────────────┼────────────────┐
│                     EDGE FUNCTION (Serverless)       │                │
│                                                      │                │
│  ┌──────────────────┐    ┌───────────────────────┐  │                │
│  │  Session Context  │───▶│  LLM Gateway (Gemini)  │──┘                │
│  │  + Interruption   │    │  Streaming Response    │                   │
│  └──────────────────┘    └───────────────────────┘                   │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Audio Capture** | Web Audio API / MediaDevices | Microphone access and raw audio |
| **Speech-to-Text** | Web Speech Recognition API | Real-time transcription with interim results |
| **LLM Processing** | Supabase Edge Function + AI Gateway | Streaming language model inference |
| **Text-to-Speech** | Web Speech Synthesis API | Sentence-buffered voice output |
| **Session Manager** | React state machine | Turn-taking, interruption handling |

## 🎯 Design Decisions

### 1. Browser-Native STT/TTS vs Server-Side Processing

**Decision**: Use browser-native Speech Recognition and Speech Synthesis APIs.

**Rationale**:
- **Eliminates audio transport latency**: No need to stream raw audio to a server for transcription. The browser's built-in speech recognition processes audio locally with ~100-300ms latency.
- **No audio codec complexity**: Avoids PCM encoding/decoding, opus compression, and WebSocket binary framing.
- **Simplifies the pipeline**: The most latency-sensitive operations (mic→text, text→audio) happen locally.

**Trade-offs**:
- Browser STT quality varies (Chrome/Edge have the best implementation via Google's cloud service)
- Limited language/voice customization compared to dedicated STT/TTS services
- Not available in all browsers (Firefox has limited support)

### 2. SSE Streaming vs WebSocket

**Decision**: Use Server-Sent Events (SSE) via fetch streaming for LLM responses.

**Rationale**:
- The LLM communication pattern is inherently request-response (user speaks → AI responds)
- SSE is simpler to implement, debug, and deploy on serverless platforms
- Edge Functions natively support streaming responses
- AbortController provides clean interruption semantics

**Why not WebSocket**:
- WebSockets require persistent connections, which conflict with serverless edge function architecture
- The bidirectional nature of WebSockets is unnecessary here — audio I/O is browser-local
- SSE provides equivalent streaming capability for our unidirectional server→client data flow

### 3. Sentence-Buffered TTS

**Decision**: Buffer LLM tokens and speak in sentence-sized chunks rather than word-by-word.

**Rationale**:
- Speaking individual words sounds robotic and unnatural
- Sentence-level TTS produces natural prosody and intonation
- The ~200-400ms buffering delay is imperceptible since we start speaking as soon as the first sentence completes

### 4. State Machine for Turn-Taking

```
    IDLE ──▶ LISTENING ──▶ PROCESSING ──▶ SPEAKING ──▶ LISTENING
                                              │
                              LISTENING ◀─ (interrupt)
```

**Interruption Flow**:
1. User speaks while AI is responding
2. Browser STT detects speech (interim result)
3. Immediately: Cancel TTS, abort LLM stream
4. Transition to LISTENING state
5. Process new user input with interruption context

## ⚡ Latency Analysis

### End-to-End Latency Breakdown

| Stage | Latency | Notes |
|-------|---------|-------|
| Mic → STT (interim) | ~100-300ms | Browser-native, no network |
| STT → Final transcript | ~300-800ms | Depends on utterance length |
| Transcript → Edge Function | ~20-50ms | HTTPS to nearest edge |
| Edge Function → LLM first token | ~200-400ms | Gemini Flash streaming |
| First token → First sentence | ~100-300ms | Sentence buffering |
| Sentence → TTS start | ~10-30ms | Browser-native synthesis |
| **Total (first audio)** | **~730-1880ms** | Typical: ~1000ms |

### Latency Optimization Strategies

1. **Streaming at every layer**: No batch processing anywhere in the pipeline
2. **Browser-native audio I/O**: Eliminates network round-trips for STT/TTS
3. **Short max_tokens (300)**: Constrains response length for conversational pacing
4. **Sentence buffering**: Starts speaking before full response is generated
5. **AbortController**: Instant cancellation on interruption (no wasted processing)
6. **Edge deployment**: Function runs close to user geographically

### Comparison with Alternative Architectures

| Architecture | Estimated Latency | Complexity |
|-------------|-------------------|------------|
| **This system** (browser STT/TTS) | ~1000ms | Low |
| Server-side STT + TTS (Whisper + ElevenLabs) | ~2000-3000ms | High |
| Full WebSocket + WebRTC | ~800-1200ms | Very High |
| Pre-built platform (LiveKit, Pipecat) | ~500-800ms | Low (but abstracted) |

## 🚧 Known Trade-offs

1. **Browser dependency**: Web Speech API is best in Chrome/Edge. Firefox and Safari have limited or no support for SpeechRecognition.

2. **TTS quality**: Browser speech synthesis voices are functional but not as natural as neural TTS services (ElevenLabs, Google Cloud TTS).

3. **No audio-level VAD**: We rely on SpeechRecognition's built-in silence detection rather than implementing raw audio energy-based Voice Activity Detection.

4. **Single-language**: Currently hardcoded to English. The architecture supports multi-language but requires SpeechRecognition language switching.

5. **No persistence**: Conversation history is in-memory only. Adding database persistence would be straightforward via Supabase.

6. **Edge function cold starts**: First request may have ~500ms additional latency from cold start. Subsequent requests are fast.

## 🚀 Running Locally

### Prerequisites

- **Node.js** 18+ and npm/bun
- **Chrome or Edge** browser (required for Web Speech API)
- A Supabase project with edge functions enabled

### Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd voice-ai

# 2. Install dependencies
npm install

# 3. Set up environment variables
# Create a .env.local file:
cat > .env.local << EOF
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
EOF

# 4. Deploy the edge function
npx supabase functions deploy voice-chat

# 5. Set the LOVABLE_API_KEY secret (auto-provided in Lovable Cloud)
npx supabase secrets set LOVABLE_API_KEY=your-lovable-api-key

# 6. Start the development server
npm run dev

# 7. Open http://localhost:5173 in Chrome/Edge
```

### Usage

1. Click the central orb to start a voice session
2. Speak naturally — your speech is transcribed in real-time
3. The AI responds with streaming text and voice
4. Speak while the AI is talking to interrupt
5. Click the orb again to stop

### Project Structure

```
src/
├── lib/
│   └── voicePipeline.ts      # Core pipeline: STT engine, TTS engine, LLM streaming
├── hooks/
│   └── useVoiceSession.ts     # Session orchestrator: state machine, turn-taking
├── components/
│   ├── VoiceOrb.tsx           # Animated visual indicator
│   ├── TranscriptPanel.tsx    # Conversation display
│   └── MetricsPanel.tsx       # Real-time latency metrics
├── pages/
│   └── Index.tsx              # Main page
└── index.css                  # Design system tokens

supabase/
└── functions/
    └── voice-chat/
        └── index.ts           # Edge function: LLM gateway with streaming
```

## 🏆 Key Engineering Highlights

- **Zero external voice AI dependencies**: No LiveKit, Pipecat, Daily, VAPI, etc.
- **Sub-second first audio response** in optimal conditions
- **Clean interruption handling** with AbortController + TTS cancellation
- **Real-time latency metrics** displayed in the UI
- **Streaming at every layer** — no batching anywhere in the pipeline
- **Minimal, focused architecture** — each component has a single responsibility
