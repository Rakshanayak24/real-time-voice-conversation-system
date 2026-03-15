export type VoiceState = "idle" | "listening" | "processing" | "speaking";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  latency?: number;
}

export interface PipelineMetrics {
  sttLatency: number;
  llmFirstToken: number;
  ttsStart: number;
  totalLatency: number;
  tokensPerSecond: number;
}

const VOICE_CHAT_URL =
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-chat`;

/* =====================================================
   STREAM LLM RESPONSE (OpenRouter SSE Parser)
===================================================== */

export function streamLLMResponse({
  messages,
  sessionId,
  onDelta,
  onDone,
  onError,
}: {
  messages: Array<{ role: string; content: string }>;
  sessionId: string;
  onDelta: (token: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}): AbortController {

  const controller = new AbortController();

  (async () => {
    try {

      const resp = await fetch(VOICE_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages,
          sessionId
        }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value);

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {

          if (!line.startsWith("data:")) continue;

          const data = line.replace("data:", "").trim();

          if (data === "[DONE]") {
            onDone();
            return;
          }

          try {
            const json = JSON.parse(data);

            const token =
              json?.choices?.[0]?.delta?.content;

            if (token) {
              onDelta(token);
            }

          } catch {
            // ignore malformed chunk
          }
        }
      }

      onDone();

    } catch (err) {

      if ((err as Error).name === "AbortError") return;

      onError(err as Error);
    }

  })();

  return controller;
}

/* =====================================================
   TEXT TO SPEECH ENGINE
===================================================== */

export class TTSEngine {

  private synth: SpeechSynthesis;
  private speaking = false;

  private queue: string[] = [];
  private sentenceBuffer = "";

  private onStateChange: (speaking: boolean) => void;

  constructor(onStateChange: (speaking: boolean) => void) {
    this.synth = window.speechSynthesis;
    this.onStateChange = onStateChange;
  }

  feedToken(token: string) {

    this.sentenceBuffer += token;

    const sentenceEnd = /[.!?]\s|[.!?]$/;

    if (sentenceEnd.test(this.sentenceBuffer) && this.sentenceBuffer.length > 10) {

      this.queue.push(this.sentenceBuffer.trim());
      this.sentenceBuffer = "";

      this.processQueue();
    }
  }

  flush() {

    if (this.sentenceBuffer.trim()) {
      this.queue.push(this.sentenceBuffer.trim());
      this.sentenceBuffer = "";
      this.processQueue();
    }
  }

  private processQueue() {

    if (this.speaking || this.queue.length === 0) return;

    const text = this.queue.shift()!;

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.rate = 1.05;
    utterance.pitch = 1;

    utterance.onstart = () => {
      this.speaking = true;
      this.onStateChange(true);
    };

    utterance.onend = () => {

      this.speaking = false;

      if (this.queue.length > 0) {
        this.processQueue();
      } else {
        this.onStateChange(false);
      }
    };

    utterance.onerror = () => {
      this.speaking = false;
      this.onStateChange(false);
    };

    this.synth.speak(utterance);
  }

  cancel() {

    this.synth.cancel();

    this.queue = [];
    this.sentenceBuffer = "";
    this.speaking = false;

    this.onStateChange(false);
  }

  isSpeaking() {
    return this.speaking || this.queue.length > 0;
  }
}

/* =====================================================
   SPEECH TO TEXT ENGINE
===================================================== */

export class STTEngine {

  private recognition: any = null;
  private isListening = false;

  onInterimResult: ((text: string) => void) | null = null;
  onFinalResult: ((text: string) => void) | null = null;

  constructor() {

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn("SpeechRecognition API not available");
      return;
    }

    this.recognition = new SpeechRecognitionAPI();

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {

      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {

        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim && this.onInterimResult) {
        this.onInterimResult(interim);
      }

      if (final && this.onFinalResult) {
        this.onFinalResult(final.trim());
      }
    };

    this.recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
    };

    this.recognition.onend = () => {

      if (this.isListening) {

        try {
          this.recognition.start();
        } catch {}
      }
    };
  }

  start() {

    if (!this.recognition || this.isListening) return;

    try {

      this.recognition.start();
      this.isListening = true;

    } catch {}
  }

  stop() {

    if (!this.recognition) return;

    try {
      this.recognition.stop();
    } catch {}

    this.isListening = false;
  }

  isAvailable() {
    return this.recognition !== null;
  }
}