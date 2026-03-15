import { useState, useCallback, useRef, useEffect } from "react";
import {
  VoiceState,
  ConversationMessage,
  PipelineMetrics,
  STTEngine,
  TTSEngine,
  streamLLMResponse,
} from "@/lib/voicePipeline";

export function useVoiceSession() {
  const [state, setState] = useState<VoiceState>("idle");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [interimText, setInterimText] = useState("");
  const [currentResponse, setCurrentResponse] = useState("");
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sttRef = useRef<STTEngine | null>(null);
  const ttsRef = useRef<TTSEngine | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef(crypto.randomUUID());
  const processingStartRef = useRef<number>(0);
  const firstTokenRef = useRef<number>(0);
  const tokenCountRef = useRef(0);
  const isActiveRef = useRef(false);

  useEffect(() => {
    sttRef.current = new STTEngine();

    ttsRef.current = new TTSEngine((speaking) => {
      if (speaking) {
        // AI started speaking → stop microphone
        sttRef.current?.stop();
        setState("speaking");
      } else if (isActiveRef.current) {
        // AI finished speaking → restart mic after delay
        setTimeout(() => {
          setState("listening");
          sttRef.current?.start();
        }, 400);
      }
    });

    return () => {
      sttRef.current?.stop();
      ttsRef.current?.cancel();
      abortRef.current?.abort();
    };
  }, []);

  const handleInterruption = useCallback(() => {
    abortRef.current?.abort();
    ttsRef.current?.cancel();
    setCurrentResponse("");
    setState("listening");
  }, []);

  const processUserInput = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      const userMsg: ConversationMessage = {
        role: "user",
        content: text.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInterimText("");
      setState("processing");

      sttRef.current?.stop();

      processingStartRef.current = Date.now();
      firstTokenRef.current = 0;
      tokenCountRef.current = 0;

      let fullResponse = "";

      const history = [...messages.slice(-10), userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      abortRef.current = streamLLMResponse({
        messages: history,
        sessionId: sessionIdRef.current,

        onDelta: (token) => {
          if (!firstTokenRef.current) {
            firstTokenRef.current = Date.now();
          }

          tokenCountRef.current++;

          fullResponse += token;
          setCurrentResponse(fullResponse);

          ttsRef.current?.feedToken(token);

          if (ttsRef.current?.isSpeaking()) {
            setState("speaking");
          }
        },

        onDone: () => {
          ttsRef.current?.flush();

          const now = Date.now();
          const totalLatency = now - processingStartRef.current;

          const llmFirstToken = firstTokenRef.current
            ? firstTokenRef.current - processingStartRef.current
            : 0;

          setMetrics({
            sttLatency: 0,
            llmFirstToken,
            ttsStart: llmFirstToken + 50,
            totalLatency,
            tokensPerSecond: tokenCountRef.current / (totalLatency / 1000),
          });

          const assistantMsg: ConversationMessage = {
            role: "assistant",
            content: fullResponse,
            timestamp: now,
            latency: llmFirstToken,
          };

          setMessages((prev) => [...prev, assistantMsg]);
          setCurrentResponse("");

          if (!ttsRef.current?.isSpeaking()) {
            setState("listening");
            sttRef.current?.start();
          }
        },

        onError: (err) => {
          setError(err.message);
          setState("listening");
          sttRef.current?.start();

          setTimeout(() => setError(null), 5000);
        },
      });
    },
    [messages]
  );

  const startSession = useCallback(() => {
    if (!sttRef.current?.isAvailable()) {
      setError("Speech recognition not available. Use Chrome or Edge.");
      return;
    }

    isActiveRef.current = true;
    sessionIdRef.current = crypto.randomUUID();

    setState("listening");
    setMessages([]);
    setError(null);

    const stt = sttRef.current!;

    stt.onInterimResult = (text) => {
      // Ignore AI voice
      if (state === "speaking") return;

      setInterimText(text);

      if (state === "processing") {
        handleInterruption();
      }
    };

    stt.onFinalResult = (text) => {
      processUserInput(text);
    };

    stt.start();
  }, [state, handleInterruption, processUserInput]);

  const stopSession = useCallback(() => {
    isActiveRef.current = false;

    sttRef.current?.stop();
    ttsRef.current?.cancel();
    abortRef.current?.abort();

    setState("idle");
    setInterimText("");
    setCurrentResponse("");
  }, []);

  return {
    state,
    messages,
    interimText,
    currentResponse,
    metrics,
    error,
    startSession,
    stopSession,
    isSTTAvailable: sttRef.current?.isAvailable() ?? false,
  };
}
