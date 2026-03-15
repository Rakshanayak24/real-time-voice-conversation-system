import { motion, AnimatePresence } from "framer-motion";
import type { VoiceState } from "@/lib/voicePipeline";

interface VoiceOrbProps {
  state: VoiceState;
  onClick: () => void;
}

const stateConfig = {
  idle: {
    scale: 1,
    className: "bg-muted",
    shadow: "none",
    label: "Start Conversation",
  },
  listening: {
    scale: 1,
    className: "bg-voice-listening",
    shadow: "0 0 40px hsl(160 84% 50% / 0.4), 0 0 80px hsl(160 84% 50% / 0.15)",
    label: "Listening...",
  },
  processing: {
    scale: 0.95,
    className: "bg-voice-processing",
    shadow: "0 0 40px hsl(45 90% 55% / 0.4), 0 0 80px hsl(45 90% 55% / 0.15)",
    label: "Thinking...",
  },
  speaking: {
    scale: 1.05,
    className: "bg-voice-speaking",
    shadow: "0 0 40px hsl(200 90% 55% / 0.4), 0 0 80px hsl(200 90% 55% / 0.15)",
    label: "Speaking...",
  },
};

export function VoiceOrb({ state, onClick }: VoiceOrbProps) {
  const config = stateConfig[state];

  return (
    <div className="flex flex-col items-center gap-6">
      <motion.button
        onClick={onClick}
        className={`relative w-32 h-32 rounded-full ${config.className} cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring`}
        animate={{
          scale: config.scale,
          boxShadow: config.shadow,
        }}
        whileHover={{ scale: config.scale * 1.05 }}
        whileTap={{ scale: config.scale * 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Pulse rings for active states */}
        <AnimatePresence>
          {state !== "idle" && (
            <>
              <motion.div
                className={`absolute inset-0 rounded-full ${config.className} opacity-30`}
                initial={{ scale: 1, opacity: 0.3 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.div
                className={`absolute inset-0 rounded-full ${config.className} opacity-20`}
                initial={{ scale: 1, opacity: 0.2 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
              />
            </>
          )}
        </AnimatePresence>

        {/* Waveform bars for speaking state */}
        {state === "speaking" && (
          <div className="absolute inset-0 flex items-center justify-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <motion.div
                key={i}
                className="w-1.5 rounded-full bg-primary-foreground/80"
                animate={{
                  height: [8, 24, 8],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        )}

        {/* Mic icon for idle/listening */}
        {(state === "idle" || state === "listening") && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={state === "idle" ? "text-muted-foreground" : "text-primary-foreground"}
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </div>
        )}

        {/* Spinner for processing */}
        {state === "processing" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="w-8 h-8 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
          </div>
        )}
      </motion.button>

      <motion.p
        className="text-sm font-mono text-muted-foreground"
        key={state}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {config.label}
      </motion.p>
    </div>
  );
}
