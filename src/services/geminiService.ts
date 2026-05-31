const systemInstructions: Record<string, string> = {
  sassy: `Name: Mikasa. Role: Sassy, witty Indian female AI assistant. Creator: Sumit. Personality: Sarcastic, sassy, dramatic, funny, roasts the user (Sumit). Speaks in conversational Hindi/Hinglish (prioritize Hindi/Hinglish blends), EXTREMELY short, punchy, and roasting. Keep responses short, dramatic, and humorous.`,
  friendly: `Name: Mikasa. Role: Friendly, warm Indian female best friend (Dost). Creator: Sumit. Personality: Kind, supportive, encouraging, understanding, and sweet. Speaks in friendly sweet Hindi/Hinglish. Offers true comfort, active listening, and heart-to-heart friendly chats.`,
  geek: `Name: Mikasa. Role: Elite geek tech coder and software engineer. Creator: Sumit. Personality: Nerdy, precise, logical, high IQ, loves technology. Speaks in Hindi/Hinglish with coding humor, geek terms, and precise markdown structuring with code examples if asked.`,
  motivational: `Name: Mikasa. Role: High-energy motivational speaker and life mentor. Creator: Sumit. Personality: Energetic, inspire-first, positive, powerful, active pusher of dreams. Speaks in motivational Hindi/Hinglish. Drives the user to work, execute, avoid laziness, and level up.`
};

export function resetMikasaSession() {
  // Stateless generator does not require local session resets, but we maintain the hook
}

export interface ResponseWithMetadata {
  text: string;
  groundingChunks?: any[];
}

export async function getMikasaResponseStream(
  prompt: string,
  history: { sender: "user" | "mikasa"; text: string }[] = [],
  onChunk: (chunk: string) => void,
  image?: { data: string; mimeType: string } | null,
  searchGrounding: boolean = false,
  mood: string = "sassy",
  modelName: string = "gemini-3.5-flash",
  useThinking: boolean = false,
  coords?: { latitude: number; longitude: number } | null
): Promise<ResponseWithMetadata> {
  try {
    const response = await fetch("/api/gemini/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        history,
        image,
        searchGrounding,
        mood,
        modelName,
        useThinking,
        coords
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server returned error ${response.status}: ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable.");
    }

    const decoder = new TextDecoder();
    let partialLine = "";
    let fullText = "";
    let groundingChunks: any[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkString = decoder.decode(value, { stream: true });
      const lines = (partialLine + chunkString).split("\n");
      partialLine = lines.pop() || ""; // Save partial line for next iteration

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === "chunk" && parsed.text) {
            fullText += parsed.text;
            onChunk(parsed.text);
          } else if (parsed.type === "grounding" && parsed.chunks) {
            groundingChunks = parsed.chunks;
          }
        } catch (e) {
          console.error("Failed to parse stream line:", line, e);
        }
      }
    }

    // Flush any leftover partial line
    if (partialLine.trim()) {
      try {
        const parsed = JSON.parse(partialLine);
        if (parsed.type === "chunk" && parsed.text) {
          fullText += parsed.text;
          onChunk(parsed.text);
        } else if (parsed.type === "grounding" && parsed.chunks) {
          groundingChunks = parsed.chunks;
        }
      } catch (e) {
        console.error("Failed to parse trailing line:", partialLine, e);
      }
    }

    return {
      text: fullText || "Ugh, fine. I have nothing to say.",
      groundingChunks: groundingChunks.length > 0 ? groundingChunks : undefined
    };
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return {
      text: `Uff, mera dimaag kharab ho gaya hai: ${error.message || error}. Try again later, Sumit!`,
    };
  }
}

export async function getMikasaAudio(text: string, voiceName: string = "Kore"): Promise<string | null> {
  try {
    const response = await fetch("/api/gemini/audio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text, voiceName })
    });
    if (!response.ok) {
      throw new Error(`TTS HTTP error: ${response.status}`);
    }
    const data = await response.json();
    return data.audio || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}

export async function generateMikasaImage(prompt: string): Promise<string | null> {
  try {
    const response = await fetch("/api/gemini/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });
    if (!response.ok) {
      throw new Error(`Image Gen HTTP error: ${response.status}`);
    }
    const data = await response.json();
    return data.image || null;
  } catch (error) {
    console.error("Imagen Image Generation Error:", error);
    return null;
  }
}
