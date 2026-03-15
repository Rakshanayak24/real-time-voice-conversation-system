import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Voice Chat Edge Function
 * 
 * Pipeline: Receives transcribed text → LLM (streaming) → Returns streamed text
 * 
 * The STT and TTS happen in the browser using native Web APIs for minimum latency.
 * This function handles only the LLM inference step, streaming tokens back via SSE.
 * 
 * Latency optimizations:
 * - Streaming response (first token in ~200-400ms)
 * - Minimal payload size
 * - No unnecessary processing layers
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, sessionId, interruptedAt } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // System prompt for voice conversation
    const systemPrompt = `You are a helpful voice AI assistant engaged in real-time conversation. 

Key behaviors:
- Keep responses concise and conversational (1-3 sentences unless asked for detail)
- Use natural spoken language, avoid markdown formatting, bullet points, or code blocks
- Respond directly and warmly
- If interrupted mid-response, gracefully acknowledge and address the new input
- Never say "as an AI" or similar disclaimers unless directly asked
- Use contractions and casual phrasing for natural speech
- Avoid using special characters, emojis, or formatting that doesn't translate well to speech

${interruptedAt ? `Note: Your previous response was interrupted. The user wants to say something new.` : ""}

Session ID: ${sessionId || "default"}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
          max_tokens: 300, // Keep responses short for voice
          temperature: 0.7,
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", status, errorText);
      return new Response(
        JSON.stringify({ error: "AI processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream the response directly back
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("voice-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
