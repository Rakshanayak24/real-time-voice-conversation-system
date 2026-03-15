import type { PipelineMetrics } from "@/lib/voicePipeline";

interface MetricsPanelProps {
  metrics: PipelineMetrics | null;
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  if (!metrics) return null;

  const items = [
    { label: "LLM First Token", value: `${metrics.llmFirstToken}ms`, good: metrics.llmFirstToken < 500 },
    { label: "Total Latency", value: `${metrics.totalLatency}ms`, good: metrics.totalLatency < 2000 },
    { label: "Tokens/sec", value: metrics.tokensPerSecond.toFixed(1), good: metrics.tokensPerSecond > 20 },
  ];

  return (
    <div className="flex gap-4 justify-center font-mono text-xs">
      {items.map((item) => (
        <div key={item.label} className="glass-panel px-3 py-2 text-center">
          <p className="text-muted-foreground">{item.label}</p>
          <p className={item.good ? "text-voice-listening" : "text-voice-processing"}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
