export async function playPCM(base64Data: string): Promise<void> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("AudioContext not supported");
      return;
    }
    const audioCtx = new AudioContextClass({ sampleRate: 24000 });
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const buffer = new Int16Array(bytes.buffer);
    const audioBuffer = audioCtx.createBuffer(1, buffer.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) {
      channelData[i] = buffer[i] / 32768.0;
    }
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.start();
    
    return new Promise<void>(resolve => {
      source.onended = () => resolve();
    });
  } catch (error) {
    console.error("Error playing audio:", error);
  }
}

export function playBrowserTTS(text: string): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!window.speechSynthesis) {
      console.warn("speechSynthesis not supported in this browser");
      resolve();
      return;
    }
    
    try {
      // Cancel any ongoing speaking
      window.speechSynthesis.cancel();

      // Remove markdown and code blocks for cleaner speech synthesis
      const cleanText = text
        .replace(/```[\s\S]*?```/g, "")
        .replace(/\*\*|`|#|_/g, "")
        .trim();

      if (!cleanText) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();
      
      // Look for Hindi or Indian English voices for beautiful Hinglish localization match
      const isVoiceMatch = (v: SpeechSynthesisVoice) => 
        v.lang.includes("IN") || 
        v.lang.startsWith("hi") || 
        v.lang.startsWith("en-IN") ||
        v.name.toLowerCase().includes("india");

      const localVoice = voices.find(isVoiceMatch);
      if (localVoice) {
        utterance.voice = localVoice;
      }
      
      utterance.rate = 1.05;
      utterance.pitch = 1.15; // Slightly charming high pitch for Indian female dost style matches

      let hasResolved = false;
      const done = () => {
        if (!hasResolved) {
          hasResolved = true;
          resolve();
        }
      };

      utterance.onend = done;
      utterance.onerror = (e) => {
        console.error("Browser speech synthesis error:", e);
        done();
      };

      window.speechSynthesis.speak(utterance);

      // Safari background tab safety timer auto-release
      const wordCount = cleanText.split(/\s+/).length;
      const safetyTime = (wordCount * 300) + 3000;
      setTimeout(done, safetyTime);
    } catch (e) {
      console.error("Error running browser speech synthesis:", e);
      resolve();
    }
  });
}

