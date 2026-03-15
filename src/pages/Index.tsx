import { VoiceOrb } from "@/components/VoiceOrb";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { MetricsPanel } from "@/components/MetricsPanel";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import { motion, AnimatePresence } from "framer-motion";

const Index = () => {
  const {
    state,
    messages,
    interimText,
    currentResponse,
    metrics,
    error,
    startSession,
    stopSession,
  } = useVoiceSession();

  const handleOrbClick = () => {
    if (state === "idle") {
      startSession();
    } else {
      stopSession();
    }
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-between py-8 px-4 bg-background">
      {/* Header */}
      <header className="text-center space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Voice<span className="text-primary">AI</span>
        </h1>
        <p className="text-xs font-mono text-muted-foreground tracking-wider uppercase">
          Real-time voice conversation system
        </p>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full max-w-2xl">
        {/* Transcript */}
        <TranscriptPanel
          messages={messages}
          interimText={interimText}
          currentResponse={currentResponse}
        />

        {/* Voice Orb */}
        <VoiceOrb state={state} onClick={handleOrbClick} />

        {/* Error display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="glass-panel px-4 py-2 text-destructive text-sm font-mono text-center max-w-md"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Metrics */}
        <MetricsPanel metrics={metrics} />
      </div>

      {/* Footer */}
      <footer className="text-center space-y-1.5">
        <p className="text-[10px] font-mono text-muted-foreground/60">
          {state === "idle"
            ? "Click the orb to start • Chrome/Edge recommended"
            : "Click the orb to stop • Speak naturally"}
        </p>
        <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-muted-foreground/40">
          <span>STT: Web Speech API</span>
          <span>•</span>
          <span>LLM: Streaming SSE</span>
          <span>•</span>
          <span>TTS: Speech Synthesis</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
