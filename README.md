# VoiceAI — Real-Time Voice Conversation System

A real-time, browser-based voice conversation system with **low-latency**, bidirectional audio communication.  
Built from scratch without relying on external voice AI platforms.

---

## 🏗️ Architecture Overview
```bash

┌──────────┐ ┌─────────────────┐ ┌──────────────────────┐
│ Microphone│ ──▶ │ SpeechRecognition│ ──▶ │ Session Orchestrator │
│ (WebAudio)│ │ (Streaming STT) │ │ (State Machine) │
└──────────┘ └─────────────────┘ └──────────┬───────────┘
│
▼
┌──────────┐
│ Speaker │
│ (WebAudio)│
└──────────┘
```

- **Browser STT/TTS** handles audio locally.
- **Edge Function** streams LLM responses in real-time.
- **State Machine** ensures smooth turn-taking and interruption handling.

---

## 🔹 Component Breakdown

| Component         | Technology                          | Purpose                                    |
|------------------|------------------------------------|--------------------------------------------|
| Audio Capture     | Web Audio API / MediaDevices       | Capture microphone audio                   |
| Speech-to-Text    | Web Speech Recognition API         | Real-time transcription                     |
| LLM Processing    | Supabase Edge Function + AI Gateway | Streaming AI responses                     |
| Text-to-Speech    | Web Speech Synthesis API           | Sentence-buffered voice output             |
| Session Manager   | React state machine                | Turn-taking, interruptions, and session management |

---

## 🎯 Design Decisions

### 1. Browser-Native STT/TTS
- Eliminates audio transport latency.
- Simplifies the pipeline: mic → text, text → audio.
- Trade-offs: quality varies across browsers, limited voice customization.

### 2. SSE Streaming (Server-Sent Events)
- Lightweight and serverless-friendly.
- Clean interruption handling via `AbortController`.
- No need for WebSocket persistence.

### 3. Sentence-Buffered TTS
- Improves naturalness and prosody.
- Reduces robotic “word-by-word” speech.
- Minimal buffer delay (~200–400ms).

### 4. Turn-Taking State Machine
```bash
IDLE → LISTENING → PROCESSING → SPEAKING → LISTENING
                   │
              (Interrupt → LISTENING)
```

---

## ⚡ Latency Analysis

| Stage                       | Latency    | Notes                       |
|------------------------------|-----------|-----------------------------|
| Mic → STT (interim)          | 100–300ms | Browser-native, no network |
| STT → Final transcript       | 300–800ms | Depends on utterance       |
| Transcript → Edge Function   | 20–50ms   | HTTPS to nearest edge       |
| Edge → LLM first token       | 200–400ms | Streaming AI response      |
| First token → First sentence | 100–300ms | Sentence buffering          |
| Sentence → TTS start         | 10–30ms   | Browser-native synthesis    |
| **Total (first audio)**      | ~730–1880ms | Typically ~1 second        |

**Optimization strategies**: streaming at every layer, short max tokens, browser-native audio, sentence buffering.

---

## 🚀 Running Locally

### Prerequisites
- Node.js 18+ and npm/bun
- Chrome or Edge browser
- Supabase project with edge functions enabled

### Setup

```bash
# Clone repository
git clone <repository-url>
cd voice-ai
```
# Install dependencies
```bash
npm install
```

# Setup environment variables

Create a `.env.local` file in the project root:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```
Replace your-project and your-anon-key with your own Supabase project values.

#  Deploy the edge function
```bash
npx supabase login
npx supabase functions deploy voice-chat
```
# Start development server
```bash
npm run dev
```

Open http://localhost:8080/  in Chrome or Edge.
