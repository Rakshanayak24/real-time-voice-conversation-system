import { motion, AnimatePresence } from "framer-motion";
import type { ConversationMessage } from "@/lib/voicePipeline";

interface TranscriptPanelProps {
  messages: ConversationMessage[];
  interimText: string;
  currentResponse: string;
}

export function TranscriptPanel({ messages, interimText, currentResponse }: TranscriptPanelProps) {
  return (
    <div className="w-full max-w-lg mx-auto space-y-3 max-h-[40vh] overflow-y-auto px-2 scrollbar-thin">
      <AnimatePresence initial={false}>
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "glass-panel text-foreground rounded-bl-md"
              }`}
            >
              <p>{msg.content}</p>
              {msg.latency !== undefined && (
                <p className="text-[10px] mt-1 opacity-50 font-mono">
                  {msg.latency}ms to first token
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Current streaming response */}
      {currentResponse && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start"
        >
          <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-md glass-panel text-sm text-foreground">
            <p>{currentResponse}</p>
            <motion.span
              className="inline-block w-1.5 h-4 bg-primary ml-0.5 align-middle"
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          </div>
        </motion.div>
      )}

      {/* Interim STT text */}
      {interimText && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          className="flex justify-end"
        >
          <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md border border-border/30 text-sm text-muted-foreground italic">
            {interimText}
          </div>
        </motion.div>
      )}
    </div>
  );
}
